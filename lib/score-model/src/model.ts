/**
 * S-PAY Score model (v1) — a 300–850 financial-reliability score for personal
 * AND business accounts, computed only from a member's own S-PAY activity.
 *
 * Pure and deterministic: signals in → score out. No I/O, no clock reads, so
 * the API, unit tests and any future partner audit reproduce the exact same
 * number from a stored snapshot's signals + model version.
 *
 *   score = 300 + Σ round(550 × weight × factorValue)        factorValue ∈ [0, 1]
 *
 * Five factors, weighted per account type (see SCORE_WEIGHTS). Factors with no
 * data yet start from a neutral value instead of zero, so a brand-new member is
 * "Building" — not punished — and grows with real activity.
 */

export const SCORE_MODEL_VERSION = "spay-score-v1";
/** Version of the Score Data Notice a member accepts when changing consent. */
export const SCORE_CONSENT_VERSION = "2026-10";
/** Planned earliest year licensed financial partners may use opted-in scores. */
export const SCORE_PARTNER_SHARING_TARGET_YEAR = 2031;

export const SCORE_MIN = 300;
export const SCORE_MAX = 850;
const SCORE_SPAN = SCORE_MAX - SCORE_MIN;

export type ScoreAccountType = "personal" | "business";
export type ScoreFactorKey = "identity" | "history" | "payments" | "income" | "health";
export type ScoreBandKey = "building" | "good" | "great" | "excellent";
export type ScoreFactorStatus = "strong" | "fair" | "weak" | "no_data";

export const SCORE_FACTOR_KEYS: readonly ScoreFactorKey[] = ["identity", "history", "payments", "income", "health"];

/** Factor weights per account type. Each row sums to 1. */
export const SCORE_WEIGHTS: Record<ScoreAccountType, Record<ScoreFactorKey, number>> = {
  personal: { identity: 0.2, history: 0.2, payments: 0.2, income: 0.25, health: 0.15 },
  business: { identity: 0.2, history: 0.2, payments: 0.3, income: 0.15, health: 0.15 },
};

export const SCORE_FACTOR_LABELS: Record<ScoreAccountType, Record<ScoreFactorKey, string>> = {
  personal: {
    identity: "Identity & security",
    history: "Account history",
    payments: "Payment behaviour",
    income: "Income stability",
    health: "Balance health",
  },
  business: {
    identity: "Business verification",
    history: "Business history",
    payments: "Payroll & payment reliability",
    income: "Cash flow",
    health: "Float & balance health",
  },
};

export interface ScoreBand {
  key: ScoreBandKey;
  label: string;
  min: number;
  max: number;
  /** Ordinal one-hue ramp (light surfaces), validated light→dark; marks only, never text. */
  color: string;
  summary: string;
}

export const SCORE_BANDS: readonly ScoreBand[] = [
  { key: "building", label: "Building", min: 300, max: 549, color: "#86B6EF", summary: "You're getting started — every verified step and clean payment moves you up." },
  { key: "good", label: "Good", min: 550, max: 649, color: "#5598E7", summary: "A solid record. You've crossed S-PAY's trusted-member threshold (550)." },
  { key: "great", label: "Great", min: 650, max: 749, color: "#256ABF", summary: "Consistent, verified and reliable — well above most new members." },
  { key: "excellent", label: "Excellent", min: 750, max: 850, color: "#104281", summary: "A long, clean track record. The strongest standing on S-PAY." },
];

/** Score at which a member counts as a "trusted member" (same idea as a deposit-free threshold). */
export const SCORE_TRUSTED_THRESHOLD = 550;

export function bandFor(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min && score <= b.max) ?? (score < SCORE_MIN ? SCORE_BANDS[0] : SCORE_BANDS[SCORE_BANDS.length - 1]);
}

export function nextBand(score: number): ScoreBand | null {
  return SCORE_BANDS.find((b) => b.min > score) ?? null;
}

// ── Inputs ─────────────────────────────────────────────────────────────────────

/** Payroll aggregates for a business that runs S-PAY Payroll (live batches only, last 6 months). */
export interface EmployerSignals {
  status: "pending" | "verified" | "rejected" | "suspended";
  balance: number;            // prepaid USDC float right now
  batchesSubmitted6: number;  // live batches submitted
  batchesFailed6: number;     // batches that paid nobody
  paymentsCompleted6: number;
  paymentsFailed6: number;
  payrollMonths6: number;     // distinct months (of 6) with a completed batch
  avgBatchCost6: number;      // average batch total incl. fees
}

/**
 * Aggregate inputs — counts and sums only, never individual transactions or
 * counterparties. Stored verbatim with each monthly snapshot for explainability.
 */
export interface ScoreSignals {
  accountType: ScoreAccountType;
  kycStatus: "pending" | "approved" | "rejected";
  emailVerified: boolean;
  hasPhone: boolean;
  hasCountry: boolean;
  pinSet: boolean;
  hasBusinessName: boolean;
  accountAgeDays: number;
  activeMonths12: number;     // distinct months (of 12) with a completed transaction
  completedTx90: number;
  failedTx90: number;
  incomingMonths6: number;    // distinct months (of 6) with money received
  incomingTotal6: number;     // USD received, last 6 months
  outgoingTotal6: number;     // USD sent / withdrawn / spent, last 6 months
  distinctPayers6: number;    // how many different payers (a count — never who)
  payrollReceived6: number;   // employer payroll payments received
  employer: EmployerSignals | null;
}

/**
 * A worked example for marketing pages (six months in: verified, paid monthly
 * by two clients, clean payments, 10% buffer). Pages run it through
 * computeScore() so the number shown is always what the engine produces.
 */
export const SCORE_EXAMPLE_SIGNALS: ScoreSignals = {
  accountType: "personal", kycStatus: "approved", emailVerified: true, hasPhone: true, hasCountry: true,
  pinSet: true, hasBusinessName: false, accountAgeDays: 180, activeMonths12: 6, completedTx90: 18, failedTx90: 0,
  incomingMonths6: 6, incomingTotal6: 4200, outgoingTotal6: 3780, distinctPayers6: 2, payrollReceived6: 3, employer: null,
};

// ── Outputs ────────────────────────────────────────────────────────────────────

export interface ScoreFactorResult {
  key: ScoreFactorKey;
  label: string;
  weight: number;       // 0–1
  value: number;        // 0–100
  points: number;       // score points this factor contributes
  maxPoints: number;    // the most it can contribute
  status: ScoreFactorStatus;
  detail: string;       // plain-language "why"
}

export interface ScoreResult {
  score: number;
  band: ScoreBand;
  accountType: ScoreAccountType;
  modelVersion: string;
  factors: ScoreFactorResult[];
}

export interface ScoreImprovement {
  key: string;
  factor: ScoreFactorKey;
  title: string;
  description: string;
  /** Estimated score gain from doing this, simulated through the model. null = builds over time. */
  estimatedPoints: number | null;
  /** In-app destination. "kyc" / "email" are special actions the client starts itself. */
  action: { kind: "link"; href: string } | { kind: "kyc" } | { kind: "email" } | null;
}

// ── Model ──────────────────────────────────────────────────────────────────────

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const logScale = (v: number, target: number): number => (v <= 0 ? 0 : clamp01(Math.log10(1 + v) / Math.log10(1 + target)));
/**
 * Small samples prove little: blend a factor toward its neutral prior until
 * there's enough evidence (confidence 1), so one lucky — or unlucky —
 * transaction can't swing the score.
 */
const shrink = (value: number, confidence: number, prior: number): number => {
  const c = clamp01(confidence);
  return clamp01(prior + c * (value - prior));
};
const pct = (n: number): string => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

interface FactorValue { value: number; noData: boolean; detail: string }

function retention(s: ScoreSignals): number {
  return s.incomingTotal6 > 0 ? clamp01((s.incomingTotal6 - s.outgoingTotal6) / s.incomingTotal6) : 0;
}

function identity(s: ScoreSignals): FactorValue {
  const kyc = s.kycStatus === "approved";
  const parts: string[] = [];
  let v: number;
  if (s.accountType === "business") {
    const employerVerified = s.employer?.status === "verified";
    v = (kyc ? 0.45 : 0) + (s.emailVerified ? 0.1 : 0) + (s.hasPhone ? 0.1 : 0) + (s.pinSet ? 0.15 : 0)
      + (s.hasBusinessName ? 0.05 : 0) + (employerVerified ? 0.15 : 0);
    parts.push(kyc ? "Business verified (KYB)" : s.kycStatus === "rejected" ? "Business verification declined" : "Business not verified yet");
    if (employerVerified) parts.push("payroll employer verified");
  } else {
    v = (kyc ? 0.55 : 0) + (s.emailVerified ? 0.15 : 0) + (s.hasPhone ? 0.1 : 0) + (s.pinSet ? 0.15 : 0) + (s.hasCountry ? 0.05 : 0);
    parts.push(kyc ? "Identity verified" : s.kycStatus === "rejected" ? "Identity verification declined" : "Identity not verified yet");
  }
  parts.push(s.emailVerified ? "email confirmed" : "email not confirmed");
  parts.push(s.pinSet ? "PIN set" : "no PIN");
  return { value: clamp01(v), noData: false, detail: parts.join(" · ") };
}

function history(s: ScoreSignals): FactorValue {
  const months = Math.floor(s.accountAgeDays / 30);
  const age = months < 1 ? "Joined this month" : `Member for ${months >= 24 ? `${Math.floor(months / 12)} years` : plural(months, "month")}`;
  return {
    value: clamp01(clamp01(s.accountAgeDays / 730) * 0.6 + clamp01(s.activeMonths12 / 12) * 0.4),
    noData: false,
    detail: `${age} · active ${s.activeMonths12} of the last 12 months`,
  };
}

function transactionBehaviour(s: ScoreSignals): FactorValue {
  const total = s.completedTx90 + s.failedTx90;
  if (total === 0) return { value: 0.35, noData: true, detail: "No transactions in the last 90 days yet" };
  const reliability = s.completedTx90 / total;
  return {
    value: shrink(reliability ** 2 * 0.6 + clamp01(s.completedTx90 / 20) * 0.4, total / 10, 0.35),
    noData: false,
    detail: `${s.completedTx90} completed, ${s.failedTx90} failed in the last 90 days (${pct(reliability)} success)`,
  };
}

function payments(s: ScoreSignals): FactorValue {
  const e = s.employer;
  if (s.accountType !== "business" || !e || e.batchesSubmitted6 === 0) return transactionBehaviour(s);
  const paid = e.paymentsCompleted6 + e.paymentsFailed6;
  const success = paid > 0 ? e.paymentsCompleted6 / paid : 1;
  const batchOk = (e.batchesSubmitted6 - e.batchesFailed6) / e.batchesSubmitted6;
  return {
    value: shrink(success ** 2 * 0.5 + clamp01(batchOk) * 0.2 + clamp01(e.payrollMonths6 / 6) * 0.3, e.batchesSubmitted6 / 3, 0.35),
    noData: false,
    detail: `${plural(e.batchesSubmitted6, "payroll batch", "payroll batches")} · ${pct(success)} of worker payments succeeded · payroll in ${e.payrollMonths6} of 6 months`,
  };
}

function income(s: ScoreSignals): FactorValue {
  if (s.incomingMonths6 === 0 && s.incomingTotal6 <= 0) {
    return { value: 0.2, noData: true, detail: s.accountType === "business" ? "No incoming business payments in the last 6 months yet" : "No income received in the last 6 months yet" };
  }
  const months = clamp01(s.incomingMonths6 / 6);
  const v = s.accountType === "business"
    ? months * 0.55 + clamp01(s.distinctPayers6 / 5) * 0.25 + logScale(s.incomingTotal6, 50_000) * 0.2
    : months * 0.5 + clamp01(s.distinctPayers6 / 3) * 0.2 + clamp01(s.payrollReceived6 / 3) * 0.15 + logScale(s.incomingTotal6, 5_000) * 0.15;
  return {
    value: clamp01(v),
    noData: false,
    detail: `Paid in ${s.incomingMonths6} of the last 6 months by ${plural(s.distinctPayers6, "payer")}`,
  };
}

function health(s: ScoreSignals): FactorValue {
  const e = s.employer;
  if (s.accountType === "business" && e && e.batchesSubmitted6 > 0 && e.avgBatchCost6 > 0) {
    const coverage = e.balance / e.avgBatchCost6;
    return {
      value: clamp01(0.4 + 0.6 * clamp01(coverage)),
      noData: false,
      detail: `Payroll float covers ${coverage.toFixed(1)}× your average batch`,
    };
  }
  if (s.incomingTotal6 <= 0) return { value: 0.4, noData: true, detail: "Not enough money-in history yet" };
  const kept = retention(s);
  // Cashing out everything is normal (and never scored below the no-data
  // neutral); keeping a 20% buffer earns full marks once there are 3 months.
  return {
    value: shrink(0.5 + 0.5 * clamp01(kept / 0.2), s.incomingMonths6 / 3, 0.4),
    noData: false,
    detail: `You kept ${pct(kept)} of what came in over the last 6 months`,
  };
}

const FACTOR_FNS: Record<ScoreFactorKey, (s: ScoreSignals) => FactorValue> = { identity, history, payments, income, health };

/**
 * Split `total` whole points across raw shares (largest-remainder method) so the
 * per-factor points always add up exactly to the score, never past a factor's cap.
 */
function allocate(raw: number[], total: number, caps: number[]): number[] {
  const out = raw.map((r, i) => Math.min(Math.floor(r), caps[i]));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  while (left > 0) {
    const slot = order.find(({ i }) => out[i] < caps[i]);
    if (!slot) break;
    out[slot.i] += 1;
    left -= 1;
    order.push(order.splice(order.indexOf(slot), 1)[0]); // round-robin once a slot is used
  }
  return out;
}

export function computeScore(s: ScoreSignals): ScoreResult {
  const weights = SCORE_WEIGHTS[s.accountType];
  const labels = SCORE_FACTOR_LABELS[s.accountType];
  const evaluated = SCORE_FACTOR_KEYS.map((key) => ({ key, ...FACTOR_FNS[key](s) }));

  const maxRaw = SCORE_FACTOR_KEYS.map((k) => SCORE_SPAN * weights[k]);
  const maxPoints = allocate(maxRaw, SCORE_SPAN, maxRaw.map(Math.ceil));
  const raw = evaluated.map((f, i) => maxRaw[i] * f.value);
  const total = Math.round(raw.reduce((a, b) => a + b, 0));
  const points = allocate(raw, total, maxPoints);

  const factors = evaluated.map((f, i): ScoreFactorResult => {
    const value = Math.round(f.value * 100);
    return {
      key: f.key,
      label: labels[f.key],
      weight: weights[f.key],
      value,
      points: points[i],
      maxPoints: maxPoints[i],
      status: f.noData ? "no_data" : value >= 75 ? "strong" : value >= 45 ? "fair" : "weak",
      detail: f.detail,
    };
  });
  const score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, SCORE_MIN + factors.reduce((sum, f) => sum + f.points, 0)));
  return { score, band: bandFor(score), accountType: s.accountType, modelVersion: SCORE_MODEL_VERSION, factors };
}

// ── Improvement plan ───────────────────────────────────────────────────────────
// Every estimate is simulated through the model itself (score with the change
// minus score today), so "+40 pts" is what the engine would actually give.

interface Candidate extends Omit<ScoreImprovement, "estimatedPoints"> {
  when: boolean;
  simulate?: (s: ScoreSignals) => ScoreSignals;
}

export function improvementPlan(s: ScoreSignals, current: ScoreResult = computeScore(s)): ScoreImprovement[] {
  const biz = s.accountType === "business";
  const e = s.employer;
  const kept = retention(s);
  const historyFactor = current.factors.find((f) => f.key === "history");

  const candidates: Candidate[] = [
    {
      key: "verify_identity", factor: "identity", when: s.kycStatus !== "approved",
      title: biz ? "Verify your business (KYB)" : "Verify your identity",
      description: biz
        ? "The single biggest boost. Business verification also unlocks company-name bank accounts and live payroll."
        : "The single biggest boost. A quick ID + selfie check that also unlocks your US & EU bank accounts and cash-outs.",
      action: { kind: "kyc" }, simulate: (x) => ({ ...x, kycStatus: "approved" }),
    },
    {
      key: "confirm_email", factor: "identity", when: !s.emailVerified,
      title: "Confirm your email", description: "Tap the link we emailed you — it proves the account is really yours.",
      action: { kind: "email" }, simulate: (x) => ({ ...x, emailVerified: true }),
    },
    {
      key: "set_pin", factor: "identity", when: !s.pinSet,
      title: "Set a transaction PIN", description: "A PIN protects every send and withdrawal — secure accounts score higher.",
      action: { kind: "link", href: "/security" }, simulate: (x) => ({ ...x, pinSet: true }),
    },
    {
      key: "add_phone", factor: "identity", when: !s.hasPhone,
      title: "Add your phone number", description: "A reachable phone number strengthens your profile and lets people pay you by number.",
      action: { kind: "link", href: "/profile" }, simulate: (x) => ({ ...x, hasPhone: true }),
    },
    {
      key: "add_country", factor: "identity", when: !biz && !s.hasCountry,
      title: "Add your country", description: "Completes your profile and tailors cash-out options to where you live.",
      action: { kind: "link", href: "/profile" }, simulate: (x) => ({ ...x, hasCountry: true }),
    },
    {
      key: "add_business_name", factor: "identity", when: biz && !s.hasBusinessName,
      title: "Add your registered business name", description: "Your legal business name goes on your company bank accounts and payroll.",
      action: { kind: "link", href: "/profile" }, simulate: (x) => ({ ...x, hasBusinessName: true }),
    },
    {
      key: "setup_payroll", factor: "payments", when: biz && !e,
      title: "Pay your team with S-PAY Payroll",
      description: "Businesses that run payroll on S-PAY are scored on payroll reliability — the strongest business signal.",
      action: { kind: "link", href: "/payroll" },
    },
    {
      key: "verify_employer", factor: "identity", when: biz && !!e && e.status !== "verified",
      title: "Get your payroll employer verified", description: "A verified employer profile counts toward Business verification.",
      action: { kind: "link", href: "/payroll" },
      simulate: (x) => (x.employer ? { ...x, employer: { ...x.employer, status: "verified" } } : x),
    },
    {
      key: "payroll_float", factor: "health",
      when: biz && !!e && e.batchesSubmitted6 > 0 && e.avgBatchCost6 > 0 && e.balance < e.avgBatchCost6,
      title: "Keep enough float for your next payroll", description: "Top up your payroll balance so it covers at least one average batch.",
      action: { kind: "link", href: "/payroll" },
      simulate: (x) => (x.employer ? { ...x, employer: { ...x.employer, balance: x.employer.avgBatchCost6 } } : x),
    },
    {
      key: "payroll_accuracy", factor: "payments", when: biz && !!e && e.paymentsFailed6 > 0,
      title: "Keep worker payment details accurate", description: "Failed worker payments pull reliability down — validate emails, phones and S-PAY IDs before submitting.",
      action: { kind: "link", href: "/payroll/batches" },
      simulate: (x) => (x.employer ? { ...x, employer: { ...x.employer, paymentsCompleted6: x.employer.paymentsCompleted6 + x.employer.paymentsFailed6, paymentsFailed6: 0 } } : x),
    },
    {
      key: "payroll_schedule", factor: "payments", when: biz && !!e && e.batchesSubmitted6 > 0 && e.payrollMonths6 < 6,
      title: "Run payroll on a regular schedule", description: "Paying your team every month shows steady, predictable operations.",
      action: { kind: "link", href: "/payroll" },
      simulate: (x) => (x.employer ? { ...x, employer: { ...x.employer, payrollMonths6: Math.min(6, x.employer.payrollMonths6 + 1) } } : x),
    },
    {
      key: "monthly_income", factor: "income", when: s.incomingMonths6 < 6,
      title: biz ? "Collect client payments into S-PAY every month" : "Get paid into S-PAY every month",
      description: biz
        ? "Share your company USD/EUR account details with customers — regular monthly cash flow is the strongest income signal."
        : "Share your US/EU account details or S-PAY ID with clients — income arriving every month is the strongest signal.",
      action: { kind: "link", href: "/banking" },
      simulate: (x) => {
        // One more month paid like the months so far, cashed out at the same
        // rate (a typical 90% when there's no history yet).
        const incoming = x.incomingTotal6 > 0 ? x.incomingTotal6 * (1 + 1 / Math.max(1, x.incomingMonths6)) : 200;
        const outShare = x.incomingTotal6 > 0 ? x.outgoingTotal6 / x.incomingTotal6 : 0.9;
        return {
          ...x,
          incomingMonths6: Math.min(6, x.incomingMonths6 + 1),
          incomingTotal6: incoming,
          outgoingTotal6: incoming * outShare,
          distinctPayers6: Math.max(1, x.distinctPayers6),
          completedTx90: x.completedTx90 + 2,
        };
      },
    },
    {
      key: "more_payers", factor: "income", when: s.incomingMonths6 > 0 && s.distinctPayers6 < (biz ? 5 : 3),
      title: biz ? "Diversify your customers" : "Receive from more than one client",
      description: "Income from several sources is more stable than relying on just one.",
      action: { kind: "link", href: "/banking" }, simulate: (x) => ({ ...x, distinctPayers6: x.distinctPayers6 + 1 }),
    },
    {
      key: "avoid_failed", factor: "payments", when: s.failedTx90 > 0,
      title: "Avoid failed transactions",
      description: "Double-check the recipient and your balance before sending — failures lower Payment behaviour for 90 days.",
      action: { kind: "link", href: "/wallet" },
      simulate: (x) => ({ ...x, completedTx90: x.completedTx90 + x.failedTx90, failedTx90: 0 }),
    },
    {
      key: "keep_buffer", factor: "health", when: s.incomingTotal6 > 0 && kept < 0.2 && !(biz && e && e.batchesSubmitted6 > 0),
      title: "Keep a small buffer",
      description: "Leaving 10–20% of what you earn in your wallet maxes out Balance health. Cashing out is fine — it's never scored below neutral.",
      action: null, simulate: (x) => ({ ...x, outgoingTotal6: x.incomingTotal6 * 0.8 }),
    },
    {
      key: "use_regularly", factor: "payments", when: s.completedTx90 < 20 && s.completedTx90 + s.failedTx90 > 0,
      title: "Use S-PAY regularly", description: "Regular, successful payments and transfers build a stronger Payment behaviour factor.",
      action: { kind: "link", href: "/dashboard" }, simulate: (x) => ({ ...x, completedTx90: Math.min(20, x.completedTx90 + 5) }),
    },
    {
      key: "stay_active", factor: "history", when: (historyFactor?.value ?? 100) < 100,
      title: "Stay active — history counts", description: "Account age and months of activity grow on their own. Avoid long gaps; your full history pays off over two years.",
      action: null,
    },
  ];

  return candidates
    .filter((c) => c.when)
    .map(({ when: _when, simulate, ...rest }): ScoreImprovement => {
      const gain = simulate ? computeScore(simulate(s)).score - current.score : null;
      return { ...rest, estimatedPoints: gain };
    })
    // A simulated action that wouldn't move the score isn't advice worth showing.
    .filter((i) => i.estimatedPoints === null || i.estimatedPoints > 0)
    .sort((a, b) => (b.estimatedPoints ?? -1) - (a.estimatedPoints ?? -1));
}
