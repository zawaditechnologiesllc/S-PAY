# SEO Content Engine

> Turns Google Search Console performance into reviewed, published blog content
> that compounds organic acquisition — the lowest-CAC channel S-PAY has. Built
> honest-by-construction: no scraping, no fake data, nothing auto-published.

> **The 12-month, 100M-organic-views plan lives in
> [SEO-GROWTH-STRATEGY.md](./SEO-GROWTH-STRATEGY.md)** — read it for how this
> engine + the programmatic jobs board pursue that goal honestly.

## The loop

```
GSC demand ┐                              ┌▶ SEO cross-check (auditDraft) ─▶ block/allow
           ├▶ combinedResearch ─▶ pain-   │
Reddit pain┘   (fuse + rank)     point ─▶ Gemini draft (grounded, solves the pain)
        ▲                                              │
        │                                              ▼
   GA4 feedback ◀──────── published /blog ◀── admin review + approve (+ cross-check)
```

1. **Ingest demand AND pain.** Google Search Console gives real query demand;
   Reddit (~100 niche subs) gives **complaints and unanswered questions**.
2. **Rank.** "Striking-distance" GSC opportunities (`rankOpportunities`, pure +
   testable) are fused with Reddit pain points (`classifyIntent` labels each post
   complaint/question/comparison; `combinedResearch` blends upvotes with the pain
   signal so real problems rank above generic chatter).
3. **Draft to the pain.** **Gemini 2.5 Flash** (`gemini-2.5-flash`, free tier),
   strictly **grounded in true product facts**, is briefed with the verbatim pain
   point so the post **names the reader's problem and walks them to a solution**
   (honestly positioning S-PAY where it genuinely helps) — never inventing
   features, rates, or earnings claims.
3a. **Cross-check before publish.** `auditDraft` scores every post against the
   2026 SEO rules; **error-severity failures block publishing** (human can
   override). This is the quality gate that keeps content compliant at scale.

> **Research chooses the keyword AND the audience — the admin never types
> either.** Each opportunity/topic has a one-click **Draft**, plus an
> **Auto-draft** that picks the single best keyword with no input at all. The
> audience is derived server-side (`deriveAudience`) from the research context.

> **Google + Reddit work together.** `combinedResearch()` merges GSC
> opportunities (real search demand) with Reddit topics (community interest),
> normalizes the two score scales, and **boosts overlaps to `source: "both"`** —
> those topics, validated by *both* signals, are the highest-confidence blogs to
> write and rise to the top of `GET /admin/seo/research` (the "Recommended"
> panel). Auto-draft picks from this combined list.

### Published posts route on real frontend URLs

- Public API: `GET /blog`, `GET /blog/:slug` (post + Article JSON-LD).
- SPA pages: `/blog` (list) and `/blog/:slug` (renders the Markdown body, sets
  title/meta, injects Article JSON-LD).
- **Bot SSR** (`routes/ssr.ts` → `/ssr/blog`, `/ssr/blog/:slug`): Googlebot and
  social crawlers get fully server-rendered HTML with Article JSON-LD via the
  `vercel.json` user-agent rewrites — compliant dynamic rendering, same content.
- **Sitemap**: published posts are added to `/api/sitemap.xml` (served at
  `/jobs-sitemap.xml`) so Google discovers and indexes them.
4. **Review + approve** in admin — a human edits and publishes. **Nothing
   auto-publishes** (Google demotes unreviewed AI content; grounding + a human
   gate keep posts truthful and on-message).

> **Google 2026 SEO rules are baked into generation.** Every draft is written
> against a `SEO_RULES_2026` ruleset in `lib/seo.ts` (people-first / helpful
> content, E-E-A-T, search-intent structure with one H1 + H2/H3, ≤60-char
> titles, ≤155-char meta, natural keywords + semantic coverage, an FAQ for rich
> results, YMYL accuracy with no invented stats/rates/fees, descriptive internal
> links + a single soft CTA, mobile-first/accessible, and no manipulation). Tune
> the rules in that one constant as Google's guidance evolves.
5. **Publish** to `/blog` with **Article JSON-LD** for rich results; published
   impressions feed the next ranking pass.

## What's live now (Phase 1, this change)

- **Schema:** `blog_posts` (draft → approved → published → archived; stores the
  GSC snapshot it was generated from).
- **Library** (`lib/seo.ts`): GSC ingest (honest-gated), the opportunity ranker
  (pure), Gemini 2.5 Flash draft generation (grounded, honest-gated), `slugify`,
  `articleJsonLd`.
- **Admin API** (`routes/seo.ts`, admin-gated):
  - `GET /admin/seo/status` — integration status.
  - `GET /admin/seo/opportunities` — ranked keywords (honest empty until GSC set).
  - `GET /admin/seo/reddit-topics` — topic ideas from old.reddit public JSON.
  - `POST /admin/seo/drafts` — generate a Gemini draft for a keyword.
  - `GET/PATCH /admin/seo/posts[/:id]` — review queue + edit.
  - `POST /admin/seo/posts/:id/publish` `/unpublish` — the human approval gate.
- **Admin UI:** `/admin/seo` ("SEO & Blog", manager+) — status, opportunities,
  Reddit topics, one-click draft generation, and the **review → approve →
  publish** queue with a full post editor. This is where publications are
  authorised.
- **Public API:** `GET /blog`, `GET /blog/:slug` (returns the post + Article
  JSON-LD).

### Reddit topic mining (~100 subreddits)

Topic mining crawls a **capped allowlist of ~100 niche subreddits** (remote work,
freelancing/gig, online income, personal finance, payments/fintech,
stablecoins/crypto, the dev communities that earn remotely, our corridor
countries, expats, and marketing/SEO). It reads each subreddit's `top.json` —
**old.reddit first** — classifies the intent of every post (complaint / question
/ comparison) and extracts pain points. Bounded concurrency keeps ~100 subs fast;
a 429 is retried once after `Retry-After`; results are cached briefly. Titles are
*idea seeds* for drafts, never published verbatim.

**No location proxies required.** Two location-neutral ways to read Reddit:

1. **old.reddit public JSON (default, zero config).** Works whenever **this
   server's own IP isn't blocked** by Reddit — no app, no proxy, no location
   change. Requests go to `old.reddit.com` (then `www.reddit.com`) with a browser
   User-Agent and a gentle request rate.
2. **Official OAuth (recommended for reliability).** Create an app at
   `reddit.com/prefs/apps` (type "script"/"web app" — **instant**, this is *not*
   the months-long commercial Data API program) and set `REDDIT_CLIENT_ID` +
   `REDDIT_CLIENT_SECRET`. The engine then uses `oauth.reddit.com`, which returns
   the **same JSON** and **works from a datacenter without changing location**.

> A proxy (`SEO_REDDIT_PROXY_URL`) remains supported but is **entirely optional**
> and is *not* required — use it only if your host IP is blocked and you'd rather
> not add an OAuth app. It need not be a location/residential proxy; any clean
> egress works.

If Reddit returns nothing, `/admin/seo/status` shows the reason and the topics
panel explains exactly what to set (it recommends the OAuth app).

## Honest gating (nothing fakes data)

| Integration | Off (default) | On |
|---|---|---|
| **Search Console** | `opportunities` returns `configured:false` + empty | set `GSC_SERVICE_ACCOUNT_JSON` + `GSC_SITE_URL` |
| **Analytics (GA4)** | `analytics` returns `configured:false` + empty | set `GA4_PROPERTY_ID` (+ a service account) |
| **Reddit topics** | old.reddit public JSON (works if the server IP isn't blocked) | set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` for the official API (location-neutral) |
| **AI drafting** | `POST /admin/seo/drafts` → honest `503` | set `GEMINI_API_KEY` |
| **SEO cross-check** | always on — `auditDraft` blocks publishing posts that fail a required rule (human-overridable) | — |

It never invents query data or articles; until configured it says so.

> **`/admin/seo/status` reports a LIVE connection**, not just whether an env var
> is present. If the service account is set but can't authenticate (bad key,
> property not verified for that account, base64/newline mangling), the status
> shows *not connected* **with the reason** — so "everything is set but it says
> not connected" is diagnosable instead of silent. The service-account JSON may
> be raw JSON or base64, and escaped `\n` in the PEM private key is repaired
> automatically.

## Env vars

| Var | Purpose |
|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | Google service-account JSON for Search Console API |
| `GSC_SITE_URL` | The verified GSC property (e.g. `https://spayewallet.com/`) |
| `GA4_PROPERTY_ID` | Google Analytics 4 property id (feedback: which content performs) |
| `GA4_SERVICE_ACCOUNT_JSON` | Service account for the GA4 Data API (falls back to `GSC_SERVICE_ACCOUNT_JSON`) |
| `GEMINI_API_KEY` | Google Gemini API key (AI Studio) — Gemini 2.5 Flash drafting |
| `SEO_DRAFT_MODEL` | Optional model override (default `gemini-2.5-flash`) |
| `REDDIT_CLIENT_ID` | **Recommended.** Reddit app client id — official OAuth API (reddit.com/prefs/apps, instant). Location-neutral; works from a datacenter. |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret (pairs with `REDDIT_CLIENT_ID`) |
| `SEO_REDDIT_ENABLED` | Set `false` to disable Reddit mining (default on) |
| `SEO_REDDIT_SUBREDDITS` | Optional comma-separated override of the ~100 subreddits (capped at 100) |
| `SEO_REDDIT_CONCURRENCY` | Parallel subreddit fetches (default 5 with OAuth/proxy, 2 unauthenticated; max 12) |
| `SEO_REDDIT_CACHE_TTL_SEC` | How long to cache Reddit results (default 900s; 0 disables) |
| `SEO_REDDIT_USER_AGENT` | Optional custom User-Agent for Reddit requests |
| `SEO_REDDIT_PROXY_URL` | **Optional, not required, not a location proxy.** Only if your host IP is blocked and you'd rather not add an OAuth app — any clean HTTP(S) proxy `http://user:pass@host:port` (comma-separate to rotate). |
| `SITE_URL` | Base URL for canonical/JSON-LD (already used elsewhere) |

## Why Gemini 2.5 Flash

It has a **generous free tier** (the deciding factor), is fast, and follows the
strict-JSON grounded prompt well. We call the Generative Language API's
`:generateContent` with `responseMimeType: "application/json"`, so Gemini returns
clean JSON we parse directly. The model isn't the bottleneck anyway — the **GSC
feedback loop + the human review gate + factual grounding** are what move
rankings and protect the brand. `SEO_DRAFT_MODEL` lets you swap models (any
Gemini model id) without code changes.

**Setup:** create a key at [Google AI Studio](https://aistudio.google.com/apikey),
set `GEMINI_API_KEY` on the API server, and drafting switches on immediately.

## What's wired live

- **Search Console** — `fetchSearchAnalytics` signs a service-account JWT,
  exchanges it for an access token, and POSTs to the Search Analytics API
  (`dimensions:["query"]`), feeding the opportunity ranker with real query data.
- **GA4 Data API** — `fetchGa4LandingPages` runs a `runReport` for top landing
  pages (sessions / engagement / conversions). Reuses the GSC service account
  unless `GA4_SERVICE_ACCOUNT_JSON` is set.
- **Reddit** — official OAuth (`oauth.reddit.com`) when `REDDIT_CLIENT_ID` /
  `REDDIT_CLIENT_SECRET` are set, with a public-JSON fallback.

## Remaining (Phase 2 — labelled honestly, not built)

- **Persisted metrics table** for trend history + an automated re-ranking
  scheduler.
- **Internal linking** between published posts (the admin UI, public `/blog` API,
  Article JSON-LD, bot SSR, and **sitemap entries are all live now** — published
  posts are emitted in `/api/sitemap.xml`; richer cross-post linking remains).

## Tests

Pure, network-free logic is unit-tested in `artifacts/api-server/test/seo.unit.mjs`
(`pnpm --filter @workspace/api-server test`, 37 tests): the opportunity ranker,
`slugify`, `deriveAudience`, `articleJsonLd`, `parseServiceAccount` /
`parseProxyConfig` / the GSC+GA4 row mappers, `redditSubreddits` (dedupe/cap), and:

- **`classifyIntent`** — complaint / question / comparison / discussion detection
  (the pain-point signal).
- **`normalizeArticleBody`** — demotes body H1s to H2 so the page has a single H1.
- **`auditDraft`** — the SEO cross-check: a compliant draft passes; an over-long
  title + duplicate body H1 + missing meta/CTA is blocked with the failing checks.
- the honest-gating contracts (`combinedResearch` empty until configured,
  `generateBlogDraft` throwing until `GEMINI_API_KEY` is set), and the
  security-critical `mdToHtml` sanitizer (escapes raw HTML, rejects `javascript:`
  and protocol-relative `//host` links, allows https + same-origin).
