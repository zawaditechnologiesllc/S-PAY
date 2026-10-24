// Unit tests for the S-PAY Score model — the pure scoring function, bands,
// improvement plan and the customer-facing content that must match the model.
// No database, no network.
//
//   node --test test/score.unit.mjs
//
// @workspace/score-model is TypeScript with extensionless internal imports, so
// we bundle it with esbuild (same approach as seo.unit.mjs) and import that.

import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { unlinkSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");

const bundlePath = join(pkgRoot, ".score-test-bundle.mjs");
await build({
  entryPoints: [join(pkgRoot, "../../lib/score-model/src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
  logLevel: "silent",
});
const m = await import(bundlePath);
unlinkSync(bundlePath);

const base = {
  accountType: "personal",
  kycStatus: "pending",
  emailVerified: false,
  hasPhone: false,
  hasCountry: false,
  pinSet: false,
  hasBusinessName: false,
  accountAgeDays: 0,
  activeMonths12: 0,
  completedTx90: 0,
  failedTx90: 0,
  incomingMonths6: 0,
  incomingTotal6: 0,
  outgoingTotal6: 0,
  distinctPayers6: 0,
  payrollReceived6: 0,
  employer: null,
};

const verifiedActive = {
  ...base,
  kycStatus: "approved", emailVerified: true, hasPhone: true, hasCountry: true, pinSet: true,
  accountAgeDays: 90, activeMonths12: 3,
  completedTx90: 15, failedTx90: 0,
  incomingMonths6: 3, incomingTotal6: 1500, outgoingTotal6: 1350, distinctPayers6: 2, payrollReceived6: 2,
};

const veteran = {
  ...verifiedActive,
  accountAgeDays: 800, activeMonths12: 12, completedTx90: 40,
  incomingMonths6: 6, incomingTotal6: 9000, outgoingTotal6: 7000, distinctPayers6: 4, payrollReceived6: 6,
};

// ─── Model shape ────────────────────────────────────────────────────────────────

test("weights sum to 1 for both account types", () => {
  for (const type of ["personal", "business"]) {
    const sum = Object.values(m.SCORE_WEIGHTS[type]).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${type} weights sum to ${sum}`);
  }
});

test("bands tile 300–850 with no gaps or overlaps", () => {
  assert.equal(m.SCORE_BANDS[0].min, m.SCORE_MIN);
  assert.equal(m.SCORE_BANDS.at(-1).max, m.SCORE_MAX);
  for (let i = 1; i < m.SCORE_BANDS.length; i++) {
    assert.equal(m.SCORE_BANDS[i].min, m.SCORE_BANDS[i - 1].max + 1);
  }
  assert.equal(m.bandFor(549).key, "building");
  assert.equal(m.bandFor(550).key, "good");
  assert.equal(m.bandFor(850).key, "excellent");
  assert.equal(m.nextBand(700).key, "excellent");
  assert.equal(m.nextBand(800), null);
});

test("score equals 300 plus the sum of factor points", () => {
  for (const s of [base, verifiedActive, veteran]) {
    const r = m.computeScore(s);
    assert.equal(r.score, 300 + r.factors.reduce((a, f) => a + f.points, 0));
    assert.equal(r.modelVersion, m.SCORE_MODEL_VERSION);
    assert.equal(r.factors.length, 5);
  }
});

test("is deterministic", () => {
  assert.deepEqual(m.computeScore(verifiedActive), m.computeScore(verifiedActive));
});

// ─── Calibration ────────────────────────────────────────────────────────────────

test("a brand-new account starts in Building, not at the floor", () => {
  const r = m.computeScore(base);
  assert.equal(r.band.key, "building");
  assert.ok(r.score > 380 && r.score < 470, `new account scored ${r.score}`);
  assert.ok(r.factors.filter((f) => f.status === "no_data").length >= 3);
});

test("verified + a few active months reaches Good or better", () => {
  const r = m.computeScore(verifiedActive);
  assert.ok(r.score >= 550, `verified active scored ${r.score}`);
  assert.notEqual(r.band.key, "excellent", "Excellent needs a long history");
});

test("a long clean history reaches Excellent", () => {
  assert.equal(m.computeScore(veteran).band.key, "excellent");
});

test("verification is the single biggest lever for a new member", () => {
  const plan = m.improvementPlan(base);
  assert.equal(plan[0].key, "verify_identity");
  assert.deepEqual(plan[0].action, { kind: "kyc" });
  assert.ok(plan[0].estimatedPoints >= 50);
});

test("failed transactions lower the score", () => {
  const clean = m.computeScore(verifiedActive).score;
  const messy = m.computeScore({ ...verifiedActive, completedTx90: 10, failedTx90: 5 }).score;
  assert.ok(messy < clean);
});

test("cashing out everything is never scored below neutral", () => {
  const r = m.computeScore({ ...verifiedActive, outgoingTotal6: verifiedActive.incomingTotal6 * 3 });
  const health = r.factors.find((f) => f.key === "health");
  assert.equal(health.value, 50);
});

test("income size counts least — doubling income moves the score only a little", () => {
  const a = m.computeScore(verifiedActive).score;
  const b = m.computeScore({ ...verifiedActive, incomingTotal6: 3000, outgoingTotal6: 2700 }).score;
  assert.ok(b - a >= 0 && b - a <= 10, `doubling income moved ${b - a} points`);
});

test("score is clamped to 300–850", () => {
  const huge = m.computeScore({ ...veteran, incomingTotal6: 1e12, completedTx90: 1e6, activeMonths12: 99, accountAgeDays: 1e5 });
  assert.ok(huge.score <= 850);
  const empty = m.computeScore({ ...base, kycStatus: "rejected" });
  assert.ok(empty.score >= 300);
});

// ─── Business accounts ──────────────────────────────────────────────────────────

const biz = {
  ...verifiedActive,
  accountType: "business",
  hasBusinessName: true,
  employer: {
    status: "verified", balance: 5000,
    batchesSubmitted6: 6, batchesFailed6: 0,
    paymentsCompleted6: 600, paymentsFailed6: 0,
    payrollMonths6: 6, avgBatchCost6: 4000,
  },
};

test("business accounts are scored on payroll reliability", () => {
  const r = m.computeScore(biz);
  const payments = r.factors.find((f) => f.key === "payments");
  assert.equal(payments.label, "Payroll & payment reliability");
  assert.equal(payments.value, 100);
  const worse = m.computeScore({ ...biz, employer: { ...biz.employer, paymentsCompleted6: 450, paymentsFailed6: 150 } });
  assert.ok(worse.score < r.score);
});

test("business float coverage drives health and the plan suggests topping up", () => {
  const short = { ...biz, employer: { ...biz.employer, balance: 1000 } };
  const r = m.computeScore(short);
  assert.ok(r.factors.find((f) => f.key === "health").value < 100);
  const plan = m.improvementPlan(short);
  const topUp = plan.find((i) => i.key === "payroll_float");
  assert.ok(topUp && topUp.estimatedPoints > 0);
});

test("a business without payroll falls back to transaction behaviour", () => {
  const r = m.computeScore({ ...biz, employer: null });
  assert.equal(r.factors.find((f) => f.key === "payments").detail, m.computeScore(verifiedActive).factors.find((f) => f.key === "payments").detail);
  assert.ok(m.improvementPlan({ ...biz, employer: null }).some((i) => i.key === "setup_payroll"));
});

// ─── Improvement plan ───────────────────────────────────────────────────────────

test("plan estimates are real simulated gains, sorted high to low", () => {
  const plan = m.improvementPlan(base);
  const estimated = plan.filter((i) => i.estimatedPoints !== null);
  for (let i = 1; i < estimated.length; i++) {
    assert.ok(estimated[i - 1].estimatedPoints >= estimated[i].estimatedPoints);
  }
  for (const i of estimated) assert.ok(i.estimatedPoints > 0);
  // Time-based advice has no estimate and sinks to the bottom.
  assert.equal(plan.at(-1).estimatedPoints, null);
});

test("an all-done member gets no identity tasks", () => {
  const keys = m.improvementPlan(veteran).map((i) => i.key);
  for (const k of ["verify_identity", "confirm_email", "set_pin", "add_phone"]) assert.ok(!keys.includes(k));
});

// ─── Content matches the model ──────────────────────────────────────────────────

test("published factor weights come from the model", () => {
  for (const type of ["personal", "business"]) {
    const info = m.scoreFactorInfo(type);
    assert.equal(info.reduce((a, f) => a + f.weightPct, 0), 100);
    for (const f of info) assert.equal(f.weightPct, Math.round(m.SCORE_WEIGHTS[type][f.key] * 100));
  }
});

test("every band has perks and every benefit is labelled live or planned", () => {
  for (const b of m.scoreBandsWithPerks()) assert.ok(b.perks.live.length > 0);
  for (const b of m.SCORE_BENEFITS) assert.ok(["live", "planned"].includes(b.status));
  assert.ok(m.SCORE_FAQS.length >= 8);
  assert.match(m.SCORE_PARTNER_SHARING_NOTICE, /OFF by default/);
});

test("partner-sharing benefits are tailored per account type and the reminder is disclosed", () => {
  const personal = m.partnerSharingBenefits("personal").map((b) => b.title);
  const business = m.partnerSharingBenefits("business").map((b) => b.title);
  assert.ok(!personal.includes("Working capital for your business"));
  assert.ok(business.includes("Working capital for your business"));
  assert.ok(personal.includes("You stay in control"));
  assert.equal(m.SCORE_PARTNER_PROMPT_INTERVAL_DAYS, 7);
  assert.ok(m.SCORE_FAQS.some((f) => /remind/i.test(f.q) && f.a.includes(`${m.SCORE_PARTNER_PROMPT_INTERVAL_DAYS} days`) && /Don't ask me again/.test(f.a)));
});
