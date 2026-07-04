import { logger } from "./logger";
import { getPayoutProviderConfig, type PayoutProviderKey } from "./settings";

/**
 * Pluggable money-rails layer — every provider that moves value across the
 * fiat ↔ stablecoin boundary for S-PAY users:
 *   • OFF-RAMP (payout)  — USDC on Celo → local currency (M-Pesa, MoMo, PIX, SEPA, ACH…).
 *   • ON-RAMP  (deposit) — local currency / virtual account → USDC on Celo.
 *
 * Mirrors lib/wallet-providers.ts: a set of interchangeable providers, each
 * activated by its own env keys and switchable live from /admin/settings, with
 * corridor-aware routing so S-PAY is never locked to one partner.
 *
 * Why this exists: Noah was the first rail, but it charges onboarding/setup fees
 * and doesn't cover every corridor cheaply. This abstraction lets us add
 * usage-based, emerging-market-focused alternatives (Bridge, Conduit, Yellow
 * Card, Thunes) and route each deposit AND each payout to the best-configured
 * provider for its country — for deposits especially, so we can avoid Noah's
 * onboarding fee where another rail already serves the corridor.
 *
 * Honest by construction: a provider with no env keys reports `configured:
 * false`, and its createPayout / createDeposit throw the matching
 * NotConfiguredError — so callers return the same honest 503 the banking
 * endpoints already use, never a faked movement of money.
 *
 * Settlement target: every deposit settles to USDC in the user's own Celo
 * wallet (the single balance — there is no separate "virtual-account balance").
 * The virtual account / mobile-money collection is only the entry point; the
 * provider auto-converts to USDC and pushes it on-chain to the user's address.
 */

export class PayoutNotConfiguredError extends Error {
  constructor(public provider: PayoutProviderKey) {
    super(`Payout provider "${provider}" is not configured`);
  }
}

export class DepositNotConfiguredError extends Error {
  constructor(public provider: PayoutProviderKey) {
    super(`Deposit provider "${provider}" is not configured`);
  }
}

export class VirtualAccountNotConfiguredError extends Error {
  constructor(public provider: PayoutProviderKey) {
    super(`Virtual-account provider "${provider}" is not configured`);
  }
}

export class KycNotConfiguredError extends Error {
  constructor(public provider: PayoutProviderKey) {
    super(`KYC provider "${provider}" is not configured`);
  }
}

// ─── Off-ramp (payout) shapes ──────────────────────────────────────────────────

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

// ─── On-ramp (deposit) shapes ──────────────────────────────────────────────────

export interface DepositQuote {
  provider: PayoutProviderKey;
  sourceCurrency: string;   // local fiat the user funds with (KES, USD, EUR…)
  targetCurrency: "USDC";   // always settles to USDC on Celo
  method: string;           // mpesa | mtn_momo | pix | sepa | ach | bank_transfer | card | …
  rate: number;             // 1 sourceCurrency → N USDC (inverse of the payout rate)
  feePercent: number;       // provider + S-PAY margin, as a fraction (0.01 = 1%)
  estimatedArrival: string;
}

export interface DepositRequest {
  amountLocal: number;
  sourceCurrency: string;
  method: string;
  reference: string;            // S-PAY's id for reconciliation
  destinationAddress: string;   // the user's Celo wallet — where USDC settles
  payer?: Record<string, string>; // phone / bank details used to collect the funds
}

export interface DepositResult {
  depositId: string;
  provider: PayoutProviderKey;
  status: "pending" | "completed" | "failed";
  /** What the user does next to complete the on-ramp (STK push ref, bank
   *  details, hosted-checkout URL…). Provider-specific. */
  instructions?: string;
}

// ─── Virtual account (persistent fiat receiving account) shapes ────────────────

export interface VirtualAccountRequest {
  userId: string;
  currency: string;       // USD | EUR
  holderName: string;     // person, or businessName for business accounts
  country?: string;
}

export interface VirtualAccountDetails {
  provider: PayoutProviderKey;
  externalId?: string;
  currency: string;             // USD | EUR (we only offer USD/EUR accounts)
  accountType: "ach" | "iban";
  country?: string;
  holderName: string;
  bankName?: string;
  accountNumberMasked?: string; // last4 only
  routingNumber?: string;       // ACH
  ibanMasked?: string;          // masked IBAN
}

// ─── KYC / KYB (identity verification) shapes ──────────────────────────────────
// Most money-rail partners run their own hosted KYC/KYB (Noah, Bridge, Conduit,
// Yellow Card) — you don't build an identity stack, you point the user at the
// provider's hosted flow and they webhook the result back. Thunes is a payout
// network and leaves KYC to the integrating partner.

export interface KycStartRequest {
  userId: string;
  accountType: "personal" | "business";
  fullName: string;
  email: string;
  businessName?: string;
  country?: string;
}

export interface KycStartResult {
  provider: PayoutProviderKey;
  verificationUrl: string;  // the provider's hosted KYC/KYB page
  externalId?: string;      // provider customer id, to correlate the webhook
}

export interface MoneyRailProvider {
  key: PayoutProviderKey;
  label: string;
  /** Env vars that activate this provider (shown in the admin panel). */
  envHint: string;
  /** One-line note on commercial terms — onboarding-fee posture especially. */
  pricingNote: string;
  isConfigured(): boolean;

  // Off-ramp (payout)
  /** Can this provider settle USDC → the given currency + method? */
  supports(targetCurrency: string, method: string): boolean;
  quote(req: Pick<PayoutRequest, "amountUsd" | "targetCurrency" | "method">): PayoutQuote;
  createPayout(req: PayoutRequest): Promise<PayoutResult>;

  // On-ramp (deposit)
  /** Can this provider collect the given currency + method and settle USDC on Celo? */
  supportsDeposit(sourceCurrency: string, method: string): boolean;
  quoteDeposit(req: Pick<DepositRequest, "amountLocal" | "sourceCurrency" | "method">): DepositQuote;
  createDeposit(req: DepositRequest): Promise<DepositResult>;

  // Virtual accounts (persistent US ACH / EU IBAN — USD/EUR only)
  /** Can this provider issue a persistent virtual account in the given currency? */
  supportsVirtualAccount(currency: string): boolean;
  /** Issue (or fetch) a virtual account. Throws VirtualAccountNotConfiguredError until keys are set. */
  createVirtualAccount(req: VirtualAccountRequest): Promise<VirtualAccountDetails>;

  // KYC / KYB (identity verification)
  /** Does this provider run its own hosted KYC/KYB? */
  supportsKyc(): boolean;
  /** Start hosted verification; returns the URL to send the user to. Throws KycNotConfiguredError until keys are set. */
  startKyc(req: KycStartRequest): Promise<KycStartResult>;
}

/** USD → US ACH, EUR → EU IBAN. (We only offer USD/EUR virtual accounts.) */
export function accountTypeForCurrency(currency: string): "ach" | "iban" {
  return currency?.toUpperCase() === "EUR" ? "iban" : "ach";
}

/** The only currencies we issue virtual accounts in. */
export const VIRTUAL_ACCOUNT_CURRENCIES = new Set(["USD", "EUR"]);

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
  card: "Within 1 minute",
  bank_transfer: "1–2 business days", ach: "1–2 business days", wire: "1–2 business days",
};
const arrivalFor = (m: string) => ARRIVAL[m] ?? "Within 2 hours";

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

function makeDepositQuote(key: PayoutProviderKey, feePercent: number, req: { amountLocal: number; sourceCurrency: string; method: string }): DepositQuote {
  const fx = rateFor(req.sourceCurrency); // 1 USD → N local
  return {
    provider: key,
    sourceCurrency: req.sourceCurrency?.toUpperCase() ?? "USD",
    targetCurrency: "USDC",
    method: req.method,
    rate: fx > 0 ? 1 / fx : 1, // 1 local → N USDC
    feePercent,
    estimatedArrival: arrivalFor(req.method),
  };
}

// ─── Noah — incumbent global rail (note: charges onboarding fees) ──────────────
const NOAH_CURRENCIES = new Set(["KES", "NGN", "GHS", "UGX", "TZS", "RWF", "XAF", "ZAR", "PHP", "IDR", "BRL", "COP", "MXN", "EUR", "GBP", "USD"]);
const noahProvider: MoneyRailProvider = {
  key: "noah",
  label: "Noah",
  envHint: "NOAH_API_KEY, NOAH_WEBHOOK_SECRET",
  pricingNote: "Global coverage; charges onboarding/setup fees.",
  isConfigured: () => Boolean(process.env.NOAH_API_KEY),
  supports: (c) => NOAH_CURRENCIES.has(c?.toUpperCase()),
  quote: (req) => makeQuote("noah", 0.01, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("noah"); },
  supportsDeposit: (c) => NOAH_CURRENCIES.has(c?.toUpperCase()),
  quoteDeposit: (req) => makeDepositQuote("noah", 0.01, req),
  createDeposit: async () => { throw new DepositNotConfiguredError("noah"); },
  supportsVirtualAccount: (c) => VIRTUAL_ACCOUNT_CURRENCIES.has(c?.toUpperCase()),
  createVirtualAccount: async () => { throw new VirtualAccountNotConfiguredError("noah"); },
  supportsKyc: () => true, // Noah runs hosted KYC (individuals) + KYB (businesses)
  startKyc: async () => { throw new KycNotConfiguredError("noah"); },
};

// ─── Bridge (Stripe) — USD/EUR virtual accounts + stablecoin orchestration ─────
const bridgeProvider: MoneyRailProvider = {
  key: "bridge",
  label: "Bridge (Stripe)",
  envHint: "BRIDGE_API_KEY",
  pricingNote: "API-first stablecoin orchestration; usage-based, no setup fee. Strong on USD/EUR virtual accounts.",
  isConfigured: () => Boolean(process.env.BRIDGE_API_KEY),
  supports: (c, m) => ["USD", "EUR"].includes(c?.toUpperCase()) || ["ach", "sepa", "wire"].includes(m),
  quote: (req) => makeQuote("bridge", 0.005, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("bridge"); },
  // Bridge's core strength: issue a USD ACH / EU IBAN virtual account that
  // auto-converts inbound fiat to USDC. Best on-ramp for US/EU corridors.
  supportsDeposit: (c, m) => ["USD", "EUR"].includes(c?.toUpperCase()) || ["ach", "sepa", "wire", "card"].includes(m),
  quoteDeposit: (req) => makeDepositQuote("bridge", 0.005, req),
  createDeposit: async () => { throw new DepositNotConfiguredError("bridge"); },
  // Bridge's core product: issue USD ACH / EU IBAN accounts that auto-convert to
  // USDC. No onboarding fee → the preferred default virtual-account issuer.
  supportsVirtualAccount: (c) => VIRTUAL_ACCOUNT_CURRENCIES.has(c?.toUpperCase()),
  createVirtualAccount: async () => { throw new VirtualAccountNotConfiguredError("bridge"); },
  supportsKyc: () => true, // Bridge runs its own KYC/KYB for account issuance
  startKyc: async () => { throw new KycNotConfiguredError("bridge"); },
};

// ─── Conduit — cross-border B2B/marketplace payments (LatAm/Africa/Asia) ────────
const CONDUIT_CURRENCIES = new Set(["BRL", "MXN", "COP", "NGN", "KES", "GHS", "ZAR", "PHP", "IDR", "INR", "USD"]);
const conduitProvider: MoneyRailProvider = {
  key: "conduit",
  label: "Conduit",
  envHint: "CONDUIT_API_KEY",
  pricingNote: "Purpose-built for emerging-market collections + payouts; usage-based, no setup fee.",
  isConfigured: () => Boolean(process.env.CONDUIT_API_KEY),
  supports: (c) => CONDUIT_CURRENCIES.has(c?.toUpperCase()),
  quote: (req) => makeQuote("conduit", 0.008, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("conduit"); },
  supportsDeposit: (c) => CONDUIT_CURRENCIES.has(c?.toUpperCase()),
  quoteDeposit: (req) => makeDepositQuote("conduit", 0.008, req),
  createDeposit: async () => { throw new DepositNotConfiguredError("conduit"); },
  // Conduit issues USD accounts for cross-border businesses (its core
  // collections product) — a valid USD virtual-account issuer. It does not
  // issue EU IBANs, so EUR requests route to Bridge/Noah instead.
  supportsVirtualAccount: (c) => c?.toUpperCase() === "USD",
  createVirtualAccount: async () => { throw new VirtualAccountNotConfiguredError("conduit"); },
  supportsKyc: () => true, // Conduit runs KYB onboarding for its corridors
  startKyc: async () => { throw new KycNotConfiguredError("conduit"); },
};

// ─── Yellow Card — pan-African mobile money + bank (on- AND off-ramp) ───────────
const YELLOWCARD_CURRENCIES = new Set(["KES", "NGN", "GHS", "UGX", "TZS", "RWF", "XAF", "ZAR"]);
const yellowcardProvider: MoneyRailProvider = {
  key: "yellowcard",
  label: "Yellow Card",
  envHint: "YELLOWCARD_API_KEY, YELLOWCARD_API_SECRET",
  pricingNote: "Strongest African corridors (M-Pesa, MoMo) for both deposits and payouts; usage-based, no setup fee.",
  isConfigured: () => Boolean(process.env.YELLOWCARD_API_KEY),
  supports: (c) => YELLOWCARD_CURRENCIES.has(c?.toUpperCase()),
  quote: (req) => makeQuote("yellowcard", 0.009, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("yellowcard"); },
  supportsDeposit: (c) => YELLOWCARD_CURRENCIES.has(c?.toUpperCase()),
  quoteDeposit: (req) => makeDepositQuote("yellowcard", 0.009, req),
  createDeposit: async () => { throw new DepositNotConfiguredError("yellowcard"); },
  // African corridors are local-currency; we only offer USD/EUR accounts, so
  // Yellow Card is not a virtual-account issuer here.
  supportsVirtualAccount: () => false,
  createVirtualAccount: async () => { throw new VirtualAccountNotConfiguredError("yellowcard"); },
  supportsKyc: () => true, // Yellow Card runs KYC for its accounts
  startKyc: async () => { throw new KycNotConfiguredError("yellowcard"); },
};

// ─── Thunes — very broad global payout network (payout-first) ───────────────────
// Thunes is primarily a payout/disbursement network; its collection (deposit)
// coverage is narrower and enterprise-gated, so we expose payouts globally but
// do NOT advertise it as a deposit rail until that side is contracted.
const thunesProvider: MoneyRailProvider = {
  key: "thunes",
  label: "Thunes",
  envHint: "THUNES_API_KEY, THUNES_API_SECRET",
  pricingNote: "Widest global payout network; enterprise terms — confirm minimums. Payout-first (limited collections).",
  isConfigured: () => Boolean(process.env.THUNES_API_KEY),
  supports: () => true, // global payout coverage
  quote: (req) => makeQuote("thunes", 0.011, req),
  createPayout: async () => { throw new PayoutNotConfiguredError("thunes"); },
  supportsDeposit: () => false, // payout-first; collections not advertised
  quoteDeposit: (req) => makeDepositQuote("thunes", 0.011, req),
  createDeposit: async () => { throw new DepositNotConfiguredError("thunes"); },
  supportsVirtualAccount: () => false, // payout network, not an account issuer
  createVirtualAccount: async () => { throw new VirtualAccountNotConfiguredError("thunes"); },
  supportsKyc: () => false, // a payout network — KYC is left to the integrating partner
  startKyc: async () => { throw new KycNotConfiguredError("thunes"); },
};

// ─── Registry + routing ────────────────────────────────────────────────────────

const PROVIDERS: Record<PayoutProviderKey, MoneyRailProvider> = {
  noah: noahProvider,
  bridge: bridgeProvider,
  conduit: conduitProvider,
  yellowcard: yellowcardProvider,
  thunes: thunesProvider,
};

/** Static provider facts for the admin panel. */
export function payoutProviderCatalog(): Array<{
  key: PayoutProviderKey; label: string; configured: boolean; envHint: string;
  pricingNote: string; supportsDeposits: boolean; supportsVirtualAccounts: boolean;
  virtualAccountCurrencies: string[]; supportsKyc: boolean;
}> {
  // A provider "supports deposits" in general if it can on-ramp any corridor.
  const anyDeposit = (p: MoneyRailProvider) =>
    ["USD", "EUR", "KES", "NGN", "BRL", "GHS", "ZAR", "PHP"].some((c) => p.supportsDeposit(c, "bank_transfer") || p.supportsDeposit(c, "mpesa"));
  return Object.values(PROVIDERS).map((p) => ({
    key: p.key, label: p.label, configured: p.isConfigured(),
    envHint: p.envHint, pricingNote: p.pricingNote, supportsDeposits: anyDeposit(p),
    supportsVirtualAccounts: p.supportsVirtualAccount("USD") || p.supportsVirtualAccount("EUR"),
    // Which of the offered account currencies each rail can actually issue —
    // lets the admin UI say "USD + EUR" vs "USD only" instead of guessing.
    virtualAccountCurrencies: [...VIRTUAL_ACCOUNT_CURRENCIES].filter((c) => p.supportsVirtualAccount(c)),
    supportsKyc: p.supportsKyc(),
  }));
}

// The customer's net take-home per unit: how much local currency (payout) or
// USDC (deposit) reaches them after the provider's FX rate and fee. Routing
// maximizes this — the user always gets the best-priced rail and never sees
// which provider it was. The admin's `preferredProvider` is only a tiebreaker
// when two rails price identically.
const netRate = (rate: number, feePercent: number) => rate * (1 - feePercent);

function pickBest(
  eligible: MoneyRailProvider[],
  scoreOf: (p: MoneyRailProvider) => number,
  preferred: PayoutProviderKey,
): MoneyRailProvider {
  return eligible.reduce((best, p) => {
    const s = scoreOf(p);
    const bestScore = scoreOf(best);
    if (s > bestScore) return p;
    if (s === bestScore && p.key === preferred) return p; // tiebreak → admin preference
    return best;
  });
}

/**
 * Pick the payout provider that gives the CUSTOMER the best rate for a corridor,
 * among those an admin has enabled + that are configured + that support the
 * corridor. The provider is an internal routing decision — never surfaced to the
 * user. Returns null when nothing can serve it (caller answers with an honest
 * "cash-outs activating soon" 503).
 */
export async function selectPayoutProvider(targetCurrency: string, method: string): Promise<MoneyRailProvider | null> {
  const config = await getPayoutProviderConfig();
  const eligible = Object.values(PROVIDERS).filter(
    (p) => config.enabled[p.key] && p.isConfigured() && p.supports(targetCurrency, method),
  );
  if (eligible.length === 0) {
    logger.info({ targetCurrency, method }, "No configured payout provider for corridor");
    return null;
  }
  return pickBest(
    eligible,
    (p) => { const q = p.quote({ amountUsd: 1, targetCurrency, method }); return netRate(q.rate, q.feePercent); },
    config.preferredProvider,
  );
}

/**
 * Pick the deposit (on-ramp) provider that gives the CUSTOMER the best rate for a
 * corridor — evaluated against each provider's deposit coverage, so a deposit can
 * route to a cheaper, no-onboarding-fee rail (e.g. Yellow Card for M-Pesa, Bridge
 * for USD/EUR) instead of always Noah. The provider is never surfaced to the
 * user. Returns null when nothing can serve it (caller answers with an honest 503).
 */
export async function selectDepositProvider(sourceCurrency: string, method: string): Promise<MoneyRailProvider | null> {
  const config = await getPayoutProviderConfig();
  const eligible = Object.values(PROVIDERS).filter(
    (p) => config.enabled[p.key] && p.isConfigured() && p.supportsDeposit(sourceCurrency, method),
  );
  if (eligible.length === 0) {
    logger.info({ sourceCurrency, method }, "No configured deposit provider for corridor");
    return null;
  }
  return pickBest(
    eligible,
    (p) => { const q = p.quoteDeposit({ amountLocal: 1, sourceCurrency, method }); return netRate(q.rate, q.feePercent); },
    config.preferredProvider,
  );
}

/**
 * Pick the provider that issues a NEW virtual account for a currency. Unlike
 * deposits/withdrawals (re-routed per transaction), a virtual account is a
 * persistent identifier, so issuance honors the admin's designated issuer first
 * — if it's enabled, configured and can issue the currency — then falls back to
 * any enabled+configured issuer. Existing accounts are sticky to whoever issued
 * them; this only chooses the issuer for accounts not yet provisioned. Returns
 * null when nothing can issue (caller answers with an honest 503).
 */
export async function selectVirtualAccountIssuer(currency: string): Promise<MoneyRailProvider | null> {
  const config = await getPayoutProviderConfig();
  const eligible = (p: MoneyRailProvider) => config.enabled[p.key] && p.isConfigured() && p.supportsVirtualAccount(currency);

  const designated = PROVIDERS[config.virtualAccountIssuer];
  if (designated && eligible(designated)) return designated;

  const fallback = Object.values(PROVIDERS).find(eligible);
  if (!fallback) {
    logger.info({ currency }, "No configured virtual-account issuer for currency");
    return null;
  }
  return fallback;
}

/**
 * Pick the provider that runs identity verification (KYC/KYB). Like the
 * virtual-account issuer, this honors the admin's designated KYC provider first
 * (if enabled, configured and it runs KYC), then falls back to any enabled +
 * configured provider that does. Returns null when none can (honest 503).
 */
export async function selectKycProvider(): Promise<MoneyRailProvider | null> {
  const config = await getPayoutProviderConfig();
  const eligible = (p: MoneyRailProvider) => config.enabled[p.key] && p.isConfigured() && p.supportsKyc();

  const designated = PROVIDERS[config.kycProvider];
  if (designated && eligible(designated)) return designated;

  const fallback = Object.values(PROVIDERS).find(eligible);
  if (!fallback) {
    logger.info("No configured KYC provider");
    return null;
  }
  return fallback;
}

/** All providers that could pay out a corridor (configured + enabled), for quotes/comparison. */
export async function quotesForCorridor(targetCurrency: string, method: string, amountUsd: number): Promise<PayoutQuote[]> {
  const config = await getPayoutProviderConfig();
  return Object.values(PROVIDERS)
    .filter((p) => config.enabled[p.key] && p.isConfigured() && p.supports(targetCurrency, method))
    .map((p) => p.quote({ amountUsd, targetCurrency, method }));
}

/** All providers that could collect a deposit for a corridor, for quotes/comparison. */
export async function depositQuotesForCorridor(sourceCurrency: string, method: string, amountLocal: number): Promise<DepositQuote[]> {
  const config = await getPayoutProviderConfig();
  return Object.values(PROVIDERS)
    .filter((p) => config.enabled[p.key] && p.isConfigured() && p.supportsDeposit(sourceCurrency, method))
    .map((p) => p.quoteDeposit({ amountLocal, sourceCurrency, method }));
}
