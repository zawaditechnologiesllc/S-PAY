// Unit tests for the SEO content engine's pure, network-free logic — the
// opportunity ranker, slug/audience derivation, Article JSON-LD, combined
// research gating, and the Markdown→HTML sanitizer that guards AI-generated
// blog bodies. No database, no network, no API keys.
//
//   node --test test/seo.unit.mjs
//
// lib/seo.ts uses TypeScript + extensionless internal imports, so we bundle it
// with esbuild (already a dev dependency, same as the server build) into a
// temporary ESM module and import that. The dependency-free web Markdown
// renderer is imported directly via Node's TypeScript type-stripping.

import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { unlinkSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");

// Reddit mining is the only network path combinedResearch() can touch — keep it
// off so the suite is deterministic and offline.
process.env.SEO_REDDIT_ENABLED = "false";

// Bundle lib/seo.ts (externalizing node_modules) into the package dir so Node
// can still resolve axios/pino from api-server/node_modules.
const bundlePath = join(pkgRoot, ".seo-test-bundle.mjs");
await build({
  entryPoints: [join(pkgRoot, "src/lib/seo.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
  packages: "external",
  logLevel: "silent",
});
const seo = await import(bundlePath);
unlinkSync(bundlePath);

// The web SPA's Markdown renderer mirrors the SSR one; no imports, so Node's
// type-stripping loads it directly.
const { mdToHtml } = await import(join(pkgRoot, "../web/src/lib/markdown.ts"));

// ─── rankOpportunities ──────────────────────────────────────────────────────────

test("rankOpportunities drops zero-impression rows", () => {
  const out = seo.rankOpportunities([
    { query: "ghost", impressions: 0, clicks: 0, ctr: 0, position: 8 },
    { query: "real", impressions: 50, clicks: 1, ctr: 0.02, position: 8 },
  ]);
  assert.deepEqual(out.map((o) => o.query), ["real"]);
});

test("rankOpportunities favours striking-distance (pos 5–10) over top-3 and buried", () => {
  const rows = [
    { query: "won", impressions: 1000, clicks: 200, ctr: 0.2, position: 2 },   // already top-3
    { query: "striking", impressions: 1000, clicks: 20, ctr: 0.02, position: 7 }, // best upside
    { query: "buried", impressions: 1000, clicks: 1, ctr: 0.001, position: 80 }, // far
  ];
  const out = seo.rankOpportunities(rows);
  assert.equal(out[0].query, "striking", "striking-distance query should rank first");
  const won = out.find((o) => o.query === "won");
  const striking = out.find((o) => o.query === "striking");
  assert.ok(striking.score > won.score, "equal impressions: striking distance outscores top-3");
});

test("rankOpportunities is sorted by score desc and respects the limit", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({
    query: `q${i}`, impressions: (i + 1) * 10, clicks: i, ctr: 0.01, position: 7,
  }));
  const out = seo.rankOpportunities(rows, 5);
  assert.equal(out.length, 5);
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
});

test("rankOpportunities annotates each opportunity with a human-readable band", () => {
  const [o] = seo.rankOpportunities([{ query: "k", impressions: 100, clicks: 2, ctr: 0.02, position: 6.4 }]);
  assert.match(o.reason, /striking distance/);
  assert.equal(o.position, 6.4); // rounded to 1dp, not mangled
});

// ─── slugify ──────────────────────────────────────────────────────────────────────

test("slugify lowercases, strips punctuation, and collapses separators", () => {
  assert.equal(seo.slugify("  Hello, World!  How-To 2026  "), "hello-world-how-to-2026");
});

test("slugify drops non-ascii and never yields leading/trailing dashes", () => {
  const s = seo.slugify("Héllo — Wörld!!!");
  assert.equal(s, "hllo-wrld");
  assert.ok(!s.startsWith("-") && !s.endsWith("-"));
});

test("slugify caps length at 80 chars", () => {
  assert.ok(seo.slugify("a ".repeat(100)).length <= 80);
});

test("slugify falls back to a post-<ts> slug when nothing survives", () => {
  assert.match(seo.slugify("!!! @@@ ###"), /^post-\d+$/);
});

// ─── deriveAudience ─────────────────────────────────────────────────────────────

test("deriveAudience maps a known subreddit to its audience", () => {
  assert.equal(seo.deriveAudience({ keyword: "x", subreddit: "digitalnomad" }), "digital nomads");
});

test("deriveAudience falls back to the community for an unknown subreddit", () => {
  assert.equal(seo.deriveAudience({ keyword: "x", subreddit: "WeirdSub" }), "the r/WeirdSub community");
});

test("deriveAudience combines role + country from the keyword", () => {
  assert.equal(seo.deriveAudience({ keyword: "best freelance sites in kenya" }), "freelancers in Kenya");
});

test("deriveAudience returns the core audience when nothing matches", () => {
  assert.equal(seo.deriveAudience({ keyword: "how to get paid online" }), "remote workers and the businesses that pay them");
});

// ─── articleJsonLd ──────────────────────────────────────────────────────────────

test("articleJsonLd builds valid schema.org Article with a clean canonical URL", () => {
  const ld = seo.articleJsonLd(
    { slug: "get-paid-globally", title: "Get paid globally", metaDescription: "How to.", excerpt: null,
      publishedAt: new Date("2026-01-02T00:00:00Z"), updatedAt: new Date("2026-01-03T00:00:00Z") },
    "https://spayewallet.com/", // trailing slash must not double up
  );
  assert.equal(ld["@type"], "Article");
  assert.equal(ld.url, "https://spayewallet.com/blog/get-paid-globally");
  assert.equal(ld.datePublished, "2026-01-02T00:00:00.000Z");
  assert.equal(ld.dateModified, "2026-01-03T00:00:00.000Z");
  assert.equal(ld.description, "How to.");
});

test("articleJsonLd falls back to updatedAt when never published, and excerpt when no meta", () => {
  const updated = new Date("2026-01-05T00:00:00Z");
  const ld = seo.articleJsonLd(
    { slug: "s", title: "t", metaDescription: null, excerpt: "the excerpt", publishedAt: null, updatedAt: updated },
    "https://spayewallet.com",
  );
  assert.equal(ld.datePublished, updated.toISOString());
  assert.equal(ld.description, "the excerpt");
});

// ─── parseServiceAccount (credential robustness) ────────────────────────────────

import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

test("parseServiceAccount accepts raw JSON and restores escaped newlines in the key", () => {
  // Simulate an env-mangled key where real newlines became literal "\n".
  const raw = JSON.stringify({ client_email: "sa@x.iam", private_key: PEM.replace(/\n/g, "\\n") });
  const sa = seo.parseServiceAccount(raw);
  assert.ok(sa, "should parse");
  assert.ok(sa.private_key.includes("\n") && !sa.private_key.includes("\\n"), "newlines restored");
  // The restored key must actually be usable by the RS256 signer.
  const token = jwt.sign({ scope: "test" }, sa.private_key, { algorithm: "RS256", issuer: sa.client_email, audience: "https://oauth2.googleapis.com/token", expiresIn: 60 });
  assert.equal(typeof token, "string");
});

test("parseServiceAccount accepts base64-encoded JSON", () => {
  const json = JSON.stringify({ client_email: "sa@x.iam", private_key: PEM });
  const sa = seo.parseServiceAccount(Buffer.from(json, "utf8").toString("base64"));
  assert.ok(sa);
  assert.equal(sa.client_email, "sa@x.iam");
});

test("parseServiceAccount returns null for missing/invalid/incomplete creds", () => {
  assert.equal(seo.parseServiceAccount(undefined), null);
  assert.equal(seo.parseServiceAccount(""), null);
  assert.equal(seo.parseServiceAccount("not json"), null);
  assert.equal(seo.parseServiceAccount(JSON.stringify({ client_email: "x" })), null); // no private_key
});

// ─── API response mappers (pure) ────────────────────────────────────────────────

test("mapSearchAnalyticsRows maps GSC rows and drops empty queries", () => {
  const rows = seo.mapSearchAnalyticsRows([
    { keys: ["get paid online"], impressions: 120, clicks: 4, ctr: 0.033, position: 7.2 },
    { keys: [""], impressions: 9, clicks: 0, ctr: 0, position: 50 },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { query: "get paid online", impressions: 120, clicks: 4, ctr: 0.033, position: 7.2 });
});

test("mapSearchAnalyticsRows tolerates non-array / missing fields", () => {
  assert.deepEqual(seo.mapSearchAnalyticsRows(undefined), []);
  assert.deepEqual(seo.mapSearchAnalyticsRows(null), []);
});

test("mapGa4Rows maps landing-page rows and drops empty pages", () => {
  const rows = seo.mapGa4Rows([
    { dimensionValues: [{ value: "/blog/x" }], metricValues: [{ value: "500" }, { value: "0.62" }, { value: "12" }] },
    { dimensionValues: [{ value: "" }], metricValues: [{ value: "1" }, { value: "0" }, { value: "0" }] },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { page: "/blog/x", sessions: 500, engagementRate: 0.62, conversions: 12 });
});

test("parseRedditListing extracts non-stickied posts with absolute URLs", () => {
  const topics = seo.parseRedditListing("freelance", {
    data: { children: [
      { data: { title: "How I get paid", permalink: "/r/freelance/abc", score: 88, num_comments: 12 } },
      { data: { title: "Pinned", stickied: true, score: 999 } },
      { data: { score: 5 } }, // no title → skipped
    ] },
  });
  assert.equal(topics.length, 1);
  assert.equal(topics[0].title, "How I get paid");
  assert.equal(topics[0].url, "https://www.reddit.com/r/freelance/abc");
  assert.equal(topics[0].score, 88);
});

// ─── parseProxyConfig (Reddit proxy plumbing) ───────────────────────────────────

test("parseProxyConfig parses a full proxy URL with credentials", () => {
  const p = seo.parseProxyConfig("http://user:p%40ss@gw.example.com:7777");
  assert.deepEqual(p, { host: "gw.example.com", port: 7777, protocol: "http", auth: { username: "user", password: "p@ss" } });
});

test("parseProxyConfig accepts a bare host:port (defaults to http)", () => {
  const p = seo.parseProxyConfig("gw.example.com:8080");
  assert.equal(p.host, "gw.example.com");
  assert.equal(p.port, 8080);
  assert.equal(p.protocol, "http");
  assert.equal(p.auth, undefined);
});

test("parseProxyConfig defaults the port by scheme and returns null on junk", () => {
  assert.equal(seo.parseProxyConfig("https://proxy.example.com").port, 443);
  assert.equal(seo.parseProxyConfig(""), null);
  assert.equal(seo.parseProxyConfig(undefined), null);
});

// ─── redditSubreddits (the ~100-sub allowlist) ──────────────────────────────────

test("redditSubreddits returns the de-duped, capped default niche list", () => {
  const subs = seo.redditSubreddits();
  assert.ok(subs.length >= 90 && subs.length <= 100, `expected ~100 subs, got ${subs.length}`);
  const lower = subs.map((s) => s.toLowerCase());
  assert.equal(new Set(lower).size, lower.length, "no duplicates");
  for (const core of ["kenya", "nigeria", "freelance", "cryptocurrency", "stablecoins", "celo", "payoneer"]) {
    assert.ok(lower.includes(core), `expected core sub r/${core}`);
  }
});

test("redditSubreddits honours SEO_REDDIT_SUBREDDITS override and the cap", () => {
  const prev = process.env.SEO_REDDIT_SUBREDDITS;
  process.env.SEO_REDDIT_SUBREDDITS = Array.from({ length: 150 }, (_, i) => `sub${i}`).join(",");
  const subs = seo.redditSubreddits();
  assert.equal(subs.length, 100, "capped at 100");
  if (prev === undefined) delete process.env.SEO_REDDIT_SUBREDDITS; else process.env.SEO_REDDIT_SUBREDDITS = prev;
});

// ─── classifyIntent (pain-point detection) ──────────────────────────────────────

test("classifyIntent flags complaints with the highest pain score", () => {
  for (const s of ["Wise charged me crazy fees again", "My account got frozen", "Payoneer is a scam avoid it", "transfer stuck for 5 days"]) {
    const r = seo.classifyIntent(s);
    assert.equal(r.intent, "complaint", `expected complaint for: ${s}`);
    assert.equal(r.painScore, 1);
  }
});

test("classifyIntent detects comparisons and questions over plain discussion", () => {
  assert.equal(seo.classifyIntent("Wise vs Payoneer for freelancers").intent, "comparison");
  assert.equal(seo.classifyIntent("alternatives to PayPal in Kenya").intent, "comparison");
  assert.equal(seo.classifyIntent("How do I get paid from Upwork in Nigeria?").intent, "question");
  assert.equal(seo.classifyIntent("Sharing my remote work setup").intent, "discussion");
});

// ─── normalizeArticleBody (single-H1 fix) ───────────────────────────────────────

test("normalizeArticleBody demotes body H1s to H2 (title is the page H1)", () => {
  const out = seo.normalizeArticleBody("# Big title\n\nIntro.\n\n## Section\n\n### Sub\n\nText # not a heading");
  assert.ok(!/^#\s/m.test(out), "no H1 lines remain");
  assert.ok(out.includes("## Big title"), "H1 demoted to H2");
  assert.ok(out.includes("## Section") && out.includes("### Sub"), "existing H2/H3 untouched");
  assert.ok(out.includes("Text # not a heading"), "inline # left alone");
});

// ─── auditDraft (SEO cross-check) ───────────────────────────────────────────────

const GOOD_BODY = [
  "## Key takeaways", "- Get paid globally", "- Cash out locally",
  "## The problem", "Freelancers lose money to fees. ".repeat(60),
  "## How to fix it", "Open a free S-PAY account and get paid. See the [jobs board](/jobs).",
  "## FAQ", "### Is it free?", "Yes.", "### Which countries?", "Many — varies by country.",
].join("\n\n");

test("auditDraft passes a compliant draft", () => {
  const a = seo.auditDraft({
    title: "Get paid globally as a freelancer",
    metaDescription: "How freelancers get paid globally and cash out locally with low fees.",
    excerpt: "A practical guide for freelancers.",
    bodyMarkdown: GOOD_BODY,
    keyword: "get paid globally",
  });
  assert.equal(a.pass, true, JSON.stringify(a.checks.filter((c) => !c.ok)));
  assert.ok(a.score >= 85);
  assert.equal(a.errors, 0);
});

test("auditDraft blocks an over-long title, a body H1, and a missing CTA", () => {
  const a = seo.auditDraft({
    title: "This is an extremely long blog title that clearly exceeds the sixty character SEO limit",
    metaDescription: "",
    bodyMarkdown: "# Duplicate H1\n\nThin content with no call to action.",
    keyword: "x",
  });
  assert.equal(a.pass, false);
  const failed = new Set(a.checks.filter((c) => !c.ok).map((c) => c.id));
  assert.ok(failed.has("title_len"), "title length should fail");
  assert.ok(failed.has("single_h1"), "body H1 should fail");
  assert.ok(failed.has("meta_present"), "missing meta should fail");
  assert.ok(failed.has("cta"), "missing CTA should fail");
  assert.ok(a.errors >= 3);
});

// ─── combinedResearch (honest gating, offline) ──────────────────────────────────

test("combinedResearch is honest and empty when GSC is unset and Reddit is disabled", async () => {
  const { candidates, gscConfigured, redditEnabled } = await seo.combinedResearch();
  assert.deepEqual(candidates, []);
  assert.equal(gscConfigured, false);
  assert.equal(redditEnabled, false);
});

// ─── isDraftConfigured / DraftNotConfiguredError (honest gating) ─────────────────

test("generateBlogDraft throws DraftNotConfiguredError until GEMINI_API_KEY is set", async () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal(seo.isDraftConfigured(), false);
  await assert.rejects(() => seo.generateBlogDraft("kw"), (e) => e instanceof seo.DraftNotConfiguredError);
  if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
});

// ─── mdToHtml sanitizer (security-critical for AI-generated bodies) ──────────────

test("mdToHtml escapes raw HTML and never emits a script tag", () => {
  const html = mdToHtml("Hello <script>alert(1)</script> & <b>x</b>");
  assert.ok(!/<script/i.test(html));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("mdToHtml rejects javascript: links (left as inert text)", () => {
  const html = mdToHtml("[x](javascript:alert(1))");
  assert.ok(!/<a /i.test(html), "javascript: URL must not become an anchor");
});

test("mdToHtml rejects protocol-relative //host links but allows https and relative", () => {
  const html = mdToHtml("[a](//evil.com/x) [b](/jobs) [c](https://s-pay.com)");
  assert.ok(!html.includes('href="//evil.com/x"'), "protocol-relative off-site link must be rejected");
  assert.ok(html.includes('href="/jobs"'), "same-origin relative link allowed");
  assert.ok(html.includes('href="https://s-pay.com"'), "https link allowed");
});

test("mdToHtml renders headings, bold, and lists", () => {
  const html = mdToHtml("# Title\n\n**bold**\n\n- one\n- two");
  assert.ok(html.includes("<h1>Title</h1>"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<ul>") && html.includes("<li>one</li>") && html.includes("<li>two</li>"));
});
