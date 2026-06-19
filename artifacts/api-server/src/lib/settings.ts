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

export type WalletProviderKey = "privy" | "cdp" | "turnkey" | "openfort" | "thirdweb" | "dynamic";
export const WALLET_PROVIDER_KEYS: readonly WalletProviderKey[] =
  ["privy", "cdp", "turnkey", "openfort", "thirdweb", "dynamic"] as const;

export interface WalletProviderConfig {
  /** Provider used to create NEW wallets (existing wallets keep theirs). */
  activeProvider: WalletProviderKey;
  /** Per-provider on/off. OFF = no new wallets AND no sends signed via it. */
  enabled: Record<WalletProviderKey, boolean>;
}

const DEFAULT_WALLET_PROVIDERS: WalletProviderConfig = {
  activeProvider: "privy",
  enabled: { privy: true, cdp: true, turnkey: true, openfort: true, thirdweb: true, dynamic: true },
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

// ── Payout provider switches ──────────────────────────────────────────────────
// Which payout rail settles worker cash-outs / withdrawals, plus per-provider
// kill switches — toggled live from /admin/settings, same shape as the wallet
// providers. Lets S-PAY run several rails side-by-side and route by corridor,
// so it's never locked to a single partner (e.g. one charging onboarding fees).

export type PayoutProviderKey = "noah" | "bridge" | "conduit" | "yellowcard" | "thunes";
export const PAYOUT_PROVIDER_KEYS: readonly PayoutProviderKey[] =
  ["noah", "bridge", "conduit", "yellowcard", "thunes"] as const;

export interface PayoutProviderConfig {
  /** Preferred provider when more than one can serve a corridor. */
  preferredProvider: PayoutProviderKey;
  /** Per-provider on/off. OFF = never selected for a payout. */
  enabled: Record<PayoutProviderKey, boolean>;
}

const DEFAULT_PAYOUT_PROVIDERS: PayoutProviderConfig = {
  preferredProvider: "noah",
  enabled: { noah: true, bridge: true, conduit: true, yellowcard: true, thunes: true },
};

const PAYOUT_PROVIDERS_KEY = "payout_providers";

export async function getPayoutProviderConfig(): Promise<PayoutProviderConfig> {
  const stored = await getSetting<Partial<PayoutProviderConfig>>(PAYOUT_PROVIDERS_KEY, {});
  const preferred = PAYOUT_PROVIDER_KEYS.includes(stored.preferredProvider as PayoutProviderKey)
    ? (stored.preferredProvider as PayoutProviderKey)
    : DEFAULT_PAYOUT_PROVIDERS.preferredProvider;
  return {
    preferredProvider: preferred,
    enabled: { ...DEFAULT_PAYOUT_PROVIDERS.enabled, ...(stored.enabled ?? {}) },
  };
}

export async function setPayoutProviderConfig(update: {
  preferredProvider?: PayoutProviderKey;
  enabled?: Partial<Record<PayoutProviderKey, boolean>>;
}): Promise<PayoutProviderConfig> {
  const current = await getPayoutProviderConfig();
  const next: PayoutProviderConfig = {
    preferredProvider: update.preferredProvider ?? current.preferredProvider,
    enabled: { ...current.enabled, ...(update.enabled ?? {}) },
  };
  await setSetting(PAYOUT_PROVIDERS_KEY, next);
  return next;
}

// ── SocialConnect master switch ───────────────────────────────────────────────
// Celo SocialConnect maps off-chain identifiers (phone/email) → on-chain
// addresses via a decentralized registry, so a send can reach someone who
// isn't an S-PAY member yet. This flag only takes effect once the issuer env
// keys are set (see lib/socialconnect.ts + docs/SOCIALCONNECT.md); until then
// it's a no-op and the in-DB recipient lookup remains the single source of truth.

const SOCIALCONNECT_KEY = "socialconnect";

export interface SocialConnectState {
  enabled: boolean;
}

const DEFAULT_SOCIALCONNECT: SocialConnectState = { enabled: false };

export async function getSocialConnect(): Promise<SocialConnectState> {
  const stored = await getSetting<Partial<SocialConnectState>>(SOCIALCONNECT_KEY, {});
  return { ...DEFAULT_SOCIALCONNECT, ...stored };
}

export async function setSocialConnectEnabled(enabled: boolean): Promise<void> {
  await setSetting(SOCIALCONNECT_KEY, { enabled });
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
  p2pFeePercent: number;        // internal transfers — % component (0 = free, growth-friendly)
  // Per-transfer commission (your revenue; also covers the sub-cent on-chain
  // CELO gas you pay). Charged ON TOP of the send amount. Collected to
  // TREASURY_CELO_ADDRESS. Total fee = transferFeeFlat + amount*transferFeePercent/100.
  transferFeeFlat: number;      // flat USDC per transfer (e.g. 0.10)
}

export const DEFAULT_FEES: FeeSchedule = {
  withdrawalFeePercent: 1.0,
  withdrawalFeeMin: 0.49,
  cardIssuanceFee: 1.0,
  p2pFeePercent: 0,
  transferFeeFlat: 0,
};

/** Total transfer fee (commission) for a send amount, given the schedule. */
export function transferFee(amount: number, fees: FeeSchedule): number {
  const fee = fees.transferFeeFlat + amount * (fees.p2pFeePercent / 100);
  return Math.max(0, Math.round(fee * 1e6) / 1e6); // round to USDC's 6 decimals
}

/** Treasury wallet that collects transfer/withdrawal commissions. */
export function treasuryAddress(): string | null {
  const addr = process.env.TREASURY_CELO_ADDRESS?.trim();
  return addr && /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
}

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

// ── Site content (hero, footer, colours) ──────────────────────────────────────
// Marketing copy an admin edits live from /admin/settings — no deploy. The
// public GET /site-content endpoint serves it to the landing page and footer.

export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  announcement: string;     // empty = no announcement ribbon
  footerTagline: string;
  primaryColor: string;     // brand primary (hex)
  accentColor: string;      // brand accent (hex)
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  heroTitle: "Get paid like a local, anywhere on Earth",
  heroSubtitle: "Your digital dollar account: receive bank transfers, hold USD, and cash out to M-Pesa, MoMo, PIX & more — in minutes.",
  heroCta: "Open your free account",
  announcement: "",
  footerTagline: "The digital money super app for remote workers and businesses.",
  primaryColor: "#4DC9EE",
  accentColor: "#1A2B4A",
};

const SITE_CONTENT_KEY = "site_content";

export async function getSiteContent(): Promise<SiteContent> {
  const stored = await getSetting<Partial<SiteContent>>(SITE_CONTENT_KEY, {});
  return { ...DEFAULT_SITE_CONTENT, ...stored };
}

export async function setSiteContent(update: Partial<SiteContent>): Promise<SiteContent> {
  const current = await getSiteContent();
  const next = { ...current, ...update };
  await setSetting(SITE_CONTENT_KEY, next);
  return next;
}
