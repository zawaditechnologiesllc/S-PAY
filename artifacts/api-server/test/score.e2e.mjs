// End-to-end test for the S-PAY Score API. Boots the built server against the
// Postgres in DATABASE_URL, seeds real ledger activity, and asserts scoring,
// monthly snapshots, sandbox exclusion, consent controls, share links, export,
// history deletion, the admin view and the program master switch.
//
//   pnpm run build && DATABASE_URL=postgres://… node test/score.e2e.mjs
//
// Exits 0 on success, 1 on the first failed assertion. Safe to run against a
// throwaway database (it only appends rows for fresh test users).

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.TEST_PORT ?? "4656";
const BASE = `http://127.0.0.1:${PORT}/api`;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL is required"); process.exit(1); }

const here = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(here, "../../../lib/db");
const pg = createRequire(path.join(dbDir, "package.json"))("pg");
const pool = new pg.Pool({ connectionString: DATABASE_URL });
const q = (text, params = []) => pool.query(text, params);

let passed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.error(`  ✗ ${name} ${detail}`); }
}

async function api(method, p, { token, body } = {}) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : {} };
}

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(`${BASE}/healthz`); if (r.ok) return true; } catch {}
    await sleep(300);
  }
  return false;
}

function applyMigrations() {
  const r = spawnSync("npx", ["drizzle-kit", "migrate"], {
    cwd: dbDir,
    env: { ...process.env, DATABASE_URL, DATABASE_SSL: "false" },
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("migration failed");
}

/** Make the next GET /score/me recompute from live data. */
const markStale = (userId) => q(`UPDATE score_profiles SET last_computed_at = now() - interval '1 day' WHERE user_id = $1`, [userId]);

async function tx(userId, type, amount, { status = "completed", monthsAgo = 0, counterparty = null, description = "e2e" } = {}) {
  await q(
    `INSERT INTO transactions (id, user_id, type, amount, currency, description, counterparty, status, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'USDC', $4, $5, $6, date_trunc('month', now()) - ($7 || ' months')::interval + interval '2 days')`,
    [userId, type, amount, description, counterparty, status, String(monthsAgo)],
  );
}

async function main() {
  applyMigrations();
  const uniq = Date.now();
  const adminEmail = `score_admin_${uniq}@test.com`;
  const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    env: { ...process.env, PORT, DATABASE_URL, DATABASE_SSL: "false", JWT_SECRET: "e2e-secret", NODE_ENV: "test", ADMIN_EMAILS: adminEmail },
    stdio: ["ignore", "ignore", "inherit"],
  });

  try {
    if (!(await waitForHealth())) throw new Error("server did not become healthy");

    console.log("auth + validation");
    check("unauthenticated → 401", (await api("GET", "/score/me")).status === 401);

    const reg = await api("POST", "/auth/register", { body: { email: `score_user_${uniq}@test.com`, password: "Sup3rSecret!", fullName: "Amina Wanjiru Otieno" } });
    const token = reg.body.token;
    check("member registers", Boolean(token), `status ${reg.status}`);
    const me = await api("GET", "/auth/me", { token });
    const userId = me.body.id;

    console.log("new member");
    let s = await api("GET", "/score/me", { token });
    check("score loads", s.status === 200, `status ${s.status}`);
    check("score on by default", s.body.enabled === true && s.body.programEnabled === true);
    check("new member is Building", s.body.band?.key === "building" && s.body.score >= 380 && s.body.score < 470, `score ${s.body.score}`);
    check("five factors explained", s.body.factors?.length === 5 && s.body.factors.every((f) => f.detail));
    check("plan leads with verification", s.body.improvements?.[0]?.key === "verify_identity");
    check("this month snapshotted", s.body.history?.length === 1);
    check("partner sharing OFF by default", s.body.partnerSharing?.consented === false && s.body.partnerSharing?.active === false);
    check("next band reported", s.body.nextBand?.key === "good" && s.body.nextBand.pointsNeeded > 0);
    const newScore = s.body.score;

    console.log("real activity raises the score");
    await q(`UPDATE users SET kyc_status = 'approved', email_verified = true, phone_number = '+254700000${uniq % 1000}', country = 'KE', transaction_pin_hash = 'x', created_at = now() - interval '120 days' WHERE id = $1`, [userId]);
    for (const m of [0, 1, 2, 3]) {
      await tx(userId, "receive", 600, { monthsAgo: m, counterparty: m % 2 ? "Client A" : "Client B" });
      await tx(userId, "withdraw", 500, { monthsAgo: m });
      await tx(userId, "send", 20, { monthsAgo: m });
    }
    await tx(userId, "send", 15, { status: "failed" });
    await markStale(userId);
    s = await api("GET", "/score/me", { token });
    check("verified + active member reaches Good or better", s.body.score >= 550, `score ${s.body.score}`);
    check("score rose", s.body.score > newScore);
    check("verification no longer suggested", !s.body.improvements.some((i) => i.key === "verify_identity"));
    check("failed tx flagged in plan", s.body.improvements.some((i) => i.key === "avoid_failed"));
    const activeScore = s.body.score;
    const [snapRow] = (await q(`SELECT signals, model_version FROM score_snapshots WHERE user_id = $1`, [userId])).rows;
    check("snapshot stores aggregates + model version", snapRow?.signals?.distinctPayers6 === 2 && snapRow.model_version === "spay-score-v1");
    check("snapshot never stores counterparties", !JSON.stringify(snapRow?.signals ?? {}).includes("Client"));

    console.log("sandbox money never counts");
    await tx(userId, "receive", 1000000, { counterparty: "Sandbox Co", description: "[TEST] Sandbox payroll from Sandbox Co" });
    await markStale(userId);
    s = await api("GET", "/score/me", { token });
    check("sandbox credit ignored", s.body.score === activeScore, `${s.body.score} vs ${activeScore}`);

    console.log("consent");
    check("empty settings → 400", (await api("PUT", "/score/settings", { token, body: {} })).status === 400);
    check("non-boolean → 400", (await api("PUT", "/score/settings", { token, body: { enabled: "yes" } })).status === 400);
    s = await api("PUT", "/score/settings", { token, body: { partnerSharing: true } });
    check("partner sharing opt-in recorded", s.body.partnerSharing?.consented === true && Boolean(s.body.partnerSharing.consentedAt) && s.body.partnerSharing.consentVersion === s.body.partnerSharing.currentVersion);

    console.log("share links");
    check("bad share duration → 400", (await api("POST", "/score/share", { token, body: { days: 3 } })).status === 400);
    const share = await api("POST", "/score/share", { token, body: { showExactScore: true, days: 7 } });
    check("share link created", share.status === 201 && share.body.token && share.body.url.endsWith(share.body.token));
    let v = await api("GET", `/score/verify/${share.body.token}`);
    check("public verify works without auth", v.status === 200 && v.body.valid === true);
    check("verify shows exact score when chosen", v.body.score === share.body.score);
    check("verify shows first name + initial only", v.body.displayName === "Amina O.", v.body.displayName);
    check("verify marks trusted member", v.body.trustedMember === (share.body.score >= 550));
    check("verify is noindex", v.headers.get("x-robots-tag")?.includes("noindex"));
    const bandOnly = await api("POST", "/score/share", { token, body: { showExactScore: false } });
    v = await api("GET", `/score/verify/${bandOnly.body.token}`);
    check("band-only link hides the number", v.status === 200 && v.body.score === null && v.body.band?.key);
    check("unknown token → 404", (await api("GET", "/score/verify/AAAAAAAAAAAAAAAAAAAAAAAA")).status === 404);
    check("malformed token → 404", (await api("GET", "/score/verify/x")).status === 404);
    check("revoke all links", (await api("DELETE", "/score/share", { token })).status === 200);
    check("revoked link → 404", (await api("GET", `/score/verify/${share.body.token}`)).status === 404);

    console.log("export");
    const ex = await api("GET", "/score/export", { token });
    check("export is a download", ex.status === 200 && ex.headers.get("content-disposition")?.includes("attachment"));
    check("export has snapshots + consent trail", ex.body.snapshots?.length >= 1 && ex.body.consentLog?.some((c) => c.action === "sharing_granted"));
    check("export has no internal ids", !("userId" in (ex.body.snapshots?.[0] ?? {})));

    console.log("turning it off");
    s = await api("PUT", "/score/settings", { token, body: { enabled: false } });
    check("score off hides the score", s.body.enabled === false && s.body.score === null && s.body.factors.length === 0);
    check("turning off withdraws partner consent", s.body.partnerSharing?.consented === false);
    check("can't opt into sharing while off", (await api("PUT", "/score/settings", { token, body: { partnerSharing: true } })).status === 400);
    const before = (await q(`SELECT COUNT(*)::int AS n FROM score_snapshots WHERE user_id = $1`, [userId])).rows[0].n;
    await markStale(userId);
    await api("GET", "/score/me", { token });
    const after = (await q(`SELECT updated_at FROM score_snapshots WHERE user_id = $1`, [userId])).rows;
    check("no collection while off", after.length === before);
    check("share blocked while off", (await api("POST", "/score/share", { token, body: {} })).status === 400);
    const actions = (await q(`SELECT action FROM score_consent_log WHERE user_id = $1 ORDER BY created_at`, [userId])).rows.map((r) => r.action);
    check("consent trail is complete", ["sharing_granted", "shares_revoked", "score_disabled", "sharing_revoked"].every((a) => actions.includes(a)), actions.join(","));

    console.log("delete + restart");
    const del = await api("DELETE", "/score/history", { token });
    check("history deleted", del.status === 200 && /Deleted/.test(del.body.message));
    s = await api("GET", "/score/me", { token });
    check("history empty after delete", s.body.history.length === 0);
    s = await api("PUT", "/score/settings", { token, body: { enabled: true } });
    check("re-enabling recomputes now", s.body.enabled === true && s.body.score === activeScore && s.body.history.length === 1);

    console.log("business accounts");
    const breg = await api("POST", "/auth/register", { body: { email: `score_biz_${uniq}@test.com`, password: "Sup3rSecret!", fullName: "Biz Owner", accountType: "business", businessName: "Acme Ltd" } });
    s = await api("GET", "/score/me", { token: breg.body.token });
    check("business gets a Business Score", s.body.accountType === "business" && s.body.factors.some((f) => f.label === "Payroll & payment reliability"));
    check("business plan suggests payroll", s.body.improvements.some((i) => i.key === "setup_payroll" || i.key === "verify_identity"));

    console.log("account deletion erases score data");
    const bizId = (await api("GET", "/auth/me", { token: breg.body.token })).body.id;
    await api("POST", "/score/share", { token: breg.body.token, body: {} });
    const gone = await api("DELETE", "/auth/me", { token: breg.body.token, body: {} });
    check("business account deleted", gone.status === 200, `status ${gone.status}`);
    const left = (await q(`SELECT (SELECT COUNT(*) FROM score_profiles WHERE user_id = $1) + (SELECT COUNT(*) FROM score_snapshots WHERE user_id = $1) + (SELECT COUNT(*) FROM score_shares WHERE user_id = $1) + (SELECT COUNT(*) FROM score_consent_log WHERE user_id = $1) AS n`, [bizId])).rows[0].n;
    check("no score rows survive deletion", Number(left) === 0, `left ${left}`);

    console.log("crawler page");
    const ssr = await fetch(`http://127.0.0.1:${PORT}/ssr/score`);
    const html = await ssr.text();
    check("SSR /score renders", ssr.status === 200 && html.includes("<h1>S-PAY Score"));
    check("SSR /score is canonical + indexable", html.includes('rel="canonical" href="https://spayewallet.com/score"') && html.includes('content="index, follow"'));
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flat();
    check("SSR /score has FAQPage + FinancialProduct JSON-LD", ld.some((x) => x["@type"] === "FAQPage" && x.mainEntity.length >= 8) && ld.some((x) => x.about?.["@type"] === "FinancialProduct"));
    check("SSR /score explains data, benefits, tips, business", ["your-data", "benefits", "keep-it-high", "business", "partners"].every((id) => html.includes(`id="${id}"`)));

    console.log("weekly partner-sharing reminder");
    const promptState = async (id) => (await q(`SELECT sharing_prompt_count AS n, sharing_prompt_opted_out AS stopped FROM score_profiles WHERE user_id = $1`, [id])).rows[0];
    const setLastShown = (id, days) => q(`UPDATE score_profiles SET sharing_prompt_last_shown_at = now() - ($2 || ' days')::interval WHERE user_id = $1`, [id, String(days)]);
    const r1 = await api("POST", "/auth/register", { body: { email: `score_prompt_${uniq}@test.com`, password: "Sup3rSecret!", fullName: "Prompt Person" } });
    const pt = r1.body.token;
    const pid = (await api("GET", "/auth/me", { token: pt })).body.id;
    s = await api("GET", "/score/me", { token: pt });
    check("reminder due for a scored member who hasn't opted in", s.body.partnerPrompt?.due === true && s.body.partnerPrompt.intervalDays === 7);
    check("bad reminder action → 400", (await api("POST", "/score/partner-prompt", { token: pt, body: { action: "later" } })).status === 400);
    s = await api("POST", "/score/partner-prompt", { token: pt, body: { action: "shown" } });
    check("recording 'shown' starts the 7-day clock", s.status === 200 && s.body.partnerPrompt.due === false && (await promptState(pid)).n === 1);
    await setLastShown(pid, 6);
    check("not due again within 7 days", (await api("GET", "/score/me", { token: pt })).body.partnerPrompt.due === false);
    await setLastShown(pid, 8);
    check("due again after 7 days", (await api("GET", "/score/me", { token: pt })).body.partnerPrompt.due === true);
    check("invalid consent source → 400", (await api("PUT", "/score/settings", { token: pt, body: { partnerSharing: true, source: "popup" } })).status === 400);
    s = await api("PUT", "/score/settings", { token: pt, body: { partnerSharing: true, source: "prompt" } });
    check("opt-in from the reminder", s.body.partnerSharing.consented === true && s.body.partnerPrompt.due === false);
    const viaPrompt = (await q(`SELECT source FROM score_consent_log WHERE user_id = $1 AND action = 'sharing_granted'`, [pid])).rows[0];
    check("opt-in is attributed to the reminder", viaPrompt?.source === "prompt");
    await api("PUT", "/score/settings", { token: pt, body: { partnerSharing: false } });
    await setLastShown(pid, 30);
    s = await api("GET", "/score/me", { token: pt });
    check("opting out later stops reminders for good", s.body.partnerPrompt.due === false && (await promptState(pid)).stopped === true);

    const r2 = await api("POST", "/auth/register", { body: { email: `score_never_${uniq}@test.com`, password: "Sup3rSecret!", fullName: "Never Person" } });
    const nt = r2.body.token;
    const nid = (await api("GET", "/auth/me", { token: nt })).body.id;
    await api("GET", "/score/me", { token: nt });
    await api("POST", "/score/partner-prompt", { token: nt, body: { action: "shown" } });
    s = await api("POST", "/score/partner-prompt", { token: nt, body: { action: "never" } });
    await setLastShown(nid, 30);
    check("'Don't ask me again' stops reminders", (await api("GET", "/score/me", { token: nt })).body.partnerPrompt.due === false);
    const neverLog = (await q(`SELECT action, source FROM score_consent_log WHERE user_id = $1`, [nid])).rows;
    check("'Don't ask me again' is in the consent trail", neverLog.some((r) => r.action === "sharing_prompt_never" && r.source === "prompt"));
    check("can still opt in from settings after 'never'", (await api("PUT", "/score/settings", { token: nt, body: { partnerSharing: true } })).body.partnerSharing.consented === true);
    await api("PUT", "/score/settings", { token: nt, body: { enabled: false } });
    check("no reminder while the score is off", (await api("GET", "/score/me", { token: nt })).body.partnerPrompt.due === false);

    console.log("admin");
    check("non-admin blocked from stats", (await api("GET", "/admin/score/stats", { token })).status === 403);
    const areg = await api("POST", "/auth/register", { body: { email: adminEmail, password: "Sup3rSecret!", fullName: "Score Admin" } });
    const admin = areg.body.token;
    const st = await api("GET", "/admin/score/stats", { token: admin });
    check("admin stats load", st.status === 200 && st.body.programEnabled === true && st.body.distribution?.length === 4, `status ${st.status}`);
    check("admin sees snapshots collected", st.body.snapshots?.total >= 2 && st.body.scoredMembers >= 2);
    check("admin sees consent trail", st.body.recentConsent?.length > 0);
    check("admin sees reminder conversion", st.body.partnerPrompt?.membersPrompted >= 2 && st.body.partnerPrompt.optInsFromPrompt >= 1 && st.body.partnerPrompt.conversionPct > 0 && st.body.partnerPrompt.remindersStopped >= 2);
    check("admin consent trail carries the source", st.body.recentConsent.some((c) => c.source === "prompt"));
    const users = await api("GET", "/admin/users", { token: admin });
    const row = users.body.users?.find((u) => u.id === userId);
    check("admin users list shows score", row?.score === activeScore && row?.scoreBand);

    console.log("program master switch");
    const off = await api("PUT", "/admin/feature-flags", { token: admin, body: { scoreProgramEnabled: false } });
    check("admin can pause the program", off.status === 200 && off.body.scoreProgramEnabled === false);
    s = await api("GET", "/score/me", { token });
    check("paused program shows no score", s.body.programEnabled === false && s.body.score === null);
    const on = await api("PUT", "/admin/feature-flags", { token: admin, body: { scoreProgramEnabled: true } });
    check("admin can resume the program", on.body.scoreProgramEnabled === true);
  } finally {
    server.kill();
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
