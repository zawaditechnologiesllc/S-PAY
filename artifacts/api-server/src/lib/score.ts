import crypto from "node:crypto";
import {
  db, usersTable, transactionsTable, employersTable, payrollBatchesTable, payrollPaymentsTable,
  scoreProfilesTable, scoreSnapshotsTable, scoreConsentLogTable, scoreSharesTable,
  type User, type ScoreProfile,
} from "@workspace/db";
import { and, asc, count, desc, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import {
  computeScore, improvementPlan, bandFor, nextBand,
  SCORE_MIN, SCORE_MAX, SCORE_MODEL_VERSION, SCORE_CONSENT_VERSION, SCORE_PARTNER_SHARING_TARGET_YEAR,
  SCORE_TRUSTED_THRESHOLD, SCORE_BANDS,
  type ScoreSignals, type ScoreResult, type ScoreBand,
} from "@workspace/score-model";
import { logger } from "./logger";
import { notifyUser } from "./notify";
import { isScoreProgramEnabled } from "./settings";

/**
 * S-PAY Score — data collection + persistence around the pure model in
 * @workspace/score-model.
 *
 *  • gatherSignals()  reads AGGREGATES of the member's own S-PAY activity
 *                     (counts/sums — never copies of transactions or payers).
 *  • refreshScore()   computes the score and upserts this month's snapshot, so
 *                     one row per member per month accumulates into the
 *                     multi-year history the partner program (opt-in, ~2031)
 *                     will need.
 *  • the sweep loop   refreshes members who haven't opened their score, so the
 *                     monthly history keeps building in the background.
 *
 * Sandbox/test money is always excluded. A member who turns the score off is
 * never computed or snapshotted until they turn it back on.
 */

/** How long a computed score is reused before opening it recomputes. */
const SCORE_STALE_MS = 6 * 60 * 60 * 1000;
/** Percentile is only shown once enough members are scored to be meaningful (and non-identifying). */
const PERCENTILE_MIN_POPULATION = 20;
const SHARE_MAX_ACTIVE = 10;

const SITE = () => (process.env.FRONTEND_URL ?? process.env.SITE_URL ?? "https://spayewallet.com").replace(/\/+$/, "");

export function currentPeriod(d = new Date()): string {
  return d.toISOString().slice(0, 7); // "YYYY-MM" (UTC)
}

function startOfMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// ── Signals ───────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

export async function gatherSignals(user: User): Promise<ScoreSignals> {
  const t = transactionsTable;
  const incoming = sql`${t.type} IN ('receive', 'recharge')`;
  const completed = sql`${t.status} = 'completed'`;
  // Calendar windows: the current month + the 5 (or 11) before it.
  const w6 = sql`${t.createdAt} >= date_trunc('month', now()) - interval '5 months'`;
  const w12 = sql`${t.createdAt} >= date_trunc('month', now()) - interval '11 months'`;
  const d90 = sql`${t.createdAt} >= now() - interval '90 days'`;

  const [tx] = await db.select({
    completed90: sql<string>`COUNT(*) FILTER (WHERE ${completed} AND ${d90})`,
    failed90: sql<string>`COUNT(*) FILTER (WHERE ${t.status} = 'failed' AND ${d90})`,
    activeMonths12: sql<string>`COUNT(DISTINCT date_trunc('month', ${t.createdAt})) FILTER (WHERE ${completed} AND ${w12})`,
    incomingMonths6: sql<string>`COUNT(DISTINCT date_trunc('month', ${t.createdAt})) FILTER (WHERE ${incoming} AND ${completed} AND ${w6})`,
    incomingTotal6: sql<string>`COALESCE(SUM(${t.amount}::numeric) FILTER (WHERE ${incoming} AND ${completed} AND ${w6}), 0)`,
    outgoingTotal6: sql<string>`COALESCE(SUM(${t.amount}::numeric) FILTER (WHERE NOT (${incoming}) AND ${completed} AND ${w6}), 0)`,
    distinctPayers6: sql<string>`COUNT(DISTINCT ${t.counterparty}) FILTER (WHERE ${incoming} AND ${completed} AND ${w6} AND ${t.counterparty} IS NOT NULL)`,
  }).from(t).where(and(
    eq(t.userId, user.id),
    // Sandbox payroll credits are tagged "[TEST]" — never let test money score.
    sql`${t.description} NOT LIKE '[TEST]%'`,
  ));

  const [payroll] = await db.select({ total: count() })
    .from(payrollPaymentsTable)
    .innerJoin(payrollBatchesTable, eq(payrollBatchesTable.id, payrollPaymentsTable.batchId))
    .where(and(
      eq(payrollPaymentsTable.resolvedUserId, user.id),
      eq(payrollPaymentsTable.status, "completed"),
      eq(payrollBatchesTable.sandbox, false),
      sql`${payrollPaymentsTable.paidAt} >= date_trunc('month', now()) - interval '5 months'`,
    ));

  let employer: ScoreSignals["employer"] = null;
  if (user.accountType === "business") {
    const [emp] = await db.select().from(employersTable)
      .where(eq(employersTable.ownerUserId, user.id))
      .orderBy(desc(employersTable.createdAt)).limit(1);
    if (emp) {
      const b = payrollBatchesTable;
      const submitted = sql`${b.status} IN ('processing', 'completed', 'partially_completed', 'failed')`;
      const paid = sql`${b.status} IN ('completed', 'partially_completed')`;
      const [agg] = await db.select({
        submitted: sql<string>`COUNT(*) FILTER (WHERE ${submitted})`,
        failed: sql<string>`COUNT(*) FILTER (WHERE ${b.status} = 'failed')`,
        paymentsCompleted: sql<string>`COALESCE(SUM(${b.completedCount}) FILTER (WHERE ${submitted}), 0)`,
        paymentsFailed: sql<string>`COALESCE(SUM(${b.failedCount}) FILTER (WHERE ${submitted}), 0)`,
        months: sql<string>`COUNT(DISTINCT date_trunc('month', ${b.submittedAt})) FILTER (WHERE ${paid})`,
        avgCost: sql<string>`COALESCE(AVG(${b.totalAmount}::numeric + ${b.feeAmount}::numeric) FILTER (WHERE ${paid}), 0)`,
      }).from(b).where(and(
        eq(b.employerId, emp.id),
        eq(b.sandbox, false),
        sql`${b.submittedAt} >= date_trunc('month', now()) - interval '5 months'`,
      ));
      employer = {
        status: emp.status,
        balance: num(emp.balanceUsdc),
        batchesSubmitted6: num(agg?.submitted),
        batchesFailed6: num(agg?.failed),
        paymentsCompleted6: num(agg?.paymentsCompleted),
        paymentsFailed6: num(agg?.paymentsFailed),
        payrollMonths6: num(agg?.months),
        avgBatchCost6: Math.round(num(agg?.avgCost) * 100) / 100,
      };
    }
  }

  return {
    accountType: user.accountType,
    kycStatus: user.kycStatus,
    emailVerified: user.emailVerified,
    hasPhone: Boolean(user.phoneNumber?.trim()),
    hasCountry: Boolean(user.country?.trim()),
    pinSet: Boolean(user.transactionPinHash),
    hasBusinessName: Boolean(user.businessName?.trim()),
    accountAgeDays: Math.max(0, Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000)),
    activeMonths12: num(tx?.activeMonths12),
    completedTx90: num(tx?.completed90),
    failedTx90: num(tx?.failed90),
    incomingMonths6: num(tx?.incomingMonths6),
    incomingTotal6: Math.round(num(tx?.incomingTotal6) * 100) / 100,
    outgoingTotal6: Math.round(num(tx?.outgoingTotal6) * 100) / 100,
    distinctPayers6: num(tx?.distinctPayers6),
    payrollReceived6: num(payroll?.total),
    employer,
  };
}

// ── Profiles, snapshots, consent ──────────────────────────────────────────────

async function getProfile(userId: string): Promise<ScoreProfile | undefined> {
  const [p] = await db.select().from(scoreProfilesTable).where(eq(scoreProfilesTable.userId, userId)).limit(1);
  return p;
}

async function ensureProfile(userId: string): Promise<ScoreProfile> {
  await db.insert(scoreProfilesTable).values({ userId }).onConflictDoNothing();
  return (await getProfile(userId))!;
}

async function logConsent(userId: string, action: string): Promise<void> {
  await db.insert(scoreConsentLogTable).values({ userId, action, consentVersion: SCORE_CONSENT_VERSION });
}

const BAND_ORDER: string[] = SCORE_BANDS.map((b) => b.key);

/**
 * Compute the member's score from live data and upsert this month's snapshot.
 * Returns null when the member doesn't exist or has turned the score off.
 */
export async function refreshScore(userId: string): Promise<{ result: ScoreResult; signals: ScoreSignals } | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;
  const profile = await getProfile(userId);
  if (profile && !profile.enabled) return null;

  const signals = await gatherSignals(user);
  const result = computeScore(signals);
  const now = new Date();
  const factors = result.factors.map(({ key, value, points, weight }) => ({ key, value, points, weight }));

  await db.insert(scoreSnapshotsTable).values({
    userId, period: currentPeriod(now), score: result.score, band: result.band.key,
    accountType: signals.accountType, modelVersion: result.modelVersion, factors, signals,
  }).onConflictDoUpdate({
    target: [scoreSnapshotsTable.userId, scoreSnapshotsTable.period],
    set: {
      score: result.score, band: result.band.key, accountType: signals.accountType,
      modelVersion: result.modelVersion, factors, signals, updatedAt: now,
    },
  });

  const profileValues = {
    lastScore: result.score, lastBand: result.band.key, accountType: signals.accountType,
    modelVersion: result.modelVersion, lastComputedAt: now, updatedAt: now,
  };
  await db.insert(scoreProfilesTable).values({ userId, ...profileValues })
    .onConflictDoUpdate({ target: scoreProfilesTable.userId, set: profileValues });

  // Tell the member when they cross into a new band (not on every point).
  const prev = profile?.lastBand;
  if (prev && prev !== result.band.key) {
    const up = BAND_ORDER.indexOf(result.band.key) > BAND_ORDER.indexOf(prev);
    notifyUser(
      userId,
      up ? `Your S-PAY Score moved up to ${result.band.label}` : "Your S-PAY Score changed",
      up
        ? `You're now ${result.band.label} at ${result.score}. Nice work — open My Score to see what unlocked and what's next.`
        : `Your score is now ${result.score} (${result.band.label}). Open My Score for a plan to bring it back up.`,
      "account",
    );
  }

  return { result, signals };
}

function bandDto(b: ScoreBand) {
  return { key: b.key, label: b.label, min: b.min, max: b.max, color: b.color, summary: b.summary };
}

/** Everything the My Score page needs, refreshing the score if it's stale. */
export async function getScoreView(userId: string) {
  const programEnabled = await isScoreProgramEnabled();
  const profile = await ensureProfile(userId);
  const period = currentPeriod();

  let computed: { result: ScoreResult; signals: ScoreSignals } | null = null;
  if (programEnabled && profile.enabled) {
    const [snap] = await db.select().from(scoreSnapshotsTable)
      .where(and(eq(scoreSnapshotsTable.userId, userId), eq(scoreSnapshotsTable.period, period))).limit(1);
    const isFresh = snap
      && snap.modelVersion === SCORE_MODEL_VERSION
      && profile.lastComputedAt
      && Date.now() - profile.lastComputedAt.getTime() < SCORE_STALE_MS;
    if (isFresh) {
      // The model is deterministic: re-running it on the stored signals
      // reproduces the stored score exactly, with full explanations.
      const signals = snap.signals as ScoreSignals;
      computed = { result: computeScore(signals), signals };
    } else {
      computed = await refreshScore(userId);
    }
  }

  const history = await db.select({ period: scoreSnapshotsTable.period, score: scoreSnapshotsTable.score, band: scoreSnapshotsTable.band })
    .from(scoreSnapshotsTable).where(eq(scoreSnapshotsTable.userId, userId))
    .orderBy(desc(scoreSnapshotsTable.period)).limit(12);

  let percentile: number | null = null;
  if (computed) {
    const [pop] = await db.select({
      total: count(),
      below: sql<string>`COUNT(*) FILTER (WHERE ${scoreProfilesTable.lastScore} < ${computed.result.score})`,
    }).from(scoreProfilesTable).where(and(eq(scoreProfilesTable.enabled, true), isNotNull(scoreProfilesTable.lastScore)));
    if (pop && pop.total >= PERCENTILE_MIN_POPULATION) percentile = Math.round((num(pop.below) / pop.total) * 100);
  }

  const [shares] = await db.select({ total: count() }).from(scoreSharesTable)
    .where(and(eq(scoreSharesTable.userId, userId), isNull(scoreSharesTable.revokedAt), gt(scoreSharesTable.expiresAt, new Date())));

  const latest = await getProfile(userId);
  const next = computed ? nextBand(computed.result.score) : null;
  return {
    programEnabled,
    enabled: profile.enabled,
    accountType: computed?.signals.accountType ?? profile.accountType ?? "personal",
    score: computed?.result.score ?? null,
    band: computed ? bandDto(computed.result.band) : null,
    range: { min: SCORE_MIN, max: SCORE_MAX },
    trustedThreshold: SCORE_TRUSTED_THRESHOLD,
    nextBand: computed && next ? { ...bandDto(next), pointsNeeded: next.min - computed.result.score } : null,
    factors: computed?.result.factors ?? [],
    improvements: computed ? improvementPlan(computed.signals, computed.result) : [],
    history: history.reverse().map((h) => ({ ...h, bandLabel: bandFor(h.score).label })),
    percentile,
    computedAt: latest?.lastComputedAt?.toISOString() ?? null,
    modelVersion: SCORE_MODEL_VERSION,
    partnerSharing: {
      consented: latest?.partnerSharingConsent ?? false,
      consentedAt: latest?.partnerSharingConsentAt?.toISOString() ?? null,
      consentVersion: latest?.consentVersion ?? null,
      currentVersion: SCORE_CONSENT_VERSION,
      targetYear: SCORE_PARTNER_SHARING_TARGET_YEAR,
      active: false, // no partner receives any data yet — the program isn't live
    },
    activeShares: shares?.total ?? 0,
  };
}

export class ScoreError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function updateScoreSettings(userId: string, update: { enabled?: boolean; partnerSharing?: boolean }): Promise<void> {
  const profile = await ensureProfile(userId);
  const now = new Date();
  const enabled = update.enabled ?? profile.enabled;
  let sharing = update.partnerSharing ?? profile.partnerSharingConsent;

  if (!enabled) sharing = false; // turning the score off withdraws partner consent too
  if (update.partnerSharing === true && !enabled) {
    throw new ScoreError(400, "score_disabled", "Turn your S-PAY Score on before choosing partner sharing.");
  }

  const set: Partial<typeof scoreProfilesTable.$inferInsert> = { enabled, partnerSharingConsent: sharing, updatedAt: now };
  if (sharing && !profile.partnerSharingConsent) {
    set.partnerSharingConsentAt = now;
    set.consentVersion = SCORE_CONSENT_VERSION;
  }
  if (!sharing && profile.partnerSharingConsent) set.partnerSharingConsentAt = null;
  await db.update(scoreProfilesTable).set(set).where(eq(scoreProfilesTable.userId, userId));

  if (enabled !== profile.enabled) await logConsent(userId, enabled ? "score_enabled" : "score_disabled");
  if (sharing !== profile.partnerSharingConsent) await logConsent(userId, sharing ? "sharing_granted" : "sharing_revoked");

  if (enabled && !profile.enabled && (await isScoreProgramEnabled())) await refreshScore(userId);
}

export async function deleteScoreHistory(userId: string): Promise<number> {
  await ensureProfile(userId);
  const deleted = await db.delete(scoreSnapshotsTable).where(eq(scoreSnapshotsTable.userId, userId)).returning({ id: scoreSnapshotsTable.id });
  await db.update(scoreProfilesTable).set({
    lastScore: null, lastBand: null, modelVersion: null, lastComputedAt: null, updatedAt: new Date(),
  }).where(eq(scoreProfilesTable.userId, userId));
  await logConsent(userId, "history_deleted");
  return deleted.length;
}

export async function exportScoreData(userId: string) {
  const profile = await ensureProfile(userId);
  const [snapshots, consentLog, shares] = await Promise.all([
    db.select().from(scoreSnapshotsTable).where(eq(scoreSnapshotsTable.userId, userId)).orderBy(asc(scoreSnapshotsTable.period)),
    db.select().from(scoreConsentLogTable).where(eq(scoreConsentLogTable.userId, userId)).orderBy(asc(scoreConsentLogTable.createdAt)),
    db.select({
      createdAt: scoreSharesTable.createdAt, expiresAt: scoreSharesTable.expiresAt, revokedAt: scoreSharesTable.revokedAt,
      showExactScore: scoreSharesTable.showExactScore, score: scoreSharesTable.score, band: scoreSharesTable.band,
      viewCount: scoreSharesTable.viewCount,
    }).from(scoreSharesTable).where(eq(scoreSharesTable.userId, userId)).orderBy(asc(scoreSharesTable.createdAt)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    product: "S-PAY Score",
    modelVersion: SCORE_MODEL_VERSION,
    noticeVersion: SCORE_CONSENT_VERSION,
    profile: {
      enabled: profile.enabled,
      partnerSharingConsent: profile.partnerSharingConsent,
      partnerSharingConsentAt: profile.partnerSharingConsentAt,
      consentVersion: profile.consentVersion,
      lastScore: profile.lastScore,
      lastBand: profile.lastBand,
      lastComputedAt: profile.lastComputedAt,
    },
    snapshots: snapshots.map(({ userId: _u, id: _id, ...s }) => s),
    consentLog: consentLog.map(({ action, consentVersion, createdAt }) => ({ action, consentVersion, createdAt })),
    shares,
  };
}

// ── Shareable proof ───────────────────────────────────────────────────────────

const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

export async function createScoreShare(userId: string, opts: { showExactScore: boolean; days: number }) {
  const view = await getScoreView(userId);
  if (!view.programEnabled || !view.enabled || view.score === null || !view.band) {
    throw new ScoreError(400, "score_unavailable", "Turn your S-PAY Score on to share it.");
  }
  const now = new Date();
  const [active] = await db.select({ total: count() }).from(scoreSharesTable)
    .where(and(eq(scoreSharesTable.userId, userId), isNull(scoreSharesTable.revokedAt), gt(scoreSharesTable.expiresAt, now)));
  if ((active?.total ?? 0) >= SHARE_MAX_ACTIVE) {
    throw new ScoreError(429, "too_many_shares", `You have ${SHARE_MAX_ACTIVE} active links. Revoke them before creating more.`);
  }
  const token = crypto.randomBytes(18).toString("base64url"); // 144 bits — unguessable
  const expiresAt = new Date(now.getTime() + opts.days * 86_400_000);
  await db.insert(scoreSharesTable).values({
    userId, tokenHash: hashToken(token), showExactScore: opts.showExactScore,
    score: view.score, band: view.band.key, accountType: view.accountType, expiresAt,
  });
  return {
    token,
    url: `${SITE()}/score/verify/${token}`,
    expiresAt: expiresAt.toISOString(),
    showExactScore: opts.showExactScore,
    score: view.score,
    band: view.band,
  };
}

export async function revokeScoreShares(userId: string): Promise<number> {
  const revoked = await db.update(scoreSharesTable).set({ revokedAt: new Date() })
    .where(and(eq(scoreSharesTable.userId, userId), isNull(scoreSharesTable.revokedAt)))
    .returning({ id: scoreSharesTable.id });
  if (revoked.length) await logConsent(userId, "shares_revoked");
  return revoked.length;
}

/** Public view of a share link. Shows only what the member chose to share. */
export async function verifyScoreShare(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [share] = await db.select().from(scoreSharesTable).where(eq(scoreSharesTable.tokenHash, hashToken(token))).limit(1);
  if (!share || share.revokedAt || share.expiresAt.getTime() <= Date.now()) return null;
  const [user] = await db.select({
    fullName: usersTable.fullName, businessName: usersTable.businessName, kycStatus: usersTable.kycStatus,
  }).from(usersTable).where(eq(usersTable.id, share.userId)).limit(1);
  if (!user) return null;
  await db.update(scoreSharesTable).set({ viewCount: sql`${scoreSharesTable.viewCount} + 1` }).where(eq(scoreSharesTable.id, share.id));

  // First name + last initial for people; the registered name for businesses.
  const parts = user.fullName.trim().split(/\s+/);
  const personName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : parts[0];
  const displayName = share.accountType === "business" ? (user.businessName?.trim() || user.fullName) : personName;
  return {
    valid: true,
    displayName,
    accountType: share.accountType,
    band: bandDto(bandFor(share.score)),
    score: share.showExactScore ? share.score : null,
    trustedMember: share.score >= SCORE_TRUSTED_THRESHOLD,
    identityVerified: user.kycStatus === "approved",
    issuedAt: share.createdAt.toISOString(),
    expiresAt: share.expiresAt.toISOString(),
    modelVersion: SCORE_MODEL_VERSION,
  };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminScoreStats() {
  const p = scoreProfilesTable;
  const [programEnabled, [totals], bandRows, [snaps], readyRows, recent, [{ total: totalUsers }]] = await Promise.all([
    isScoreProgramEnabled(),
    db.select({
      profiles: count(),
      enabled: sql<string>`COUNT(*) FILTER (WHERE ${p.enabled})`,
      scored: sql<string>`COUNT(*) FILTER (WHERE ${p.enabled} AND ${p.lastScore} IS NOT NULL)`,
      sharing: sql<string>`COUNT(*) FILTER (WHERE ${p.enabled} AND ${p.partnerSharingConsent})`,
      avgAll: sql<string>`AVG(${p.lastScore}) FILTER (WHERE ${p.enabled})`,
      avgPersonal: sql<string>`AVG(${p.lastScore}) FILTER (WHERE ${p.enabled} AND ${p.accountType} = 'personal')`,
      avgBusiness: sql<string>`AVG(${p.lastScore}) FILTER (WHERE ${p.enabled} AND ${p.accountType} = 'business')`,
      trusted: sql<string>`COUNT(*) FILTER (WHERE ${p.enabled} AND ${p.lastScore} >= ${SCORE_TRUSTED_THRESHOLD})`,
    }).from(p),
    db.select({ band: p.lastBand, accountType: p.accountType, total: count() }).from(p)
      .where(and(eq(p.enabled, true), isNotNull(p.lastBand))).groupBy(p.lastBand, p.accountType),
    db.select({
      total: count(),
      members: sql<string>`COUNT(DISTINCT ${scoreSnapshotsTable.userId})`,
      firstPeriod: sql<string | null>`MIN(${scoreSnapshotsTable.period})`,
      thisMonth: sql<string>`COUNT(*) FILTER (WHERE ${scoreSnapshotsTable.period} = ${currentPeriod()})`,
    }).from(scoreSnapshotsTable),
    // "Partner-ready": opted in AND at least 12 months of history.
    db.execute(sql`
      SELECT COUNT(*)::int AS ready FROM (
        SELECT s.user_id FROM ${scoreSnapshotsTable} s
        JOIN ${p} pr ON pr.user_id = s.user_id
        WHERE pr.enabled AND pr.partner_sharing_consent
        GROUP BY s.user_id HAVING COUNT(*) >= 12
      ) r`),
    db.select({
      action: scoreConsentLogTable.action, createdAt: scoreConsentLogTable.createdAt,
      consentVersion: scoreConsentLogTable.consentVersion,
      email: usersTable.email, fullName: usersTable.fullName,
    }).from(scoreConsentLogTable).leftJoin(usersTable, eq(usersTable.id, scoreConsentLogTable.userId))
      .orderBy(desc(scoreConsentLogTable.createdAt)).limit(20),
    db.select({ total: count() }).from(usersTable),
  ]);

  const distribution = SCORE_BANDS.map(({ key, label }) => {
    const rows = bandRows.filter((r) => r.band === key);
    return {
      band: key,
      label,
      personal: rows.filter((r) => r.accountType !== "business").reduce((a, r) => a + r.total, 0),
      business: rows.filter((r) => r.accountType === "business").reduce((a, r) => a + r.total, 0),
    };
  });
  const enabledCount = num(totals?.enabled);
  const sharingCount = num(totals?.sharing);
  const readyRow = (readyRows as unknown as { rows?: { ready: number }[] }).rows?.[0];
  const round = (v: unknown) => (v === null || v === undefined ? null : Math.round(num(v)));

  return {
    programEnabled,
    modelVersion: SCORE_MODEL_VERSION,
    consentVersion: SCORE_CONSENT_VERSION,
    partnerTargetYear: SCORE_PARTNER_SHARING_TARGET_YEAR,
    totalUsers,
    profiles: totals?.profiles ?? 0,
    enabledProfiles: enabledCount,
    disabledProfiles: (totals?.profiles ?? 0) - enabledCount,
    scoredMembers: num(totals?.scored),
    coveragePct: totalUsers > 0 ? Math.round((num(totals?.scored) / totalUsers) * 100) : 0,
    averageScore: round(totals?.avgAll),
    averagePersonal: round(totals?.avgPersonal),
    averageBusiness: round(totals?.avgBusiness),
    trustedMembers: num(totals?.trusted),
    distribution,
    partnerSharing: {
      consented: sharingCount,
      ratePct: enabledCount > 0 ? Math.round((sharingCount / enabledCount) * 100) : 0,
      partnerReady: readyRow?.ready ?? 0,
    },
    snapshots: {
      total: snaps?.total ?? 0,
      members: num(snaps?.members),
      thisMonth: num(snaps?.thisMonth),
      firstPeriod: snaps?.firstPeriod ?? null,
    },
    recentConsent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

// ── Background sweep ──────────────────────────────────────────────────────────
// Keeps the monthly history building for members who never open My Score:
// anyone without a snapshot this month, or not refreshed for a week, is
// recomputed in small sequential batches.

const SWEEP_BATCH = 200;
let sweeping = false;

export async function runScoreSweep(): Promise<number> {
  if (sweeping || !process.env.DATABASE_URL) return 0;
  if (!(await isScoreProgramEnabled())) return 0;
  sweeping = true;
  try {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const monthStart = startOfMonthUtc();
    const cutoff = weekAgo > monthStart ? weekAgo : monthStart;
    const due = await db.select({ id: usersTable.id }).from(usersTable)
      .leftJoin(scoreProfilesTable, eq(scoreProfilesTable.userId, usersTable.id))
      .where(and(
        or(isNull(scoreProfilesTable.userId), eq(scoreProfilesTable.enabled, true)),
        or(isNull(scoreProfilesTable.lastComputedAt), lt(scoreProfilesTable.lastComputedAt, cutoff)),
      ))
      .limit(SWEEP_BATCH);
    let done = 0;
    for (const { id } of due) {
      try {
        if (await refreshScore(id)) done++;
      } catch (err) {
        logger.warn({ err, userId: id }, "Score refresh failed in sweep");
      }
    }
    return done;
  } finally {
    sweeping = false;
  }
}

export function startScoreSweepLoop(intervalMs = 30 * 60 * 1000): NodeJS.Timeout {
  const tick = () => {
    runScoreSweep().then(
      (n) => { if (n > 0) logger.info({ refreshed: n }, "S-PAY Score sweep complete"); },
      (err) => logger.warn({ err }, "S-PAY Score sweep failed"),
    );
  };
  setTimeout(tick, 2 * 60 * 1000).unref(); // first pass shortly after boot
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}
