# SEO Growth Strategy — the path to 100M organic views / 12 months

> This is the honest plan behind the SEO engine. The code can't *guarantee*
> views (no code can — ranking depends on Google, competitors, domain authority,
> backlinks, and time). What the code does is build the machine that makes the
> goal reachable, and refuse to ship low-quality content that would sink it.

## The math (so the goal is concrete)

100,000,000 views in 12 months ≈ **8.3M/month ≈ 275K/day**. You don't get there
with a few hand-written blog posts. You get there with **scale × quality × time**,
on two compounding surfaces:

| Surface | What it is | Why it scales |
|---|---|---|
| **Programmatic pages** (jobs board) | Thousands of remote-job pages, refreshed hourly, each server-rendered for crawlers with `JobPosting` structured data, all in `/api/sitemap.xml`. | Volume: 3k–45k indexable URLs that turn over daily → long-tail "remote X job" queries at massive breadth. This is the primary view engine. |
| **Blog** (this engine) | Research-driven articles that answer real pain points with E-E-A-T quality. | Authority + mid/head-tail intent ("how to get paid from Upwork in Kenya"). Compounds as pages age and earn links. |

Realistically: the **jobs board is the volume driver** toward 8-figure monthly
views; the **blog builds the topical authority and converting traffic** that lifts
the whole domain (and the jobs pages with it). Both already feed one sitemap and
share the same SSR/structured-data pipeline.

## How the engine pursues it (what's in code)

1. **Listen for demand and pain.** Google Search Console gives real query demand
   (striking-distance keywords, `rankOpportunities`); Reddit (~100 niche subs)
   surfaces **complaints and unanswered questions** (`classifyIntent` →
   complaint/question/comparison). The two are fused in `combinedResearch`:
   topics validated by *both* search demand and community pain rise to the top.
2. **Write to the pain, offer the solution.** Each draft is briefed with the
   verbatim pain point (`DraftBrief.painPoint`) so the article names the reader's
   real problem and walks them to a solution — honestly positioning S-PAY where
   it genuinely helps (grounded in `PRODUCT_FACTS`, no invented claims).
3. **Cross-check every post against Google's rules.** `auditDraft` scores each
   draft against the 2026 ruleset (title ≤60, meta ≤155, single H1, ≥2 H2, FAQ,
   word count, keyword coverage, internal link, CTA). **Publish is blocked on
   error-severity failures** (a human can override). This is the quality gate
   that stops "AI slop" from being indexed — the thing Google most punishes at
   scale.
4. **Ship crawlable, rich-result-ready pages.** Bot SSR (`/ssr/blog`,
   `/ssr/jobs`) + `Article`/`JobPosting` JSON-LD + canonical URLs + sitemap
   inclusion mean Google can discover, render, and enrich every page.
5. **Close the loop.** GA4 landing-page performance shows which content actually
   converts, so the next research pass prioritises what works and flags pages to
   refresh.

## What moves the number (and what's outside code)

**Levers the code gives you:**
- Publishing **cadence + volume** (the single biggest lever for the blog) — the
  engine makes drafting one-click/auto so a human can approve many posts/week.
- **Quality floor** (the audit) so volume doesn't tank quality.
- **Programmatic breadth** (jobs board) for raw indexable surface area.
- **Technical SEO** done right (SSR, structured data, sitemaps, single H1, fast
  mobile pages).

**Outside code — own these operationally:**
- **Backlinks / digital PR** — domain authority is the ceiling on how much of the
  above ranks. No engine creates this; it's outreach + being genuinely useful.
- **Indexation budget & speed** — submit the sitemap in Search Console, keep it
  fresh (already automated), and watch coverage.
- **Topical depth over time** — Google rewards sustained, comprehensive coverage;
  12 months of consistent, pain-point-led publishing compounds.
- **Honest patience** — new/low-authority domains take months to rank; the curve
  is back-loaded. 100M/12mo is **aggressive** and depends most on domain
  authority + cadence, not on any single feature here.

## Bottom line

The engine is built to (a) find what real people are struggling with, (b) write
genuinely helpful, rule-compliant answers at cadence, and (c) make every page
discoverable and rich-result-ready — while refusing to publish content that fails
the SEO cross-check. That's the controllable half of a 100M-view run. The other
half — authority, links, and time — is the operating discipline this engine is
designed to support, not replace.
