import axios from "axios";
import { logger } from "./logger";

/**
 * USDC / USDT on the Celo network — the real money rails.
 *
 * READS need no keys and no wallet provider: balances come straight from
 * Celo's public RPC (Forno), so browsing the app never touches a WaaS and
 * deposits to a user's address show up as soon as the wallet exists.
 *
 * SENDS are signed by the user's wallet provider (Privy / Coinbase CDP /
 * Turnkey) — see lib/wallet-providers.ts. S-PAY never touches a private key.
 */

export const CELO_RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";

// Native token contracts on Celo mainnet (both 6 decimals)
export const CELO_TOKENS = {
  USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
} as const;

export type CeloToken = keyof typeof CELO_TOKENS;

export function pad32(hexNoPrefix: string): string {
  return hexNoPrefix.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

/** Token amount in on-chain base units (USDC/USDT use 6 decimals). */
export function tokenUnits(token: CeloToken, amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** CELO_TOKENS[token].decimals));
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
