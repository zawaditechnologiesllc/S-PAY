import axios from "axios";
import { logger } from "./logger";

/**
 * MiniPay-style onboarding on the Celo network:
 * every user gets a Celo (EVM) wallet address the moment they sign up —
 * no seed phrase, no extension, nothing to download.
 *
 * Wallets are provisioned through Privy server wallets (PRIVY_APP_ID /
 * PRIVY_APP_SECRET). Private keys live inside Privy's TEE infrastructure —
 * S-PAY only ever stores the public address, never key material.
 *
 * When Privy isn't configured the call is a logged no-op: users can still
 * register, and the wallet is backfilled on a later login once keys are set.
 */

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";
const PRIVY_API_BASE = process.env.PRIVY_API_BASE ?? "https://api.privy.io";

export function isCeloConfigured(): boolean {
  return Boolean(PRIVY_APP_ID && PRIVY_APP_SECRET);
}

/** Create a Celo-compatible (EVM) wallet via Privy. Returns id + address, or null when unconfigured/failed. */
export async function createCeloWallet(): Promise<{ id: string; address: string } | null> {
  if (!isCeloConfigured()) {
    logger.info("Privy not configured — Celo wallet provisioning skipped (set PRIVY_APP_ID / PRIVY_APP_SECRET)");
    return null;
  }
  try {
    const res = await axios.post<{ id: string; address: string }>(
      `${PRIVY_API_BASE}/v1/wallets`,
      { chain_type: "ethereum" }, // Celo is EVM-compatible; same address format
      {
        timeout: 10000,
        auth: { username: PRIVY_APP_ID, password: PRIVY_APP_SECRET },
        headers: { "privy-app-id": PRIVY_APP_ID },
      },
    );
    return res.data?.address ? { id: res.data.id, address: res.data.address } : null;
  } catch (err) {
    logger.warn({ err }, "Celo wallet provisioning via Privy failed — will retry on next login");
    return null;
  }
}

/**
 * Fire-and-forget: assign a Celo wallet to a user that doesn't have one yet.
 * Called at registration (instant wallet, MiniPay-style) and as a backfill on login.
 */
export function ensureCeloWallet(userId: string, currentAddress: string | null): void {
  if (currentAddress || !isCeloConfigured()) return;
  void (async () => {
    const wallet = await createCeloWallet();
    if (!wallet) return;
    try {
      const { db, usersTable } = await import("@workspace/db");
      const { eq, isNull, and } = await import("drizzle-orm");
      await db.update(usersTable)
        .set({ celoWalletAddress: wallet.address, privyWalletId: wallet.id, updatedAt: new Date() })
        .where(and(eq(usersTable.id, userId), isNull(usersTable.celoWalletAddress)));
      logger.info({ userId, address: wallet.address }, "Celo wallet provisioned");
    } catch (err) {
      logger.warn({ err, userId }, "Failed to save Celo wallet address");
    }
  })();
}
