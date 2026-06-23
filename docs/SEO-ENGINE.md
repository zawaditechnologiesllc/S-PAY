# SEO Content Engine

> Turns Google Search Console performance into reviewed, published blog content
> that compounds organic acquisition — the lowest-CAC channel S-PAY has. Built
> honest-by-construction: no scraping, no fake data, nothing auto-published.

## The loop

```
GSC Search Analytics ─▶ opportunity ranker ─▶ Claude Haiku draft (grounded)
        ▲                                              │
        │                                              ▼
   feedback (impressions) ◀── published /blog ◀── admin review + approve
```

1. **Ingest** real query performance from Google Search Console (official API).
2. **Rank** "striking-distance" opportunities — queries where we already rank
   ~#5–20 and a content push can win page 1 (`rankOpportunities`, a pure,
   testable function).
3. **Draft** a post with **Claude Haiku** (`claude-haiku-4-5`), strictly
   **grounded in true product facts** so it can't invent features, rates, or
   earnings claims.
4. **Review + approve** in admin — a human edits and publishes. **Nothing
   auto-publishes** (Google demotes unreviewed AI content; grounding + a human
   gate keep posts truthful and on-message).
5. **Publish** to `/blog` with **Article JSON-LD** for rich results; published
   impressions feed the next ranking pass.

## What's live now (Phase 1, this change)

- **Schema:** `blog_posts` (draft → approved → published → archived; stores the
  GSC snapshot it was generated from).
- **Library** (`lib/seo.ts`): GSC ingest (honest-gated), the opportunity ranker
  (pure), Claude Haiku draft generation (grounded, honest-gated), `slugify`,
  `articleJsonLd`.
- **Admin API** (`routes/seo.ts`, admin-gated):
  - `GET /admin/seo/status` — integration status.
  - `GET /admin/seo/opportunities` — ranked keywords (honest empty until GSC set).
  - `GET /admin/seo/reddit-topics` — topic ideas from old.reddit public JSON.
  - `POST /admin/seo/drafts` — generate a Haiku draft for a keyword.
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
| **AI drafting** | `POST /admin/seo/drafts` → honest `503` | set `ANTHROPIC_API_KEY` |

It never invents query data or articles; until configured it says so.

## Env vars

| Var | Purpose |
|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | Google service-account JSON for Search Console API |
| `GSC_SITE_URL` | The verified GSC property (e.g. `https://spayewallet.com/`) |
| `ANTHROPIC_API_KEY` | Claude Haiku drafting |
| `SEO_DRAFT_MODEL` | Optional model override (default `claude-haiku-4-5-20251001`) |
| `SEO_REDDIT_ENABLED` | Set `false` to disable Reddit mining (default on) |
| `SEO_REDDIT_SUBREDDITS` | Optional comma-separated override of the ~50 subreddits |
| `SEO_REDDIT_USER_AGENT` | Optional custom User-Agent for old.reddit requests |
| `SITE_URL` | Base URL for canonical/JSON-LD (already used elsewhere) |

## Why Claude Haiku (not Gemini Flash)

Comparable cost and latency, strong instruction-following for the strict-JSON
grounded prompt, and it keeps drafting on one stack we control and can ground
tightly. The model is not the bottleneck — the **GSC feedback loop + the human
review gate + factual grounding** are what actually move rankings and protect
the brand. `SEO_DRAFT_MODEL` lets you swap if you ever want to.

## Remaining (Phase 2 — labelled honestly, not built)

- **Wire the GSC API call** — `fetchSearchAnalytics` returns `[]` when creds are
  present; the service-account token exchange + Search Analytics POST is the one
  remaining step (the row shape already matches the API response).
- **GA4 Data API** ingest (engagement/conversions per landing page).
- **Persisted metrics table** for trend history + an automated re-ranking
  scheduler.
- **Sitemap entries + internal linking** for published posts (the admin UI,
  public `/blog` API, and Article JSON-LD are live; sitemap wiring remains).
