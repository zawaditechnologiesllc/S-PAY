# Reusable prompt — build this SEO content engine on any site

> Paste the block below into your other project's AI assistant (or hand it to a
> developer). It fully specifies the SEO section S-PAY uses, in a stack-agnostic
> way, so you can rebuild it cleanly on a confusing site. Replace the bracketed
> `[[PRODUCT FACTS]]` with the truth about that product.

---

You are building an **SEO content engine** for a website. Build it exactly to
this spec. It must be **research-driven** (the system, not a human, chooses what
to write about and for whom), **honest by construction** (it never fabricates
data and nothing publishes without human approval), and aligned with **Google's
2026 search guidance**.

## 1. The loop

```
Research signals ─▶ rank opportunities ─▶ AI draft (grounded) ─▶ human review/approve ─▶ publish (+ schema) ─▶ feedback
        ▲                                                                                                        │
        └────────────────────────────── analytics feeds the next round ◀──────────────────────────────────────┘
```

## 2. Data sources (research) — official/public only, never scrape Google

1. **Google Search Console (Search Analytics API)** — real queries with
   impressions, clicks, CTR, average position. The primary opportunity source.
2. **Google Analytics 4 (Data API)** — sessions, engagement rate, conversions
   per landing page. The feedback signal: which content actually performs.
3. **Reddit topic mining via public `old.reddit.com/r/<sub>/top.json`** (no
   OAuth — the official API is heavily gated). Use a **capped allowlist (~50)**
   of subreddits relevant to the product, a polite descriptive `User-Agent`, a
   small per-sub limit, and a short delay between requests. Titles are *idea
   seeds*, never facts to publish.

**Honest gating:** each source returns `null`/`configured:false` until its
credentials are set, and returns `[]` (never fabricated rows) if creds are
present but the API call isn't wired yet. Surface "connect X" states in the UI.

## 3. Opportunity ranking (pure, testable function)

Favor **"striking-distance"** queries — already ranking ~#5–20 (page 1–2) where
a content push can win — weighted by impressions. De-prioritize anything already
top-3 (little upside) or buried (needs more than one post). Output a sorted list
of `{ query, impressions, clicks, position, score, reason }`.

## 4. Research-driven keyword + audience (NO manual input)

- The **keyword** always comes from research: a one-click **"Draft"** on any GSC
  opportunity or Reddit topic, plus an **"Auto-draft"** that picks the single
  best keyword (top GSC opportunity, else top Reddit topic) with zero input.
- The **audience is derived server-side** from the research context: map the
  **subreddit** to an audience (e.g. `r/Kenya` → "remote workers in Kenya",
  `r/freelance` → "freelancers"), or detect country/role terms in the keyword;
  fall back to the product's core audience. The admin never types a keyword or
  audience.

## 5. AI draft generation — grounded + Google-2026 rules

Generate drafts with a fast model — **Gemini 2.5 Flash** (`gemini-2.5-flash`) is
the default because it has a free tier. Call the Generative Language API
`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
with header `x-goog-api-key: {GEMINI_API_KEY}`, a `systemInstruction.parts[].text`,
a user `contents[].parts[].text`, and `generationConfig.responseMimeType:
"application/json"` so it returns clean JSON. The system prompt MUST include both:

**(a) PRODUCT FACTS** — the only things the model may assert. `[[PRODUCT FACTS]]`:
a short, true list of what the product is/does, its audience, and explicit
"do NOT claim" items (no invented stats, prices, rates, guarantees, or features).

**(b) GOOGLE 2026 SEO RULES** — every draft must follow all of these:
1. People-first, helpful content that fully satisfies search intent; write for humans.
2. E-E-A-T: show Experience + Expertise; be Authoritative and Trustworthy; no generic "AI slop".
3. Original value (examples, steps, insight); no keyword stuffing or auto-spun text.
4. Structure: one H1 (the title), logical H2/H3, answer front-loaded, short paragraphs, bullet lists, step-by-steps where useful.
5. Title ≤60 chars, specific, primary keyword included naturally; no clickbait/ALL CAPS.
6. Meta description ≤155 chars, accurate, earns the click.
7. Natural language + related terms/synonyms; cover sub-questions (semantic completeness) instead of repeating the exact phrase.
8. Include a concise FAQ (2–4 real questions) and a short key-takeaways list near the top.
9. YMYL accuracy (especially finance/health): be precise and conservative; note that availability/limits vary; never invent figures.
10. Plain English (~8th-grade), define jargon, present tense, active voice.
11. One soft, honest CTA + 1–2 descriptive internal-link anchors.
12. Accessibility/mobile-first: meaningful link text (never "click here"), alt text for any images; assume a phone on a slow connection.
13. No manipulation: no cloaking, doorways, hidden text, fake authorship, or scaled-content abuse.

Ask the model to return **strict JSON**: `{ title, metaDescription, excerpt,
bodyMarkdown }`.

## 6. Human review → approve → publish (nothing auto-publishes)

A draft is stored as `status = draft`. An admin reviews/edits (title, meta, slug,
body) and clicks **Approve & Publish** (→ `published`) or **Unpublish** (→
`archived`). Only `published` posts are public. This human gate is mandatory —
Google demotes unreviewed AI content.

## 7. Data model

`blog_posts`: `id, slug (unique), title, metaDescription, excerpt, keyword,
bodyMarkdown, status [draft|approved|published|archived], source [gsc|reddit],
model, reviewedBy, publishedAt, createdAt, updatedAt` (+ optional GSC snapshot:
impressions/clicks/position).

## 8. Public blog + structured data

`GET /blog` (published list) and `GET /blog/:slug` (one post). Each post page
emits **Article JSON-LD** (`headline`, `description`, `datePublished`,
`dateModified`, `publisher`, `author`, `mainEntityOfPage`). Add published URLs to
the sitemap and internal-link them from relevant pages.

## 9. API surface (adapt names to your stack)

- `GET /admin/seo/status` → `{ gscConfigured, ga4Configured, draftConfigured, redditEnabled }`
- `GET /admin/seo/opportunities` → ranked GSC opportunities (or `configured:false`)
- `GET /admin/seo/analytics` → GA4 top landing pages (or `configured:false`)
- `GET /admin/seo/reddit-topics` → mined topic ideas
- `POST /admin/seo/drafts` `{ keyword, source, subreddit? }` → generate from a researched keyword
- `POST /admin/seo/auto-draft` → research picks the keyword, then drafts
- `GET/PATCH /admin/seo/posts[/:id]`, `POST /admin/seo/posts/:id/publish` `/unpublish`
- `GET /blog`, `GET /blog/:slug`

## 10. Admin UI (one page, role-gated to editors+)

- A row of **status pills** (Search Console / Analytics / AI drafting / Reddit) —
  green when configured, grey otherwise.
- An **Auto-draft from research** button (one click, no input).
- **Search Console opportunities** and **Reddit topics** lists, each row with a
  one-click **Draft**.
- A **Top content (Analytics)** table (sessions / engagement / conversions).
- A **review queue**: list of posts with status badges + a full editor (title,
  slug, meta, body) and **Save / Approve & Publish / Unpublish / View** actions.

## 11. Environment variables

`GSC_SERVICE_ACCOUNT_JSON`, `GSC_SITE_URL`, `GA4_PROPERTY_ID`,
`GA4_SERVICE_ACCOUNT_JSON` (may reuse the GSC one), `GEMINI_API_KEY`,
optional `SEO_DRAFT_MODEL` (default `gemini-2.5-flash`),
`SEO_REDDIT_ENABLED|SUBREDDITS|USER_AGENT`, `SITE_URL`.

## 12. Non-negotiables

- Research chooses keyword + audience; the admin only reviews and approves.
- Never fabricate analytics, queries, stats, prices, or articles.
- Nothing publishes without human approval.
- Every draft obeys the PRODUCT FACTS and the Google-2026 rules.
- Keep the ranker a pure function; keep each integration honestly gated so the
  product is shippable before any key is set.
