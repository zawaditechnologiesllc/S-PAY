// End-to-end test for the payroll API. Boots the built server against the
// Postgres in DATABASE_URL, runs the full marketplace flow, and asserts the
// results — including worker resolution, auto-onboarding, ledger integrity,
// idempotency, failure paths, and signed webhook delivery.
//
//   pnpm run build && DATABASE_URL=postgres://… node test/payroll.e2e.mjs
//
// Exits 0 on success, 1 on the first failed assertion. Safe to run against a
// throwaway database (it only appends rows).

import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.TEST_PORT ?? "4655";
const WEBHOOK_PORT = process.env.TEST_WEBHOOK_PORT ?? "7788";
const BASE = `http://127.0.0.1:${PORT}/api`;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL is required"); process.exit(1); }

let passed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.error(`  ✗ ${name} ${detail}`); }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

// ── tiny webhook receiver ────────────────────────────────────────────────────
const received = [];
const receiver = http.createServer((req, res) => {
  let buf = "";
  req.on("data", (c) => (buf += c));
  req.on("end", () => {
    received.push({ event: req.headers["x-spay-event"], sig: req.headers["x-spay-signature"], rawBody: buf, body: JSON.parse(buf || "{}") });
    res.writeHead(200); res.end("{}");
  });
});

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(`${BASE}/healthz`); if (r.ok) return true; } catch {}
    await sleep(300);
  }
  return false;
}

// Apply migrations up front so the schema is ready before the first request.
// (The server also self-migrates on boot, but that runs async after it starts
// listening — racing the test's first call. Applying here is deterministic.)
function applyMigrations() {
  const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../lib/db");
  const r = spawnSync("npx", ["drizzle-kit", "migrate"], {
    cwd: dbDir,
    env: { ...process.env, DATABASE_URL, DATABASE_SSL: "false" },
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("migration failed");
}

async function main() {
  applyMigrations();
  receiver.listen(Number(WEBHOOK_PORT));
  const webhookUrl = `http://127.0.0.1:${WEBHOOK_PORT}/hook`;

  const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    env: { ...process.env, PORT, DATABASE_URL, DATABASE_SSL: "false", JWT_SECRET: "e2e-secret", NODE_ENV: "test" },
    stdio: ["ignore", "ignore", "inherit"],
  });

  try {
    if (!(await waitForHealth())) throw new Error("server did not become healthy");

    const uniq = Date.now();
    const ownerEmail = `e2e_owner_${uniq}@test.com`;

    // 1. owner user (business account — payroll is business-only) + employer + sandbox key
    const reg = await api("POST", "/auth/register", { body: { email: ownerEmail, password: "Sup3rSecret!", fullName: "E2E Owner", accountType: "business", businessName: "E2E Marketplace" } });
    const token = reg.body.token;
    check("owner registers", reg.status === 200 || reg.status === 201, `status ${reg.status}`);

    const emp = await api("POST", "/payroll/employers/register", { token, body: { companyName: "E2E Marketplace", webhookUrl } });
    check("employer registers", emp.status === 201 && emp.body.employer?.id);
    check("employer starts pending", emp.body.employer?.status === "pending");
    check("webhook secret issued once", typeof emp.body.webhookSecret === "string");
    const webhookSecret = emp.body.webhookSecret;

    const liveKey = await api("POST", "/payroll/employers/me/api-keys", { token, body: { sandbox: false } });
    check("live key blocked until verified", liveKey.status === 403, `status ${liveKey.status}`);

    const keyRes = await api("POST", "/payroll/employers/me/api-keys", { token, body: { name: "e2e", sandbox: true } });
    const apiKey = keyRes.body.apiKey;
    check("sandbox key minted", keyRes.status === 201 && apiKey?.startsWith("spk_test_"));

    // 2. auth enforcement
    check("no key → 401", (await api("GET", "/payroll/summary")).status === 401);
    check("bad key → 401", (await api("GET", "/payroll/summary", { token: "spk_test_bogus" })).status === 401);

    // 3. fund sandbox balance
    const fund = await api("POST", "/payroll/sandbox/fund", { token: apiKey, body: { amount: 5000 } });
    check("sandbox funded to 5000", fund.status === 200 && fund.body.balanceUsdc === 5000);

    // 4. create batch (existing worker by email + two new workers)
    const batchBody = {
      reference: `run-${uniq}`, idempotencyKey: `idem-${uniq}`,
      payments: [
        { workerIdentifier: ownerEmail, amount: 100, reason: "existing user" },
        { workerIdentifier: `e2e_new_${uniq}@worker.com`, amount: 500, reason: "new email worker" },
        { workerIdentifier: `+99${uniq}`, amount: 300, reason: "new phone worker", identifierType: "phone" },
      ],
    };
    const created = await api("POST", "/payroll/batches", { token: apiKey, body: batchBody });
    check("batch created as draft", created.status === 201 && created.body.batch?.status === "draft");
    check("batch totals computed", created.body.batch?.totalAmount === 900 && created.body.batch?.feeAmount === 9);
    const batchId = created.body.batch.id;

    // 5. idempotency
    const dupe = await api("POST", "/payroll/batches", { token: apiKey, body: { idempotencyKey: `idem-${uniq}`, payments: [{ workerIdentifier: "x@y.com", amount: 1 }] } });
    check("idempotent create returns same batch", dupe.body.idempotent === true && dupe.body.batch?.id === batchId);

    // 6. validation
    check("empty payments → 400", (await api("POST", "/payroll/batches", { token: apiKey, body: { payments: [] } })).status === 400);
    check("negative amount → 400", (await api("POST", "/payroll/batches", { token: apiKey, body: { payments: [{ workerIdentifier: "a@b.com", amount: -5 }] } })).status === 400);

    // 7. submit → process
    const submit = await api("POST", `/payroll/batches/${batchId}/submit`, { token: apiKey });
    check("batch completes", submit.status === 200 && submit.body.batch?.status === "completed", `status ${submit.body.batch?.status}`);
    check("all 3 paid", submit.body.batch?.completedCount === 3 && submit.body.batch?.failedCount === 0);

    // 8. payments + auto-onboarding
    const pays = await api("GET", `/payroll/batches/${batchId}/payments`, { token: apiKey });
    const created2 = pays.body.payments.filter((p) => p.workerCreated).length;
    check("two workers auto-created", created2 === 2, `got ${created2}`);
    check("every payment completed", pays.body.payments.every((p) => p.status === "completed"));

    // 9. ledger: balance debited by 900 + 9 fee
    const summary = await api("GET", "/payroll/summary", { token: apiKey });
    check("balance debited correctly", summary.body.balanceUsdc === 5000 - 909, `balance ${summary.body.balanceUsdc}`);
    check("summary disbursed 900", summary.body.totalDisbursed === 900);
    check("summary onboarded 2", summary.body.workersOnboarded === 2);

    // 10. insufficient balance path
    const big = await api("POST", "/payroll/batches", { token: apiKey, body: { payments: [{ workerIdentifier: "z@z.com", amount: 100000 }] } });
    const bigSubmit = await api("POST", `/payroll/batches/${big.body.batch.id}/submit`, { token: apiKey });
    check("insufficient balance → 402", bigSubmit.status === 402);

    // 11. unresolvable celo address fails cleanly
    const bad = await api("POST", "/payroll/batches", { token: apiKey, body: { payments: [{ workerIdentifier: "0x" + "a".repeat(40), identifierType: "celo_address", amount: 5 }] } });
    const badSubmit = await api("POST", `/payroll/batches/${bad.body.batch.id}/submit`, { token: apiKey });
    check("unresolvable batch → failed", badSubmit.body.batch?.status === "failed");

    // 12. owner dashboard (JWT)
    const dash = await api("GET", "/payroll/dashboard/summary", { token });
    check("owner dashboard summary works", dash.status === 200 && dash.body.totalBatches >= 1);

    // 13. webhooks delivered + signatures valid
    await sleep(1500);
    check("webhooks received", received.length >= 5, `got ${received.length}`);
    const allValid = received.every((w) => {
      if (!w.sig) return false;
      const [t, v1] = w.sig.split(",").map((p) => p.split("=")[1]);
      const expected = crypto.createHmac("sha256", webhookSecret).update(`${t}.${w.rawBody}`).digest("hex");
      return expected === v1;
    });
    check("all webhook signatures valid", allValid);
    check("batch.completed delivered", received.some((w) => w.event === "batch.completed"));
  } finally {
    server.kill("SIGKILL");
    receiver.close();
  }

  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length) { console.error("FAILED:", failures.join(", ")); process.exit(1); }
  console.log("ALL PAYROLL E2E CHECKS PASSED ✓");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
