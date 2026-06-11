import axios from "axios";
import { logger } from "./logger";

/**
 * USDC / USDT on the Celo network — the real money rails.
 *
 * READS need no keys: balances come straight from Celo's public RPC (Forno),
 * so deposits to a user's address show up as soon as the wallet exists.
 * SENDS are signed inside Privy's TEE via the server-wallet RPC — S-PAY never
 * touches a private key. Sending activates when PRIVY_APP_ID/SECRET are set.
 */

const CELO_RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const CELO_CHAIN_CAIP2 = process.env.CELO_CAIP2 ?? "eip155:42220"; // Celo mainnet
const PRIVY_API_BASE = process.env.PRIVY_API_BASE ?? "https://api.privy.io";
const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

// Native token contracts on Celo mainnet (both 6 decimals)
export const CELO_TOKENS = {
  USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
} as const;

export type CeloToken = keyof typeof CELO_TOKENS;

function pad32(hexNoPrefix: string): string {
  return hexNoPrefix.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

/** ERC-20 balanceOf(address) via eth_call — public, keyless. */
async function tokenBalance(token: CeloToken, owner: string): Promise<number> {
  const res = await axios.post(CELO_RPC, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: CELO_TOKENS[token].address, data: `0x70a08231${pad32(owner)}` }, "latest"],
  }, { timeout: 10000 });
  const hex: string = res.data?.result ?? "0x0";
  return Number(BigInt(hex)) / 10 ** CELO_TOKENS[token].decimals;
}

export interface TokenBalances { usdc: number; usdt: number; total: number }

/** Live USDC + USDT balances for an address; null when the RPC is unreachable. */
export async function getTokenBalances(address: string): Promise<TokenBalances | null> {
  try {
    const [usdc, usdt] = await Promise.all([
      tokenBalance("USDC", address),
      tokenBalance("USDT", address),
    ]);
    return { usdc, usdt, total: usdc + usdt };
  } catch (err) {
    logger.warn({ err, address }, "Celo balance read failed");
    return null;
  }
}

export function isOnchainSendConfigured(): boolean {
  return Boolean(PRIVY_APP_ID && PRIVY_APP_SECRET);
}

/**
 * Send USDC/USDT from a user's Privy server wallet. Returns the tx hash.
 * Gas is paid in CELO from the wallet (enable Privy gas sponsorship or dust
 * wallets with CELO at creation for a fully gasless UX).
 */
export async function sendToken(
  privyWalletId: string,
  to: string,
  token: CeloToken,
  amount: number,
): Promise<string> {
  const units = BigInt(Math.round(amount * 10 ** CELO_TOKENS[token].decimals));
  const data = `0xa9059cbb${pad32(to)}${pad32(units.toString(16))}`;

  const res = await axios.post(
    `${PRIVY_API_BASE}/v1/wallets/${privyWalletId}/rpc`,
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
  logger.info({ privyWalletId, token, amount, hash }, "On-chain transfer submitted");
  return hash;
}
