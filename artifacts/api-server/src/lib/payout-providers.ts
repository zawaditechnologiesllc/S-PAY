import { logger } from "./logger";
import { getPayoutProviderConfig, type PayoutProviderKey } from "./settings";

/**
 * Pluggable payout layer — the local-currency cash-out rails workers withdraw
 * to (M-Pesa, MoMo, PIX, SEPA, ACH…). Mirrors lib/wallet-providers.ts: a set of
 * interchangeable providers, each activated by its own env keys and switchable
 * live from /admin/settings, with corridor-aware routing so S-PAY is never
 * locked to one partner.
 *
 * Why this exists: Noah was the first rail, but it charges onboarding fees and
 * doesn't cover every corridor cheaply. This abstraction lets us add fee-free,
 * emerging-market-focused alternatives (Bridge, Conduit, Yellow Card, Thunes)
 * and route each payout to the best-configured provider for its country.
 *
 * Honest by construction: a provider with no env keys reports `configured:
 * false` and its createPayout throws PayoutNotConfiguredError, so callers return
 * the same honest 503 the banking endpoints already use — never a faked payout.
 */

export class PayoutNotConfiguredError extends Error {
  constructor(public provider: PayoutProviderKey) {
    super(`Payout provider "${provider}" is not configured`);
  }
}

export interface PayoutQuote {
  provider: PayoutProviderKey;
  sourceCurrency: string;   // always a USD stablecoin (USDC/USDT)
  targetCurrency: string;
  method: string;
  rate: number;             // 1 USD → N targetCurrency
  feePercent: number;       // provider + S-PAY margin, as a fraction (0.01 = 1%)
  estimatedArrival: string;
}

export interface PayoutRequest {
  amountUsd: number;
  targetCurrency: string;
  method: string;           // mpesa | mtn_momo | pix | sepa | ach | bank_transfer | …
  destination: Record<string, string>; // phone / accountNumber / iban …
  reference: string;        // S-PAY's id for reconciliation
}

export interface PayoutResult {
  payoutId: string;
  provider: PayoutProviderKey;
  status: "pending" | "completed" | "failed";
}

export interface PayoutProvider {
  key: PayoutProviderKey;
  label: string;
  /** Env vars that activate this provider (shown in the admin panel). */
  envHint: string;
  /** One-line note on commercial terms — onboarding-fee posture especially. */
  pricingNote: string;
  isConfigured(): boolean;
  /** Can this provider settle to the given currency + method? */
  supports(targetCurrency: string, method: string): boolean;
  quote(req: Pick<PayoutRequest, "amountUsd" | "targetCurrency" | "method">): PayoutQuote;
  createPayout(req: PayoutRequest): Promise<PayoutResult>;
}

// Indicative FX rates (stablecoin base). Shared with banking.ts's table; live
// quotes replace these once a provider key is configured.
const RATES: Record<string, number> = {
  KES: 131.5, NGN: 1610, GHS: 15.4, UGX: 3720, TZS: 2660, RWF: 1380, XAF: 600,
  ZAR: 18.2, PHP: 58.5, IDR: 16200, INR: 83.3, BRL: 5.1, COP: 4150, MXN: 18.6,
  EUR: 0.92, GBP: 0.79, USD: 1.0,
};
const rateFor = (c: string) => RATES[c?.toUpperCase()] ?? 1.0;

const ARRIVAL: Record<string, string> = {
  mpesa: "Within 1 minute", mtn_momo: "Within 1 minute", momo: "Within 1 minute",
  gcash: "Within 1 minute", gopay: "Within 1 minute", upi: "Within 1 minute",
  pix: "Within 1 minute", nequi: "Within 5 minutes", spei: "Same day",
  sepa: "Same day – next business day", faster_payments: "Within 2 hours",
  bank_transfer: "1–2 business days", ach: "1–2 business days", wire: "1–2 business days",
};
const arrivalFor = (m: string) => ARRIVAL[m] ?? "Within 2 hours";

// Per-provider corridor strengths. "*" = currency-agnostic for that provider.
function makeQuote(key: PayoutProviderKey, feePercent: number, req: { amountUsd: number; targetCurrency: string; method: string }): PayoutQuote {
  return {
    provider: key,
    sourceCurrency: "USDC",
    targetCurrency: req.targetCurrency?.toUpperCase() ?? "USD",
    method: req.method,
    rate: rateFor(req.targetCurrency),
    feePercent,
    estimatedArrival: arrivalFor(req.method),
  };
}

// ─── Noah — incumbent global rail (note: charges onboarding fees) ──────────────
const NOAH_CURRENCIES = new Set(["KES", "NGN", "GHS", "UGX", "TZS", "RWF", "XAF", "ZAR", "PHP", "IDR", "BRL", "COP", "MXN", "EUR", "GBP", "USD"]);
const noahProvider: PayoutProvider = {
  key: "noah",
  label: "Noah",
  envHint: "NOAH_API_KEY, NOAH_WEBHOOK_SECRET",
  pricingNote: "Global coverage; charges onboarding/setup fees.",
  isConfigured: () => Boolean(process.env.NOAH_API_KEY),
  supports: (c) => NOAH_CURRENCIES.has(c?.toUpperCase()),
  quote: (req) => makeQuote("noah", 0.01, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("noah"); },
};

// ─── Bridge (Stripe) — USD/EUR virtual accounts + stablecoin orchestration ─────
const bridgeProvider: PayoutProvider = {
  key: "bridge",
  label: "Bridge (Stripe)",
  envHint: "BRIDGE_API_KEY",
  pricingNote: "API-first stablecoin orchestration; usage-based, no setup fee.",
  isConfigured: () => Boolean(process.env.BRIDGE_API_KEY),
  supports: (c, m) => ["USD", "EUR"].includes(c?.toUpperCase()) || ["ach", "sepa", "wire"].includes(m),
  quote: (req) => makeQuote("bridge", 0.005, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("bridge"); },
};

// ─── Conduit — cross-border B2B/marketplace payouts (LatAm/Africa/Asia) ────────
const CONDUIT_CURRENCIES = new Set(["BRL", "MXN", "COP", "NGN", "KES", "GHS", "ZAR", "PHP", "IDR", "INR", "USD"]);
const conduitProvider: PayoutProvider = {
  key: "conduit",
  label: "Conduit",
  envHint: "CONDUIT_API_KEY",
  pricingNote: "Purpose-built for emerging-market payouts; usage-based, no setup fee.",
  isConfigured: () => Boolean(process.env.CONDUIT_API_KEY),
  supports: (c) => CONDUIT_CURRENCIES.has(c?.toUpperCase()),
  quote: (req) => makeQuote("conduit", 0.008, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("conduit"); },
};

// ─── Yellow Card — pan-African mobile money + bank ─────────────────────────────
const YELLOWCARD_CURRENCIES = new Set(["KES", "NGN", "GHS", "UGX", "TZS", "RWF", "XAF", "ZAR"]);
const yellowcardProvider: PayoutProvider = {
  key: "yellowcard",
  label: "Yellow Card",
  envHint: "YELLOWCARD_API_KEY, YELLOWCARD_API_SECRET",
  pricingNote: "Strongest African corridors (M-Pesa, MoMo); usage-based, no setup fee.",
  isConfigured: () => Boolean(process.env.YELLOWCARD_API_KEY),
  supports: (c) => YELLOWCARD_CURRENCIES.has(c?.toUpperCase()),
  quote: (req) => makeQuote("yellowcard", 0.009, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("yellowcard"); },
};

// ─── Thunes — very broad global mobile-wallet + bank network ───────────────────
const thunesProvider: PayoutProvider = {
  key: "thunes",
  label: "Thunes",
  envHint: "THUNES_API_KEY, THUNES_API_SECRET",
  pricingNote: "Widest global payout network; enterprise terms — confirm minimums.",
  isConfigured: () => Boolean(process.env.THUNES_API_KEY),
  supports: () => true, // global coverage
  quote: (req) => makeQuote("thunes", 0.011, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("thunes"); },
};

// ─── Registry + routing ────────────────────────────────────────────────────────

const PROVIDERS: Record<PayoutProviderKey, PayoutProvider> = {
  noah: noahProvider,
  bridge: bridgeProvider,
  conduit: conduitProvider,
  yellowcard: yellowcardProvider,
  thunes: thunesProvider,
};

/** Static provider facts for the admin panel. */
export function payoutProviderCatalog(): Array<{
  key: PayoutProviderKey; label: string; configured: boolean; envHint: string; pricingNote: string;
}> {
  return Object.values(PROVIDERS).map((p) => ({
    key: p.key, label: p.label, configured: p.isConfigured(), envHint: p.envHint, pricingNote: p.pricingNote,
  }));
}

/**
 * Pick the best provider for a corridor: the admin's preferred one if it's
 * enabled, configured and supports the corridor; otherwise the first enabled +
 * configured provider that supports it. Returns null when nothing can serve it
 * (caller answers with an honest "cash-outs activating soon" 503).
 */
export async function selectPayoutProvider(targetCurrency: string, method: string): Promise<PayoutProvider | null> {
  const config = await getPayoutProviderConfig();
  const eligible = (p: PayoutProvider) => config.enabled[p.key] && p.isConfigured() && p.supports(targetCurrency, method);

  const preferred = PROVIDERS[config.preferredProvider];
  if (preferred && eligible(preferred)) return preferred;

  const fallback = Object.values(PROVIDERS).find(eligible);
  if (!fallback) {
    logger.info({ targetCurrency, method }, "No configured payout provider for corridor");
    return null;
  }
  return fallback;
}

/** All providers that could serve a corridor (configured + enabled), for quotes/comparison. */
export async function quotesForCorridor(targetCurrency: string, method: string, amountUsd: number): Promise<PayoutQuote[]> {
  const config = await getPayoutProviderConfig();
  return Object.values(PROVIDERS)
    .filter((p) => config.enabled[p.key] && p.isConfigured() && p.supports(targetCurrency, method))
    .map((p) => p.quote({ amountUsd, targetCurrency, method }));
}
