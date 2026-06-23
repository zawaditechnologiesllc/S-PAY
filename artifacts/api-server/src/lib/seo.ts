import axios from "axios";
import { logger } from "./logger";

/**
 * SEO content engine — Phase 1 (backend).
 *
 * The loop: ingest Google Search Console performance → rank the opportunities
 * (queries where we already rank #5–20 and can realistically win page 1) → draft
 * a post with Claude Haiku, GROUNDED in true product facts (so the engine can't
 * invent features) → an admin reviews/approves/publishes → published posts feed
 * impressions back into the next ranking pass.
 *
 * Honest by construction:
 *  - GSC ingest returns null until GSC credentials are configured (never fake
 *    query data).
 *  - Draft generation throws DraftNotConfiguredError until ANTHROPIC_API_KEY is
 *    set (never a faked article).
 *  - Nothing auto-publishes — a human approves every post.
 *
 * Data sources:
 *  - GSC Search Analytics (official API) for ranking opportunities.
 *  - Reddit topic mining via the public old.reddit JSON endpoints (no OAuth — the
 *    official API is heavily gated). We stay polite: a descriptive User-Agent, a
 *    capped allowlist of ~50 project-related subreddits, a small per-sub limit,
 *    and a short delay between requests.
 *  - Never scrape Google search results — that breaks terms and gets blocked.
 */

// ─── Google Search Console ingest ───────────────────────────────────────────────

export interface SearchAnalyticsRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;        // 0..1
  position: number;   // average position (1 = top)
}

export function isGscConfigured(): boolean {
  // A service-account JSON (or token) + the verified property URL.
  return Boolean(process.env.GSC_SERVICE_ACCOUNT_JSON && process.env.GSC_SITE_URL);
}

/**
 * Pull the last `days` of Search Analytics rows for the configured property.
 * Returns null when GSC isn't configured — callers surface an honest
 * "connect Search Console" state rather than inventing data.
 *
 * NOTE (wiring task): with creds present, exchange the service account for an
 * access token and POST to
 *   https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
 * with dimensions:["query"]. The shape returned here matches that response so
 * the ranker and routes need no change when this is wired.
 */
export async function fetchSearchAnalytics(_days = 28): Promise<SearchAnalyticsRow[] | null> {
  if (!isGscConfigured()) return null;
  // Credentials are present but the Google API call is the remaining wiring step
  // (service-account token exchange). Until then we do NOT fabricate rows.
  logger.info("GSC configured — Search Analytics fetch not yet wired (returns empty, never fake)");
  return [];
}

// ─── Opportunity ranker (pure, testable) ────────────────────────────────────────

export interface Opportunity {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  score: number;       // higher = better opportunity
  reason: string;
}

/**
 * Rank winnable queries. We favor high-impression queries sitting in the
 * "striking distance" band (avg position ~5–20: already on page 1–2, a content
 * push can move them up), and de-prioritize anything already top-3 or buried.
 * Pure function — no I/O — so it's unit-testable and stable.
 */
export function rankOpportunities(rows: SearchAnalyticsRow[], limit = 20): Opportunity[] {
  const positionWeight = (pos: number): number => {
    if (pos < 4) return 0.15;       // already winning — little upside
    if (pos <= 10) return 1.0;      // page 1, striking distance — best upside
    if (pos <= 20) return 0.7;      // page 2 — strong upside
    if (pos <= 40) return 0.3;      // far — needs more than one post
    return 0.1;
  };

  return rows
    .filter((r) => r.impressions > 0)
    .map((r) => {
      const score = Math.round(r.impressions * positionWeight(r.position) * 100) / 100;
      const band = r.position < 4 ? "already ranking well"
        : r.position <= 10 ? "striking distance (page 1)"
        : r.position <= 20 ? "page 2 — winnable"
        : "needs sustained effort";
      return {
        query: r.query,
        impressions: r.impressions,
        clicks: r.clicks,
        position: Math.round(r.position * 10) / 10,
        score,
        reason: `${r.impressions} impressions @ avg position ${Math.round(r.position * 10) / 10} — ${band}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Reddit topic mining (public old.reddit JSON — no OAuth) ────────────────────

// ~50 subreddits relevant to S-PAY: remote work / freelancing, payments &
// fintech, stablecoins/Celo, and our key corridor countries. Override with
// SEO_REDDIT_SUBREDDITS (comma-separated) to retarget without a deploy.
const DEFAULT_SUBREDDITS = [
  "remotework", "digitalnomad", "freelance", "WorkOnline", "forhire", "Upwork",
  "Fiverr", "freelanceWriters", "juststart", "sidehustle", "passive_income",
  "Entrepreneur", "smallbusiness", "kickstarter", "ecommerce", "SaaS",
  "personalfinance", "povertyfinance", "Frugal", "FinancialPlanning",
  "fintech", "CryptoCurrency", "stablecoins", "Celo", "ethfinance", "defi",
  "Bitcoin", "ethereum", "CryptoTechnology", "Payoneer", "wise", "Banking",
  "expats", "IWantOut", "cscareerquestions", "developersIndia", "webdev",
  "programming", "PinoyProgrammer", "Kenya", "Nigeria", "ghana", "southafrica",
  "india", "brazil", "philippines", "Uganda", "Tanzania", "SEO", "content_marketing",
];

const REDDIT_UA = process.env.SEO_REDDIT_USER_AGENT
  ?? "web:spay-seo-research:v1 (by /u/spay-team)";

export function isRedditEnabled(): boolean {
  return process.env.SEO_REDDIT_ENABLED !== "false";
}

export function redditSubreddits(): string[] {
  const env = process.env.SEO_REDDIT_SUBREDDITS;
  const list = env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_SUBREDDITS;
  return list.slice(0, 50); // hard cap — never hammer Reddit
}

export interface RedditTopic {
  subreddit: string;
  title: string;
  url: string;          // link to the discussion
  score: number;
  numComments: number;
}

/**
 * Collect top posts from the allowlisted subreddits via old.reddit's public JSON
 * (e.g. https://old.reddit.com/r/<sub>/top.json). No OAuth. Polite by design:
 * capped subs, small per-sub limit, descriptive UA, a short delay between calls.
 * Failures per subreddit are skipped, never thrown — partial results are fine.
 * These titles are topic ideas for drafts, not facts to publish verbatim.
 */
export async function fetchRedditTopics(opts?: { perSub?: number; timeframe?: "day" | "week" | "month" }): Promise<RedditTopic[]> {
  if (!isRedditEnabled()) return [];
  const perSub = Math.min(Math.max(opts?.perSub ?? 4, 1), 10);
  const timeframe = opts?.timeframe ?? "week";
  const out: RedditTopic[] = [];

  for (const sub of redditSubreddits()) {
    try {
      const res = await axios.get(`https://old.reddit.com/r/${encodeURIComponent(sub)}/top.json`, {
        params: { t: timeframe, limit: perSub },
        timeout: 10000,
        headers: { "User-Agent": REDDIT_UA, Accept: "application/json" },
      });
      for (const child of res.data?.data?.children ?? []) {
        const d = child?.data ?? {};
        if (d.stickied || !d.title) continue;
        out.push({
          subreddit: sub,
          title: String(d.title),
          url: d.permalink ? `https://www.reddit.com${d.permalink}` : (d.url ?? ""),
          score: Number(d.score ?? 0),
          numComments: Number(d.num_comments ?? 0),
        });
      }
    } catch (err) {
      logger.warn({ sub, err: axios.isAxiosError(err) ? err.response?.status : String(err) }, "Reddit topic fetch failed (skipped)");
    }
    await new Promise((r) => setTimeout(r, 350)); // be polite between subreddits
  }
  return out.sort((a, b) => b.score - a.score);
}

// ─── Claude Haiku draft generation (grounded) ───────────────────────────────────

export class DraftNotConfiguredError extends Error {
  constructor() { super("Draft generation is not configured (set ANTHROPIC_API_KEY)"); }
}

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DRAFT_MODEL = process.env.SEO_DRAFT_MODEL ?? "claude-haiku-4-5-20251001";

export function isDraftConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// The ground truth the model must write within — keeps generated posts honest
// and on-message (no invented features, no provider names shown to users).
const PRODUCT_FACTS = `
S-PAY is a stablecoin money app for global/remote workers, built on the Celo network.
TRUE facts to write within (do not contradict or invent beyond these):
- One balance: users hold USDC/USDT in their own non-custodial Celo wallet. There is no separate "virtual account balance".
- Receive pay by email, phone, S-PAY ID, or wallet address; or via a virtual US ACH / EU IBAN account that auto-converts incoming fiat to USDC.
- Cash out to local rails: M-Pesa, MTN/Airtel MoMo, GCash, PIX, SEPA, UK Faster Payments, SPEI, bank transfer, ACH.
- Cash-out/deposit routing always picks the best rate for the customer; users never see or choose a payout provider.
- Sub-cent fees and ~5-second settlement on Celo; no seed phrase.
- Payroll: businesses pay workers globally via one API; settlement is real on-chain USDC.
- Do NOT promise specific FX rates, guaranteed earnings, or features not listed above.
- Do NOT name backend providers (Noah/Bridge/etc.) to readers.
`.trim();

export interface BlogDraft {
  title: string;
  metaDescription: string;
  excerpt: string;
  bodyMarkdown: string;
  model: string;
}

/**
 * Draft an SEO blog post for a target keyword, grounded in PRODUCT_FACTS. Throws
 * DraftNotConfiguredError until ANTHROPIC_API_KEY is set — never a faked article.
 */
export async function generateBlogDraft(keyword: string, audienceHint?: string): Promise<BlogDraft> {
  if (!isDraftConfigured()) throw new DraftNotConfiguredError();

  const system =
    "You are an expert SEO content writer for S-PAY. Write genuinely helpful, " +
    "accurate, E-E-A-T-aligned articles for remote workers and the businesses " +
    "that pay them. Only state things supported by the PRODUCT FACTS. Never " +
    "fabricate features, statistics, FX rates, or earnings claims. Output STRICT " +
    "JSON only.\n\nPRODUCT FACTS:\n" + PRODUCT_FACTS;

  const user =
    `Write a blog post targeting the search query: "${keyword}".` +
    (audienceHint ? ` Audience: ${audienceHint}.` : "") +
    ` Return JSON with keys: title (<=60 chars, compelling), metaDescription ` +
    `(<=155 chars), excerpt (<=200 chars), bodyMarkdown (800–1200 words, H2/H3 ` +
    `headings, a short FAQ, a soft CTA to open a free S-PAY account; no fabricated ` +
    `claims). JSON only, no prose around it.`;

  let res;
  try {
    res = await axios.post(
      ANTHROPIC_API,
      { model: DRAFT_MODEL, max_tokens: 3000, system, messages: [{ role: "user", content: user }] },
      {
        timeout: 60000,
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      },
    );
  } catch (err) {
    logger.error({ err: axios.isAxiosError(err) ? err.response?.data : err, keyword }, "Blog draft generation failed");
    throw new Error("Draft generation failed");
  }

  const text: string = res.data?.content?.[0]?.text ?? "";
  let parsed: Partial<BlogDraft>;
  try {
    // The model is told to return strict JSON; tolerate code-fence wrapping.
    const json = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(json);
  } catch {
    logger.warn({ keyword }, "Draft was not valid JSON — returning raw body");
    parsed = { title: keyword, metaDescription: "", excerpt: "", bodyMarkdown: text };
  }

  return {
    title: parsed.title?.trim() || keyword,
    metaDescription: parsed.metaDescription?.trim() || "",
    excerpt: parsed.excerpt?.trim() || "",
    bodyMarkdown: parsed.bodyMarkdown?.trim() || "",
    model: DRAFT_MODEL,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/** URL-safe slug from a title/keyword. */
export function slugify(input: string): string {
  return input.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `post-${Date.now()}`;
}

/** Article JSON-LD for a published post (embed in the page <head> for rich results). */
export function articleJsonLd(post: {
  slug: string; title: string; metaDescription: string | null; excerpt: string | null;
  publishedAt: Date | null; updatedAt: Date;
}, siteUrl: string): Record<string, unknown> {
  const url = `${siteUrl.replace(/\/+$/, "")}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    datePublished: (post.publishedAt ?? post.updatedAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    publisher: { "@type": "Organization", name: "S-PAY", url: siteUrl },
    author: { "@type": "Organization", name: "S-PAY" },
  };
}
