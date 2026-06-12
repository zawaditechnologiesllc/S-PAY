import { logger } from "./logger";

/**
 * Runtime feature flags stored in the app_settings table and toggled from
 * the admin panel — no redeploy needed. Values are cached briefly so hot
 * paths (e.g. GET /card/details) don't hit Postgres on every request.
 */

const CACHE_TTL_MS = 15 * 1000;
const cache = new Map<string, { value: unknown; cachedAt: number }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit.value as T;
  try {
    const { db, appSettingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
    const value = row ? (row.value as T) : fallback;
    cache.set(key, { value, cachedAt: Date.now() });
    return value;
  } catch (err) {
    logger.warn({ err, key }, "Failed to read app setting — using fallback");
    return fallback;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const { db, appSettingsTable } = await import("@workspace/db");
  await db
    .insert(appSettingsTable)
    .values({ key, value: value as object, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: value as object, updatedAt: new Date() } });
  cache.set(key, { value, cachedAt: Date.now() });
}

// ── Card program master switch ────────────────────────────────────────────────

const CARD_PROGRAM_KEY = "card_program_enabled";

export async function isCardProgramEnabled(): Promise<boolean> {
  const v = await getSetting<{ enabled: boolean }>(CARD_PROGRAM_KEY, { enabled: false });
  return v?.enabled === true;
}

export async function setCardProgramEnabled(enabled: boolean): Promise<void> {
  await setSetting(CARD_PROGRAM_KEY, { enabled });
}

// ── Maintenance mode ──────────────────────────────────────────────────────────
// When enabled, the API serves 503 for user traffic while keeping health,
// sign-in, webhooks, and the admin panel reachable so an admin can switch
// it back off. Toggled live from /admin/settings.

const MAINTENANCE_KEY = "maintenance_mode";

export interface MaintenanceState {
  enabled: boolean;
  message: string;
}

const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  message: "S-PAY is undergoing scheduled maintenance. We'll be back shortly — your funds are safe.",
};

export async function getMaintenance(): Promise<MaintenanceState> {
  const stored = await getSetting<Partial<MaintenanceState>>(MAINTENANCE_KEY, {});
  return { ...DEFAULT_MAINTENANCE, ...stored };
}

export async function setMaintenance(state: Partial<MaintenanceState>): Promise<void> {
  const current = await getMaintenance();
  await setSetting(MAINTENANCE_KEY, { ...current, ...state });
}

// ── Wallet provider switches ──────────────────────────────────────────────────
// Which wallet-as-a-service (WaaS) provisions NEW Celo wallets, and per-provider
// kill switches. Toggled live from /admin/settings — no redeploy. Existing
// wallets always keep the provider that holds their key (keys cannot move);
// the active provider only affects wallets created from now on.

export type WalletProviderKey = "privy" | "cdp" | "turnkey";
export const WALLET_PROVIDER_KEYS: readonly WalletProviderKey[] = ["privy", "cdp", "turnkey"] as const;

export interface WalletProviderConfig {
  /** Provider used to create NEW wallets (existing wallets keep theirs). */
  activeProvider: WalletProviderKey;
  /** Per-provider on/off. OFF = no new wallets AND no sends signed via it. */
  enabled: Record<WalletProviderKey, boolean>;
}

const DEFAULT_WALLET_PROVIDERS: WalletProviderConfig = {
  activeProvider: "privy",
  enabled: { privy: true, cdp: true, turnkey: true },
};

const WALLET_PROVIDERS_KEY = "wallet_providers";

export async function getWalletProviderConfig(): Promise<WalletProviderConfig> {
  const stored = await getSetting<Partial<WalletProviderConfig>>(WALLET_PROVIDERS_KEY, {});
  const active = WALLET_PROVIDER_KEYS.includes(stored.activeProvider as WalletProviderKey)
    ? (stored.activeProvider as WalletProviderKey)
    : DEFAULT_WALLET_PROVIDERS.activeProvider;
  return {
    activeProvider: active,
    enabled: { ...DEFAULT_WALLET_PROVIDERS.enabled, ...(stored.enabled ?? {}) },
  };
}

export async function setWalletProviderConfig(update: {
  activeProvider?: WalletProviderKey;
  enabled?: Partial<Record<WalletProviderKey, boolean>>;
}): Promise<WalletProviderConfig> {
  const current = await getWalletProviderConfig();
  const next: WalletProviderConfig = {
    activeProvider: update.activeProvider ?? current.activeProvider,
    enabled: { ...current.enabled, ...(update.enabled ?? {}) },
  };
  await setSetting(WALLET_PROVIDERS_KEY, next);
  return next;
}

// ── Platform fee schedule ─────────────────────────────────────────────────────
// User price = provider cost + S-PAY margin. Providers bill S-PAY separately
// (Stripe nets fees from the Stripe balance, Noah nets from settlement, Celo
// gas is sub-cent), so these are the *user-facing* prices — the spread is
// S-PAY revenue. Editable live from /admin/settings.

export interface FeeSchedule {
  withdrawalFeePercent: number; // % of withdrawal amount
  withdrawalFeeMin: number;     // USD floor per withdrawal
  cardIssuanceFee: number;      // one-time USD price for creating the virtual card
  p2pFeePercent: number;        // internal transfers (0 = free, growth-friendly)
}

export const DEFAULT_FEES: FeeSchedule = {
  withdrawalFeePercent: 1.0,
  withdrawalFeeMin: 0.49,
  cardIssuanceFee: 1.0,
  p2pFeePercent: 0,
};

const FEES_KEY = "fee_schedule";

export async function getFeeSchedule(): Promise<FeeSchedule> {
  const stored = await getSetting<Partial<FeeSchedule>>(FEES_KEY, {});
  return { ...DEFAULT_FEES, ...stored };
}

export async function setFeeSchedule(fees: FeeSchedule): Promise<void> {
  await setSetting(FEES_KEY, fees);
}

/** User-facing withdrawal fee for a given USD amount. */
export function withdrawalFee(amount: number, fees: FeeSchedule): number {
  return Math.max(fees.withdrawalFeeMin, amount * (fees.withdrawalFeePercent / 100));
}
