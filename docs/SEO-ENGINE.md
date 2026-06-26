# SEO Content Engine

> Turns Google Search Console performance into reviewed, published blog content
> that compounds organic acquisition — the lowest-CAC channel S-PAY has. Built
> honest-by-construction: no scraping, no fake data, nothing auto-published.

## The loop

```
GSC Search Analytics ─▶ opportunity ranker ─▶ Gemini 2.5 Flash draft (grounded)
        ▲                                              │
        │                                              ▼
   feedback (impressions) ◀── published /blog ◀── admin review + approve
```

1. **Ingest** real query performance from Google Search Console (official API).
2. **Rank** "striking-distance" opportunities — queries where we already rank
   ~#5–20 and a content push can win page 1 (`rankOpportunities`, a pure,
   testable function) — plus topic ideas mined from Reddit.
3. **Draft** a post with **Gemini 2.5 Flash** (`gemini-2.5-flash`, free tier),
   strictly **grounded in true product facts** so it can't invent features,
   rates, or earnings claims.

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
countries, expats, and marketing/SEO). It reads `top.json` per subreddit with
**bounded concurrency** and caches results briefly. Titles are *idea seeds* for
drafts, never published verbatim.

**Reddit blocks datacenter IPs**, so the public JSON returns nothing from a plain
server. Two ways to make it work — pick either (no need for both):

1. **Proxy (no Reddit app — recommended when API access is slow to get).** Set
   `SEO_REDDIT_PROXY_URL` to a residential/rotating proxy
   (`http://user:pass@gateway:port`; comma-separate several to rotate). Requests
   to `www.reddit.com` / `old.reddit.com` then look like ordinary traffic and
   succeed. This avoids Reddit's *commercial Data API* approval (which can take
   months) entirely.
2. **Official OAuth.** Create an app at `reddit.com/prefs/apps` (type
   "script"/"web app" — instant) and set `REDDIT_CLIENT_ID` +
   `REDDIT_CLIENT_SECRET`; the engine uses `oauth.reddit.com`.

If neither is set, `/admin/seo/status` shows Reddit as not-connected **with the
reason**, and the topics panel explains exactly what to set.

## Honest gating (nothing fakes data)

| Integration | Off (default) | On |
|---|---|---|
| **Search Console** | `opportunities` returns `configured:false` + empty | set `GSC_SERVICE_ACCOUNT_JSON` + `GSC_SITE_URL` |
| **Analytics (GA4)** | `analytics` returns `configured:false` + empty | set `GA4_PROPERTY_ID` (+ a service account) |
| **Reddit topics** | public JSON (often 403-blocked) | set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` for the official API |
| **AI drafting** | `POST /admin/seo/drafts` → honest `503` | set `GEMINI_API_KEY` |

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
| `SEO_REDDIT_PROXY_URL` | Residential/rotating proxy for Reddit's public JSON — the no-app path past datacenter-IP 403s. One or more (comma-separated) `http://user:pass@host:port`. |
| `REDDIT_CLIENT_ID` | Reddit app client id — enables the official OAuth API (reddit.com/prefs/apps, instant to create). |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret (pairs with `REDDIT_CLIENT_ID`) |
| `SEO_REDDIT_ENABLED` | Set `false` to disable Reddit mining (default on) |
| `SEO_REDDIT_SUBREDDITS` | Optional comma-separated override of the ~100 subreddits (capped at 100) |
| `SEO_REDDIT_CONCURRENCY` | Parallel subreddit fetches (default 5, max 12) |
| `SEO_REDDIT_CACHE_TTL_SEC` | How long to cache Reddit results (default 900s; 0 disables) |
| `SEO_REDDIT_USER_AGENT` | Optional custom User-Agent for Reddit requests |
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
(`pnpm --filter @workspace/api-server test`): the opportunity ranker, `slugify`,
`deriveAudience`, `articleJsonLd`, the honest-gating contracts (`combinedResearch`
empty until configured, `generateBlogDraft` throwing until `GEMINI_API_KEY` is
set), and the security-critical `mdToHtml` sanitizer (escapes raw HTML, rejects
`javascript:` and protocol-relative `//host` links, allows https + same-origin).
