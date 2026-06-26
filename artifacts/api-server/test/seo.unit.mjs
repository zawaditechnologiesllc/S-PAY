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
