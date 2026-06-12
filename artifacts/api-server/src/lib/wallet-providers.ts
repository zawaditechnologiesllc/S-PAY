import axios from "axios";
import { logger } from "./logger";
import { CELO_RPC, CELO_TOKENS, tokenUnits, type CeloToken } from "./celo-chain";
import { getWalletProviderConfig, type WalletProviderKey } from "./settings";
import type { User } from "@workspace/db";

/**
 * Pluggable wallet-as-a-service (WaaS) layer for Celo wallets.
 *
 * Six interchangeable providers — the admin picks which one creates NEW
 * wallets and can switch each on/off live from /admin/settings:
 *   privy    — Privy server wallets (TEE).   Bills per monthly-active wallet user.
 *   cdp      — Coinbase Developer Platform.  $0.005/operation, 5K free ops/month.
 *   turnkey  — Turnkey (TEE, non-custodial). Free tier, then per-signature pricing.
 *   openfort — Openfort backend wallets (TEE). 2,000 free operations/month.
 *   thirdweb — thirdweb server wallets (Vault TEE) via REST; queued transactions.
 *   dynamic  — Dynamic TSS-MPC server wallets (native MPC signer; see caveats inline).
 *
 * THE COST RULE (why this file exists):
 * WaaS providers bill for wallet *users*, so the provider is only ever called
 * from MONEY actions — never from signup, login, or read endpoints. A wallet
 * is provisioned just-in-time by the user's first send / deposit-address
 * request / withdrawal (`ensureUserWallet`). Jobs-board traffic that signs up
 * and browses costs zero WaaS MAUs; auth runs entirely on our own DB + JWT.
 *
 * Once created, a wallet's private key lives with the provider that created
 * it, forever — switching the active provider only affects new wallets, and
 * each wallet's sends are signed by its own provider (`user.walletProvider`).
 * S-PAY stores only the public address + the provider's wallet id.
 */

export interface UserWallet {
  address: string;
  walletId: string;
  provider: WalletProviderKey;
}

export interface WalletProvider {
  key: WalletProviderKey;
  label: string;
  /** Env vars that activate this provider (shown in the admin panel). */
  envHint: string;
  isConfigured(): boolean;
  /** Create a Celo-compatible (EVM) server wallet. */
  createWallet(ref: string): Promise<{ id: string; address: string }>;
  /** Send USDC/USDT from the user's wallet. Returns the tx hash. */
  sendToken(wallet: UserWallet, to: string, token: CeloToken, amount: number): Promise<string>;
}

// ─── Privy ────────────────────────────────────────────────────────────────────
// REST API with basic auth; Privy builds, signs (in its TEE) and broadcasts the
// transaction itself via the server-wallet RPC endpoint.

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";
const PRIVY_API_BASE = process.env.PRIVY_API_BASE ?? "https://api.privy.io";
const CELO_CHAIN_CAIP2 = process.env.CELO_CAIP2 ?? "eip155:42220"; // Celo mainnet

const privyProvider: WalletProvider = {
  key: "privy",
  label: "Privy",
  envHint: "PRIVY_APP_ID + PRIVY_APP_SECRET",
  isConfigured: () => Boolean(PRIVY_APP_ID && PRIVY_APP_SECRET),

  async createWallet(): Promise<{ id: string; address: string }> {
    const res = await axios.post<{ id: string; address: string }>(
      `${PRIVY_API_BASE}/v1/wallets`,
      { chain_type: "ethereum" }, // Celo is EVM-compatible; same address format
      {
        timeout: 10000,
        auth: { username: PRIVY_APP_ID, password: PRIVY_APP_SECRET },
        headers: { "privy-app-id": PRIVY_APP_ID },
      },
    );
    if (!res.data?.address) throw new Error("Privy returned no wallet address");
    return { id: res.data.id, address: res.data.address };
  },

  async sendToken(wallet, to, token, amount): Promise<string> {
    const data = `0xa9059cbb${pad32(to)}${pad32(tokenUnits(token, amount).toString(16))}`;
    const res = await axios.post(
      `${PRIVY_API_BASE}/v1/wallets/${wallet.walletId}/rpc`,
      {
        method: "eth_sendTransaction",
        caip2: CELO_CHAIN_CAIP2,
        params: { transaction: { to: CELO_TOKENS[token].address, data, value: "0x0" } },
      },
      {
        timeout: 30000,
        auth: { username: PRIVY_APP_ID, password: PRIVY_APP_SECRET },
        headers: { "privy-app-id": PRIVY_APP_ID },
      },
    );
    const hash: string | undefined = res.data?.data?.hash ?? res.data?.hash;
    if (!hash) throw new Error("Privy did not return a transaction hash");
    return hash;
  },
};

function pad32(hexNoPrefix: string): string {
  return hexNoPrefix.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

// ─── Shared viem signing path (CDP + Turnkey) ─────────────────────────────────
// These providers sign remotely but don't broadcast for us on Celo, so we build
// the ERC-20 transfer with viem and submit it through the public Forno RPC.

import { createWalletClient, http, erc20Abi, type LocalAccount } from "viem";
import { celo } from "viem/chains";

async function viemSendToken(account: LocalAccount, to: string, token: CeloToken, amount: number): Promise<string> {
  const client = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });
  return client.writeContract({
    address: CELO_TOKENS[token].address as `0x${string}`,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to as `0x${string}`, tokenUnits(token, amount)],
  });
}

// ─── Coinbase CDP (Server Wallets v2) ─────────────────────────────────────────
// Free wallet creation and signing — no MAU billing. Keys live in Coinbase's
// TEE; the SDK account plugs straight into viem for Celo transactions.

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID ?? "";
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET ?? "";
const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET ?? "";

async function cdpClient() {
  const { CdpClient } = await import("@coinbase/cdp-sdk");
  // The constructor also reads these from env on its own; passing explicitly
  // keeps the dependency visible.
  return new CdpClient({
    apiKeyId: CDP_API_KEY_ID,
    apiKeySecret: CDP_API_KEY_SECRET,
    walletSecret: CDP_WALLET_SECRET,
  });
}

const cdpProvider: WalletProvider = {
  key: "cdp",
  label: "Coinbase CDP",
  envHint: "CDP_API_KEY_ID + CDP_API_KEY_SECRET + CDP_WALLET_SECRET",
  isConfigured: () => Boolean(CDP_API_KEY_ID && CDP_API_KEY_SECRET && CDP_WALLET_SECRET),

  async createWallet(ref): Promise<{ id: string; address: string }> {
    const cdp = await cdpClient();
    // Deterministic per-user name (CDP allows [A-Za-z0-9-], 2–36 chars; a UUID
    // user id is exactly 36). getOrCreateAccount is idempotent by name, so a
    // retried money action can never create a duplicate wallet.
    const name = ref.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 36);
    const account = await cdp.evm.getOrCreateAccount({ name });
    return { id: account.name ?? name, address: account.address };
  },

  async sendToken(wallet, to, token, amount): Promise<string> {
    const cdp = await cdpClient();
    const { toAccount } = await import("viem/accounts");
    const account = await cdp.evm.getAccount({ address: wallet.address as `0x${string}` });
    return viemSendToken(toAccount(account), to, token, amount);
  },
};

// ─── Turnkey ──────────────────────────────────────────────────────────────────
// Non-custodial TEE infrastructure (like Privy) priced per signer, not per MAU.
// Signing goes through @turnkey/viem; we broadcast via Forno.

const TURNKEY_API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY ?? "";
const TURNKEY_API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY ?? "";
const TURNKEY_ORGANIZATION_ID = process.env.TURNKEY_ORGANIZATION_ID ?? "";
const TURNKEY_API_BASE = process.env.TURNKEY_API_BASE ?? "https://api.turnkey.com";

async function turnkeyApiClient() {
  const { Turnkey } = await import("@turnkey/sdk-server");
  const turnkey = new Turnkey({
    apiBaseUrl: TURNKEY_API_BASE,
    apiPublicKey: TURNKEY_API_PUBLIC_KEY,
    apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
    defaultOrganizationId: TURNKEY_ORGANIZATION_ID,
  });
  return turnkey.apiClient();
}

const turnkeyProvider: WalletProvider = {
  key: "turnkey",
  label: "Turnkey",
  envHint: "TURNKEY_API_PUBLIC_KEY + TURNKEY_API_PRIVATE_KEY + TURNKEY_ORGANIZATION_ID",
  isConfigured: () =>
    Boolean(TURNKEY_API_PUBLIC_KEY && TURNKEY_API_PRIVATE_KEY && TURNKEY_ORGANIZATION_ID),

  async createWallet(ref): Promise<{ id: string; address: string }> {
    const client = await turnkeyApiClient();
    const { DEFAULT_ETHEREUM_ACCOUNTS } = await import("@turnkey/sdk-server");
    const res = await client.createWallet({
      walletName: `spay-${ref}`,
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    });
    const address = res.addresses?.[0];
    if (!address) throw new Error("Turnkey returned no wallet address");
    return { id: res.walletId, address };
  },

  async sendToken(wallet, to, token, amount): Promise<string> {
    const client = await turnkeyApiClient();
    const { createAccount } = await import("@turnkey/viem");
    const account = await createAccount({
      client,
      organizationId: TURNKEY_ORGANIZATION_ID,
      signWith: wallet.address,
      ethereumAddress: wallet.address, // already known — skips a lookup round-trip
    });
    return viemSendToken(account as LocalAccount, to, token, amount);
  },
};

// ─── Openfort ─────────────────────────────────────────────────────────────────
// Backend wallets: EOAs whose keys live in Openfort's TEE. Signing is
// chain-agnostic (viem TransactionSerializable in/out), so it drops into the
// same viem→Forno path as CDP/Turnkey. Two credentials, like CDP: the sk_ API
// key plus a wallet secret (generated with `openfort wallet-keys create`).

const OPENFORT_API_KEY = process.env.OPENFORT_API_KEY ?? "";
const OPENFORT_WALLET_SECRET = process.env.OPENFORT_WALLET_SECRET ?? "";

async function openfortClient() {
  const { default: Openfort } = await import("@openfort/openfort-node");
  return new Openfort(OPENFORT_API_KEY, { walletSecret: OPENFORT_WALLET_SECRET });
}

const openfortProvider: WalletProvider = {
  key: "openfort",
  label: "Openfort",
  envHint: "OPENFORT_API_KEY + OPENFORT_WALLET_SECRET",
  isConfigured: () => Boolean(OPENFORT_API_KEY && OPENFORT_WALLET_SECRET),

  async createWallet(ref): Promise<{ id: string; address: string }> {
    const openfort = await openfortClient();
    // idempotencyKey = user id, so a retried money action can't double-create
    const account = await openfort.accounts.evm.backend.create({ idempotencyKey: ref });
    if (!account?.address) throw new Error("Openfort returned no wallet address");
    return { id: account.id, address: account.address };
  },

  async sendToken(wallet, to, token, amount): Promise<string> {
    const openfort = await openfortClient();
    const acct = await openfort.accounts.evm.backend.get({ id: wallet.walletId });
    const { toAccount } = await import("viem/accounts");
    const account = toAccount({
      address: wallet.address as `0x${string}`,
      signMessage: (args) => acct.signMessage(args),
      signTransaction: (tx) => acct.signTransaction(tx),
      signTypedData: (td) => acct.signTypedData(td),
    });
    return viemSendToken(account, to, token, amount);
  },
};

// ─── thirdweb ─────────────────────────────────────────────────────────────────
// Server wallets secured in thirdweb Vault (TEE), driven over plain REST with
// the project secret key. Sends are QUEUED by their Transactions API — we get
// a transaction id back and poll briefly for the on-chain hash.
//
// We store (and fund) the wallet's plain EOA `address`. The send request pins
// EOA execution so the debit happens from that same address; if thirdweb's API
// rejects the executionOptions field (it is newer than the wallets/send docs),
// we retry once without it and log — verify with a small test send before
// making thirdweb the active provider (see docs/WALLET-PROVIDERS.md).

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY ?? "";
const THIRDWEB_API_BASE = process.env.THIRDWEB_API_BASE ?? "https://api.thirdweb.com";
const CELO_CHAIN_ID = Number((process.env.CELO_CAIP2 ?? "eip155:42220").split(":")[1] ?? 42220);

const thirdwebHeaders = () => ({ "x-secret-key": THIRDWEB_SECRET_KEY, "Content-Type": "application/json" });

async function thirdwebAwaitTxHash(transactionId: string): Promise<string> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const res = await axios.get(
      `${THIRDWEB_API_BASE}/v1/transactions/${transactionId}`,
      { timeout: 10000, headers: thirdwebHeaders() },
    );
    const result = res.data?.result ?? {};
    if (result.transactionHash) return result.transactionHash as string;
    if (result.status === "FAILED") {
      throw new Error(`thirdweb transaction failed: ${result.errorMessage ?? "unknown error"}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`thirdweb transaction ${transactionId} still ${result.status ?? "pending"} after 60s`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const thirdwebProvider: WalletProvider = {
  key: "thirdweb",
  label: "thirdweb",
  envHint: "THIRDWEB_SECRET_KEY",
  isConfigured: () => Boolean(THIRDWEB_SECRET_KEY),

  async createWallet(ref): Promise<{ id: string; address: string }> {
    const identifier = `spay-${ref}`;
    // Idempotent: the same identifier always returns the same wallet
    const res = await axios.post(
      `${THIRDWEB_API_BASE}/v1/wallets/server`,
      { identifier },
      { timeout: 15000, headers: thirdwebHeaders() },
    );
    const address: string | undefined = res.data?.result?.address;
    if (!address) throw new Error("thirdweb returned no wallet address");
    return { id: identifier, address };
  },

  async sendToken(wallet, to, token, amount): Promise<string> {
    const body: Record<string, unknown> = {
      from: wallet.address,
      chainId: CELO_CHAIN_ID,
      recipients: [{ address: to, quantity: tokenUnits(token, amount).toString() }],
      tokenAddress: CELO_TOKENS[token].address,
      executionOptions: { type: "EOA" }, // debit the stored EOA, not a 4337 account
    };
    let res;
    try {
      res = await axios.post(`${THIRDWEB_API_BASE}/v1/wallets/send`, body, { timeout: 30000, headers: thirdwebHeaders() });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        logger.warn({ data: err.response.data }, "thirdweb rejected executionOptions — retrying with provider defaults");
        delete body.executionOptions;
        res = await axios.post(`${THIRDWEB_API_BASE}/v1/wallets/send`, body, { timeout: 30000, headers: thirdwebHeaders() });
      } else {
        throw err;
      }
    }
    const txId: string | undefined = res.data?.result?.transactionIds?.[0];
    if (!txId) throw new Error("thirdweb did not return a transaction id");
    return thirdwebAwaitTxHash(txId);
  },
};

// ─── Dynamic ──────────────────────────────────────────────────────────────────
// TSS-MPC server wallets: our server is one MPC party (a native signer binary —
// the package is NOT bundled; see build.mjs externals + the Dockerfile install).
// The MPC key shares are backed up to Dynamic, protected by a per-wallet
// password we derive from DYNAMIC_WALLET_PASSWORD_SECRET — so the DB still
// holds no key material, only the (non-sensitive) wallet metadata, which we
// keep JSON-encoded in the wallet-id column.
//
// ⚠ Treat DYNAMIC_WALLET_PASSWORD_SECRET like a key: losing it means Dynamic
// wallets can no longer sign (recover via Dynamic's dashboard/export tooling).

const DYNAMIC_ENVIRONMENT_ID = process.env.DYNAMIC_ENVIRONMENT_ID ?? "";
const DYNAMIC_API_TOKEN = process.env.DYNAMIC_API_TOKEN ?? "";
const DYNAMIC_WALLET_PASSWORD_SECRET = process.env.DYNAMIC_WALLET_PASSWORD_SECRET ?? "";

interface DynamicWalletRef {
  v: 1;
  ref: string; // user id — input to the per-wallet password derivation
  metadata: Record<string, unknown>; // Dynamic WalletMetadata incl. share-backup pointers
}

async function dynamicClient() {
  const { DynamicEvmWalletClient } = await import("@dynamic-labs-wallet/node-evm");
  const client = new DynamicEvmWalletClient({ environmentId: DYNAMIC_ENVIRONMENT_ID });
  await client.authenticateApiToken(DYNAMIC_API_TOKEN);
  return client;
}

async function dynamicWalletPassword(ref: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", DYNAMIC_WALLET_PASSWORD_SECRET).update(ref).digest("hex");
}

const dynamicProvider: WalletProvider = {
  key: "dynamic",
  label: "Dynamic",
  envHint: "DYNAMIC_ENVIRONMENT_ID + DYNAMIC_API_TOKEN + DYNAMIC_WALLET_PASSWORD_SECRET",
  isConfigured: () =>
    Boolean(DYNAMIC_ENVIRONMENT_ID && DYNAMIC_API_TOKEN && DYNAMIC_WALLET_PASSWORD_SECRET),

  async createWallet(ref): Promise<{ id: string; address: string }> {
    const [client, { ThresholdSignatureScheme }] = await Promise.all([
      dynamicClient(),
      import("@dynamic-labs-wallet/node"),
    ]);
    const created = await client.createWalletAccount({
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      password: await dynamicWalletPassword(ref),
      backUpToDynamic: true, // shares live with Dynamic, recoverable with the derived password
    });
    const metadata = created.walletMetadata;
    if (!metadata?.accountAddress) throw new Error("Dynamic returned no wallet address");
    const idPayload: DynamicWalletRef = { v: 1, ref, metadata: metadata as unknown as Record<string, unknown> };
    return { id: JSON.stringify(idPayload), address: metadata.accountAddress };
  },

  async sendToken(wallet, to, token, amount): Promise<string> {
    let parsed: DynamicWalletRef;
    try {
      parsed = JSON.parse(wallet.walletId) as DynamicWalletRef;
    } catch {
      throw new Error("Dynamic wallet metadata is corrupted — cannot sign for this wallet");
    }
    const client = await dynamicClient();
    const { celo } = await import("viem/chains");
    const walletClient = await client.getWalletClient({
      walletMetadata: parsed.metadata as never,
      chain: celo,
      rpcUrl: CELO_RPC,
      password: await dynamicWalletPassword(parsed.ref),
    });
    return walletClient.writeContract({
      address: CELO_TOKENS[token].address as `0x${string}`,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, tokenUnits(token, amount)],
    });
  },
};

// ─── Registry + config-aware helpers ──────────────────────────────────────────

const PROVIDERS: Record<WalletProviderKey, WalletProvider> = {
  privy: privyProvider,
  cdp: cdpProvider,
  turnkey: turnkeyProvider,
  openfort: openfortProvider,
  thirdweb: thirdwebProvider,
  dynamic: dynamicProvider,
};

/** Static provider facts for the admin panel (configured = env keys present). */
export function walletProviderCatalog(): Array<{
  key: WalletProviderKey; label: string; configured: boolean; envHint: string;
}> {
  return Object.values(PROVIDERS).map((p) => ({
    key: p.key,
    label: p.label,
    configured: p.isConfigured(),
    envHint: p.envHint,
  }));
}

/**
 * The provider allowed to SIGN for the given wallet right now, or null when it
 * is unconfigured or switched off by the admin (kill switch). Reads/deposits
 * never need this — funds live on-chain, not at the provider.
 */
export async function getSendableProvider(key: WalletProviderKey): Promise<WalletProvider | null> {
  const provider = PROVIDERS[key];
  if (!provider?.isConfigured()) return null;
  const config = await getWalletProviderConfig();
  return config.enabled[key] ? provider : null;
}

type WalletUser = Pick<User, "id" | "celoWalletAddress" | "walletId" | "walletProvider">;

/**
 * Just-in-time wallet provisioning — THE call that gates all WaaS spend.
 * Call it from money actions only. Returns the user's wallet, creating one via
 * the admin-selected active provider when the user doesn't have one yet;
 * null when no provider is available (callers answer with their honest 503).
 */
export async function ensureUserWallet(user: WalletUser): Promise<UserWallet | null> {
  // Existing wallet: the address holds the funds — never replace it.
  if (user.celoWalletAddress) {
    if (!user.walletId) {
      // Pre-WaaS legacy row: address without signer linkage. Balances/deposits
      // still work; sends can't until the linkage is restored manually.
      logger.warn({ userId: user.id }, "Wallet has no provider wallet id — sends unavailable for this user");
      return null;
    }
    return {
      address: user.celoWalletAddress,
      walletId: user.walletId,
      provider: (user.walletProvider as WalletProviderKey) ?? "privy",
    };
  }

  const config = await getWalletProviderConfig();
  const provider = PROVIDERS[config.activeProvider];
  if (!config.enabled[config.activeProvider] || !provider.isConfigured()) {
    logger.info(
      { userId: user.id, activeProvider: config.activeProvider },
      "Wallet provisioning skipped — active provider off or unconfigured (set its env keys / flip it on in /admin/settings)",
    );
    return null;
  }

  let created: { id: string; address: string };
  try {
    created = await provider.createWallet(user.id);
  } catch (err) {
    logger.warn({ err, userId: user.id, provider: provider.key }, "Wallet provisioning failed — will retry on the next money action");
    return null;
  }

  try {
    const { db, usersTable } = await import("@workspace/db");
    const { eq, isNull, and } = await import("drizzle-orm");
    // Race-safe claim: only the first concurrent money action wins the column
    const updated = await db.update(usersTable)
      .set({
        celoWalletAddress: created.address,
        walletId: created.id,
        walletProvider: provider.key,
        updatedAt: new Date(),
      })
      .where(and(eq(usersTable.id, user.id), isNull(usersTable.celoWalletAddress)))
      .returning({
        address: usersTable.celoWalletAddress,
        walletId: usersTable.walletId,
        walletProvider: usersTable.walletProvider,
      });

    if (updated.length > 0) {
      logger.info({ userId: user.id, address: created.address, provider: provider.key }, "Celo wallet provisioned just-in-time");
      return { address: created.address, walletId: created.id, provider: provider.key };
    }

    // Lost the race to a parallel request — use the wallet that won.
    logger.warn({ userId: user.id, provider: provider.key, orphanAddress: created.address }, "Concurrent wallet provisioning — using the existing wallet (orphan unused at provider)");
    const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (fresh?.celoWalletAddress && fresh.walletId) {
      return {
        address: fresh.celoWalletAddress,
        walletId: fresh.walletId,
        provider: (fresh.walletProvider as WalletProviderKey) ?? "privy",
      };
    }
    return null;
  } catch (err) {
    logger.warn({ err, userId: user.id }, "Failed to save provisioned wallet");
    return null;
  }
}
