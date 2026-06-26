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

### Reddit topic mining (old.reddit, no OAuth)

The official Reddit API is heavily gated, so topic mining uses the **public
old.reddit JSON** endpoints (`old.reddit.com/r/<sub>/top.json`) instead — no
auth. It stays polite: a descriptive User-Agent, a **capped allowlist of ~50
project-related subreddits**, a small per-sub limit, and a delay between calls.
Titles are *idea seeds* for drafts, never published verbatim.

## Honest gating (nothing fakes data)

| Integration | Off (default) | On |
|---|---|---|
| **Search Console** | `opportunities` returns `configured:false` + empty | set `GSC_SERVICE_ACCOUNT_JSON` + `GSC_SITE_URL` |
| **AI drafting** | `POST /admin/seo/drafts` → honest `503` | set `GEMINI_API_KEY` |

It never invents query data or articles; until configured it says so.

## Env vars

| Var | Purpose |
|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | Google service-account JSON for Search Console API |
| `GSC_SITE_URL` | The verified GSC property (e.g. `https://spayewallet.com/`) |
| `GA4_PROPERTY_ID` | Google Analytics 4 property id (feedback: which content performs) |
| `GA4_SERVICE_ACCOUNT_JSON` | Service account for the GA4 Data API (falls back to `GSC_SERVICE_ACCOUNT_JSON`) |
| `GEMINI_API_KEY` | Google Gemini API key (AI Studio) — Gemini 2.5 Flash drafting |
| `SEO_DRAFT_MODEL` | Optional model override (default `gemini-2.5-flash`) |
| `SEO_REDDIT_ENABLED` | Set `false` to disable Reddit mining (default on) |
| `SEO_REDDIT_SUBREDDITS` | Optional comma-separated override of the ~50 subreddits |
| `SEO_REDDIT_USER_AGENT` | Optional custom User-Agent for old.reddit requests |
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

## Remaining (Phase 2 — labelled honestly, not built)

- **Wire the GSC API call** — `fetchSearchAnalytics` returns `[]` when creds are
  present; the service-account token exchange + Search Analytics POST is the one
  remaining step (the row shape already matches the API response).
- **GA4 Data API** ingest (engagement/conversions per landing page).
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
