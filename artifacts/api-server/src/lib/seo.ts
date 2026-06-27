import axios from "axios";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

/**
 * SEO content engine — Phase 1 (backend).
 *
 * The loop: ingest Google Search Console performance → rank the opportunities
 * (queries where we already rank #5–20 and can realistically win page 1) → draft
 * a post with Gemini 2.5 Flash, GROUNDED in true product facts (so the engine can't
 * invent features) → an admin reviews/approves/publishes → published posts feed
 * impressions back into the next ranking pass.
 *
 * Honest by construction:
 *  - GSC/GA4 ingest returns null until credentials are configured (never fake
 *    data) and throws GoogleApiError when configured-but-unreachable, so the
 *    admin sees a real reason rather than a silent empty list.
 *  - Draft generation throws DraftNotConfiguredError until GEMINI_API_KEY is
 *    set (never a faked article).
 *  - Nothing auto-publishes — a human approves every post.
 *
 * Data sources:
 *  - GSC Search Analytics (official API, service-account JWT) for ranking
 *    opportunities; GA4 Data API for the content-performance feedback signal.
 *  - Reddit topic mining via the official OAuth API (oauth.reddit.com) when a
 *    Reddit app is configured, falling back to public JSON. We stay polite: a
 *    descriptive User-Agent, a capped allowlist of ~50 project-related
 *    subreddits, a small per-sub limit, and a short delay between requests.
 *  - Never scrape Google search results — that breaks terms and gets blocked.
 */

// ─── Google service-account auth (shared by Search Console + GA4) ───────────────
// Both APIs use the same OAuth2 service-account flow: sign a JWT with the SA
// private key, exchange it for an access token, then call the API with a Bearer
// token. Tokens last ~1h so we cache them per (account, scope-set).

export class GoogleApiError extends Error {
  constructor(message: string) { super(message); this.name = "GoogleApiError"; }
}

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }

/**
 * Parse a service-account credential from an env var. Accepts raw JSON OR a
 * base64-encoded JSON blob (platforms often mangle multi-line JSON, so operators
 * frequently base64 it). Restores escaped "\n" in the PEM private key — the #1
 * reason "the key is set but auth fails". Returns null if it can't yield usable
 * credentials, so callers honestly report "not connected".
 */
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text.startsWith("{")) {
    // Likely base64 (or base64 of JSON). Try to decode; ignore if it isn't.
    try {
      const decoded = Buffer.from(text, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) text = decoded;
    } catch { /* not base64 — fall through and let JSON.parse fail */ }
  }
  try {
    const sa = JSON.parse(text) as Partial<ServiceAccount>;
    if (!sa.client_email || !sa.private_key) return null;
    // Env stores commonly escape newlines in the PEM; restore real newlines so
    // the RS256 signer accepts the key.
    const privateKey = String(sa.private_key).replace(/\\n/g, "\n");
    return { client_email: sa.client_email, private_key: privateKey, token_uri: sa.token_uri };
  } catch {
    return null;
  }
}

const googleTokenCache = new Map<string, { token: string; exp: number }>();

async function getGoogleAccessToken(sa: ServiceAccount, scopes: string[]): Promise<string> {
  const cacheKey = `${sa.client_email}|${scopes.join(" ")}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = googleTokenCache.get(cacheKey);
  if (cached && cached.exp - 60 > now) return cached.token;

  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  let assertion: string;
  try {
    assertion = jwt.sign({ scope: scopes.join(" ") }, sa.private_key, {
      algorithm: "RS256",
      issuer: sa.client_email,
      audience: tokenUri,
      expiresIn: 3600,
    });
  } catch (err) {
    throw new GoogleApiError(`Could not sign the service-account JWT — check the private key. (${String(err)})`);
  }

  let res;
  try {
    res = await axios.post(
      tokenUri,
      new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      { timeout: 15000, headers: { "content-type": "application/x-www-form-urlencoded" } },
    );
  } catch (err) {
    const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data ?? err.code) : String(err);
    throw new GoogleApiError(`Google token exchange failed: ${detail}`);
  }
  const token = res.data?.access_token as string | undefined;
  if (!token) throw new GoogleApiError("Google token endpoint returned no access_token");
  const expiresIn = Number(res.data?.expires_in ?? 3600);
  googleTokenCache.set(cacheKey, { token, exp: now + expiresIn });
  return token;
}

// ─── Google Search Console ingest ───────────────────────────────────────────────

export interface SearchAnalyticsRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;        // 0..1
  position: number;   // average position (1 = top)
}

const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export function isGscConfigured(): boolean {
  // Usable service-account credentials (parse-checked) + the verified property URL.
  return Boolean(parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON) && process.env.GSC_SITE_URL);
}

/** Map a raw Search Analytics API response into our row shape (pure, testable). */
export function mapSearchAnalyticsRows(apiRows: unknown): SearchAnalyticsRow[] {
  const rows = Array.isArray(apiRows) ? apiRows : [];
  return rows
    .map((r): SearchAnalyticsRow => {
      const row = r as { keys?: unknown[]; impressions?: unknown; clicks?: unknown; ctr?: unknown; position?: unknown };
      return {
        query: String(row.keys?.[0] ?? "").trim(),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        ctr: Number(row.ctr ?? 0),
        position: Number(row.position ?? 0),
      };
    })
    .filter((r) => r.query.length > 0);
}

/**
 * Pull the last `days` of Search Analytics rows for the configured property.
 * Returns null when GSC isn't configured (honest "connect Search Console"),
 * throws GoogleApiError when configured but the API call fails (so callers can
 * show a real error instead of a silent empty list), and never fabricates rows.
 */
export async function fetchSearchAnalytics(days = 28): Promise<SearchAnalyticsRow[] | null> {
  const sa = parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON);
  const siteUrl = process.env.GSC_SITE_URL;
  if (!sa || !siteUrl) return null;

  const token = await getGoogleAccessToken(sa, GSC_SCOPES);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let res;
  try {
    res = await axios.post(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      { startDate: fmt(start), endDate: fmt(end), dimensions: ["query"], rowLimit: 1000, dataState: "all" },
      { timeout: 30000, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } },
    );
  } catch (err) {
    const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data ?? err.code) : String(err);
    logger.error({ siteUrl, detail }, "GSC Search Analytics query failed");
    throw new GoogleApiError(`Search Console query failed: ${detail}`);
  }
  return mapSearchAnalyticsRows(res.data?.rows);
}

/**
 * Live connectivity check for the admin status panel: distinguishes "creds not
 * set" from "creds set but invalid/property not verified" from "connected".
 * Cheap — token acquisition is cached.
 */
export async function checkGscConnection(): Promise<{ configured: boolean; ok: boolean; reason?: string }> {
  const sa = parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON);
  const siteUrl = process.env.GSC_SITE_URL;
  if (!sa || !siteUrl) {
    return { configured: false, ok: false, reason: !siteUrl ? "GSC_SITE_URL is not set" : "GSC_SERVICE_ACCOUNT_JSON is missing or invalid" };
  }
  try {
    await getGoogleAccessToken(sa, GSC_SCOPES);
    return { configured: true, ok: true };
  } catch (err) {
    return { configured: true, ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Google Analytics (GA4) — the feedback signal ───────────────────────────────
// GA4 tells us which CONTENT actually performs (sessions, engagement, conversions
// per landing page), so the loop can prioritize topics that convert and flag
// pages to refresh. Same honest contract as GSC: null until configured, never
// fabricated. The GA4 service account can reuse the GSC one.

export interface Ga4LandingPage {
  page: string;            // landing page path
  sessions: number;
  engagementRate: number;  // 0..1
  conversions: number;
}

const GA4_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

function ga4ServiceAccount(): ServiceAccount | null {
  // GA4 can reuse the GSC service account if a dedicated one isn't provided.
  return parseServiceAccount(process.env.GA4_SERVICE_ACCOUNT_JSON) ?? parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON);
}

export function isGa4Configured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID && ga4ServiceAccount());
}

/** Map a raw GA4 runReport response into our landing-page shape (pure, testable). */
export function mapGa4Rows(apiRows: unknown): Ga4LandingPage[] {
  const rows = Array.isArray(apiRows) ? apiRows : [];
  return rows
    .map((r): Ga4LandingPage => {
      const row = r as { dimensionValues?: Array<{ value?: unknown }>; metricValues?: Array<{ value?: unknown }> };
      return {
        page: String(row.dimensionValues?.[0]?.value ?? "").trim(),
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
        engagementRate: Number(row.metricValues?.[1]?.value ?? 0),
        conversions: Number(row.metricValues?.[2]?.value ?? 0),
      };
    })
    .filter((r) => r.page.length > 0);
}

/**
 * Pull the last `days` of top landing pages from the GA4 Data API. Returns null
 * when GA4 isn't configured (honest "connect Analytics"), throws GoogleApiError
 * when configured but the call fails, and never fabricates data.
 */
export async function fetchGa4LandingPages(days = 28): Promise<Ga4LandingPage[] | null> {
  const sa = ga4ServiceAccount();
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!sa || !propertyId) return null;

  const token = await getGoogleAccessToken(sa, GA4_SCOPES);
  const id = propertyId.replace(/^properties\//, "");
  let res;
  try {
    res = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(id)}:runReport`,
      {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 100,
      },
      { timeout: 30000, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } },
    );
  } catch (err) {
    const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data ?? err.code) : String(err);
    logger.error({ propertyId: id, detail }, "GA4 runReport failed");
    throw new GoogleApiError(`Analytics query failed: ${detail}`);
  }
  return mapGa4Rows(res.data?.rows);
}

/** Live GA4 connectivity check for the admin status panel. */
export async function checkGa4Connection(): Promise<{ configured: boolean; ok: boolean; reason?: string }> {
  const sa = ga4ServiceAccount();
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!sa || !propertyId) {
    return { configured: false, ok: false, reason: !propertyId ? "GA4_PROPERTY_ID is not set" : "No GA4/GSC service account is configured" };
  }
  try {
    await getGoogleAccessToken(sa, GA4_SCOPES);
    return { configured: true, ok: true };
  } catch (err) {
    return { configured: true, ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
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

// ─── Reddit topic mining (proxied public JSON, or official OAuth) ───────────────

// ~100 subreddits across S-PAY's niche: remote work / freelancing / the gig
// economy, online income & business, personal finance, payments & fintech,
// stablecoins/crypto, the dev communities that earn remotely, our key corridor
// countries, expats/migration, and marketing/SEO. Override the whole set with
// SEO_REDDIT_SUBREDDITS (comma-separated) to retarget without a deploy.
const DEFAULT_SUBREDDITS = [
  // Remote work / freelancing / gig economy
  "remotework", "digitalnomad", "digitalnomadjobs", "freelance", "freelanceWriters",
  "WorkOnline", "forhire", "slavelabour", "Upwork", "Fiverr", "WorkFromHome",
  "overemployed", "beermoney", "beermoneyglobal", "juststart", "sidehustle",
  "SideHustleIdeas", "gigwork",
  // Online income & business
  "passive_income", "Entrepreneur", "EntrepreneurRideAlong", "smallbusiness",
  "kickstarter", "ecommerce", "dropship", "FulfillmentByAmazon", "AmazonSeller",
  "SaaS", "indiehackers", "startups", "growmybusiness", "Affiliatemarketing",
  "Blogging", "Etsy", "printondemand",
  // Personal finance
  "personalfinance", "povertyfinance", "Frugal", "FinancialPlanning",
  "financialindependence", "MiddleClassFinance", "eupersonalfinance",
  "UKPersonalFinance", "churning",
  // Payments / fintech / crypto / stablecoins
  "fintech", "CryptoCurrency", "stablecoins", "Celo", "ethfinance", "defi",
  "Bitcoin", "ethereum", "CryptoTechnology", "BitcoinBeginners", "CryptoMarkets",
  "Stellar", "solana", "0xPolygon", "XRP", "Payoneer", "wise", "Banking",
  "paypal", "Revolut", "CashApp", "Remitly",
  // Dev / skills that earn remotely
  "cscareerquestions", "developersIndia", "webdev", "programming",
  "PinoyProgrammer", "learnprogramming", "ExperiencedDevs", "web_design",
  "graphic_design", "TranslationStudies",
  // Corridor countries / regions
  "Kenya", "Nigeria", "ghana", "southafrica", "india", "brazil", "philippines",
  "Uganda", "Tanzania", "Zambia", "Zimbabwe", "Rwanda", "ethiopia", "Egypt",
  "Pakistan", "bangladesh", "indonesia", "vietnam", "mexico", "Colombia",
  "argentina", "peru", "LatinAmerica", "Africa",
  // Expats / migration
  "expats", "IWantOut", "AmerExit",
  // Marketing / SEO (audience + our own content craft)
  "SEO", "bigseo", "content_marketing", "marketing", "DigitalMarketing",
];

const REDDIT_SUB_CAP = 100;

// Reddit's OAuth API wants a unique, descriptive User-Agent; the public JSON
// endpoints behave best with a normal browser UA. SEO_REDDIT_USER_AGENT
// overrides both.
const REDDIT_UA_OVERRIDE = process.env.SEO_REDDIT_USER_AGENT;
const REDDIT_OAUTH_UA = REDDIT_UA_OVERRIDE ?? "web:spay-seo-research:v1 (by /u/spay-team)";
const REDDIT_PUBLIC_UA = REDDIT_UA_OVERRIDE
  ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function isRedditEnabled(): boolean {
  return process.env.SEO_REDDIT_ENABLED !== "false";
}

// ── Proxy support (the no-app-approval path) ────────────────────────────────────
// Reddit 403s requests from datacenter IPs, so the public JSON returns nothing
// from a normal server. Routing those requests through a residential/rotating
// HTTP(S) proxy makes them look like ordinary traffic and they succeed — no
// Reddit app or API approval needed (which can take months). Set
// SEO_REDDIT_PROXY_URL to one or more (comma-separated) proxy URLs, e.g.
//   http://user:pass@gateway.provider.com:7777
// Multiple proxies are rotated per request. Many residential gateways already
// rotate the exit IP on every connection, so a single URL is usually enough.

export interface ProxyConfig { host: string; port: number; protocol: string; auth?: { username: string; password: string } }

/** Parse a proxy URL ("http://user:pass@host:port" or "host:port") into axios's
 *  proxy shape. Returns null if it can't yield a usable host. Pure/testable. */
export function parseProxyConfig(raw: string | undefined | null): ProxyConfig | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `http://${s}`; // allow bare host:port
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!u.hostname) return null;
  const protocol = (u.protocol || "http:").replace(/:$/, "");
  const port = u.port ? Number(u.port) : (protocol === "https" ? 443 : 80);
  if (!Number.isFinite(port)) return null;
  const cfg: ProxyConfig = { host: u.hostname, port, protocol };
  if (u.username || u.password) {
    cfg.auth = { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
  }
  return cfg;
}

export function redditProxies(): ProxyConfig[] {
  const raw = process.env.SEO_REDDIT_PROXY_URL;
  if (!raw) return [];
  return raw.split(",").map((s) => parseProxyConfig(s)).filter((p): p is ProxyConfig => p !== null);
}

export function isRedditProxyConfigured(): boolean {
  return redditProxies().length > 0;
}

/** A proxy for this request (random across the configured pool), or undefined. */
function pickProxy(): ProxyConfig | undefined {
  const pool = redditProxies();
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
}

/**
 * When a Reddit app's client id + secret are set we use the official OAuth
 * "application-only" (client_credentials) flow against oauth.reddit.com. Create
 * an app at https://www.reddit.com/prefs/apps (type "script"/"web app") — that
 * is instant; only Reddit's *commercial Data API* program needs approval, which
 * the proxy path above avoids entirely.
 */
export function isRedditOAuthConfigured(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

let redditTokenCache: { token: string; exp: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  if (!isRedditOAuthConfigured()) return null;
  const now = Math.floor(Date.now() / 1000);
  if (redditTokenCache && redditTokenCache.exp - 60 > now) return redditTokenCache.token;
  const proxy = pickProxy();
  try {
    const res = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      {
        timeout: 15000,
        auth: { username: process.env.REDDIT_CLIENT_ID as string, password: process.env.REDDIT_CLIENT_SECRET as string },
        headers: { "User-Agent": REDDIT_OAUTH_UA, "content-type": "application/x-www-form-urlencoded" },
        ...(proxy ? { proxy } : {}),
      },
    );
    const token = res.data?.access_token as string | undefined;
    if (!token) return null;
    redditTokenCache = { token, exp: now + Number(res.data?.expires_in ?? 3600) };
    return token;
  } catch (err) {
    logger.warn({ err: axios.isAxiosError(err) ? err.response?.status : String(err) }, "Reddit OAuth token request failed");
    return null;
  }
}

export function redditSubreddits(): string[] {
  const env = process.env.SEO_REDDIT_SUBREDDITS;
  const list = env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_SUBREDDITS;
  // De-dupe (case-insensitive) and cap so we never hammer Reddit.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const k = s.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out.slice(0, REDDIT_SUB_CAP);
}

// Bounded-concurrency map — keeps 100 subreddits fast without flooding Reddit.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

// ── Pain-point detection ────────────────────────────────────────────────────────
// The most valuable blog targets are *complaints* and *unanswered questions* —
// a real person stating a problem we can solve. We classify each Reddit post's
// intent so research can prioritise pain points (a complaint about high transfer
// fees is a better blog brief than a generic discussion thread).

export type RedditIntent = "complaint" | "question" | "comparison" | "discussion";

const COMPLAINT_RE = /\b(fees?|expensive|overcharg|charg(ed|es|ing)|scam|fraud|stuck|frozen|froze|blocked|locked|ban(ned)?|reject(ed|ing)?|declin(e|ed|ing)|on\s+hold|withheld|delay(ed|s|ing)?|too\s+slow|so\s+slow|late|lost|missing|disappear|hate|worst|terrible|awful|nightmare|rip[\s-]?off|can'?t|cannot|won'?t|wont|problem|issue|trouble|struggl|unable|fail(ed|s|ing)?|not\s+working|stopped\s+working|avoid)\b/i;
const COMPARISON_RE = /\b(vs\.?|versus|alternatives?\s+to|better\s+than|compared?\s+to|which\s+is\s+better)\b/i;
const QUESTION_RE = /\?|^\s*(how|why|what|where|when|which|who|can|could|should|is|are|do|does|did|will|would|any(one|body)?|has\s+anyone|best\s+way)\b/i;

/** Classify the searcher/poster intent of a piece of text (pure, testable). */
export function classifyIntent(text: string): { intent: RedditIntent; painScore: number } {
  const t = (text ?? "").trim();
  if (COMPLAINT_RE.test(t)) return { intent: "complaint", painScore: 1 };       // strongest pain
  if (COMPARISON_RE.test(t)) return { intent: "comparison", painScore: 0.7 };    // "X vs Y / alternative to X"
  if (QUESTION_RE.test(t)) return { intent: "question", painScore: 0.6 };        // unanswered need
  return { intent: "discussion", painScore: 0.25 };
}

export interface RedditTopic {
  subreddit: string;
  title: string;
  url: string;          // link to the discussion
  score: number;
  numComments: number;
  intent: RedditIntent;
  painScore: number;    // 0..1 — how strongly this reads as a real pain point
  snippet?: string;     // first line of the post body, when present (extra context)
}

/** Extract our topic shape from a Reddit listing payload (pure, testable). */
export function parseRedditListing(sub: string, data: unknown): RedditTopic[] {
  const children = (data as { data?: { children?: unknown[] } })?.data?.children ?? [];
  const out: RedditTopic[] = [];
  for (const child of children) {
    const d = (child as { data?: Record<string, unknown> })?.data ?? {};
    if (d.stickied || !d.title) continue;
    const title = String(d.title);
    const selftext = typeof d.selftext === "string" ? d.selftext.replace(/\s+/g, " ").trim() : "";
    const { intent, painScore } = classifyIntent(`${title} ${selftext.slice(0, 300)}`);
    out.push({
      subreddit: sub,
      title,
      url: d.permalink ? `https://www.reddit.com${String(d.permalink)}` : String(d.url ?? ""),
      score: Number(d.score ?? 0),
      numComments: Number(d.num_comments ?? 0),
      intent,
      painScore,
      snippet: selftext ? selftext.slice(0, 200) : undefined,
    });
  }
  return out;
}

// Short-TTL cache so loading the admin panel (and combinedResearch) repeatedly
// doesn't re-crawl ~100 subreddits every time. Keyed by timeframe+perSub.
const redditCache = new Map<string, { data: RedditTopic[]; exp: number }>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Collect top posts from the ~100 allowlisted subreddits. Order of preference:
 *  1. official oauth.reddit.com when a Reddit app is configured — the reliable
 *     path that works from a datacenter server and DOES NOT change location;
 *  2. otherwise the public JSON straight from old.reddit.com (then www.reddit.com),
 *     no proxy required — this works whenever the server's own IP isn't blocked.
 * A configured proxy (SEO_REDDIT_PROXY_URL) is used only if present; it is fully
 * optional and never required. Bounded concurrency keeps 100 subs fast (and a
 * gentler default when unauthenticated to avoid Reddit's tight rate limits); a
 * 429 is retried once after Retry-After; results are cached briefly. A 403/HTML
 * block page (which can arrive as a 200 with non-JSON) is guarded. Per-subreddit
 * failures are skipped, never thrown. Titles are topic ideas, not facts.
 */
export async function fetchRedditTopics(opts?: { perSub?: number; timeframe?: "day" | "week" | "month"; force?: boolean }): Promise<RedditTopic[]> {
  if (!isRedditEnabled()) return [];
  const perSub = Math.min(Math.max(opts?.perSub ?? 4, 1), 10);
  const timeframe = opts?.timeframe ?? "week";

  const cacheKey = `${timeframe}:${perSub}`;
  const ttlMs = Math.max(0, Number(process.env.SEO_REDDIT_CACHE_TTL_SEC ?? 900)) * 1000;
  const nowMs = Date.now();
  if (!opts?.force && ttlMs > 0) {
    const cached = redditCache.get(cacheKey);
    if (cached && cached.exp > nowMs && cached.data.length > 0) return cached.data;
  }

  const token = await getRedditToken();
  // Old Reddit first on the public path (the user's preferred source); the JSON
  // shape is identical on every host.
  const hosts = token ? ["https://oauth.reddit.com"] : ["https://old.reddit.com", "https://www.reddit.com"];
  const ua = token ? REDDIT_OAUTH_UA : REDDIT_PUBLIC_UA;
  const authHeader = token ? { authorization: `Bearer ${token}` } : {};
  const subs = redditSubreddits();
  // Authenticated/proxied requests can run wide; unauthenticated public requests
  // go gently so we don't trip Reddit's per-IP rate limit.
  const defaultConcurrency = token || isRedditProxyConfigured() ? 5 : 2;
  const concurrency = Math.min(Math.max(Number(process.env.SEO_REDDIT_CONCURRENCY ?? defaultConcurrency), 1), 12);

  let failures = 0;
  const fetchSub = async (sub: string): Promise<RedditTopic[]> => {
    for (const host of hosts) {
      const proxy = pickProxy(); // rotate IF a proxy is configured (optional)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await axios.get(`${host}/r/${encodeURIComponent(sub)}/top.json`, {
            params: { t: timeframe, limit: perSub, raw_json: 1 },
            timeout: 12000,
            headers: { "User-Agent": ua, Accept: "application/json", ...authHeader },
            ...(proxy ? { proxy } : {}),
          });
          if (res.data && typeof res.data === "object") return parseRedditListing(sub, res.data);
          break; // 200 but non-JSON (block page) — try the next host
        } catch (err) {
          const status = axios.isAxiosError(err) ? err.response?.status : undefined;
          if (status === 429 && attempt === 0) {
            const retryAfter = Number(axios.isAxiosError(err) ? err.response?.headers?.["retry-after"] : 0) || 2;
            await sleep(Math.min(retryAfter, 5) * 1000); // respect Retry-After, then retry once
            continue;
          }
          if (status && status !== 403 && status !== 429) {
            logger.warn({ sub, host, status }, "Reddit topic fetch failed");
          }
          break; // 403/other — try the next host
        }
      }
    }
    failures++;
    return [];
  };

  const out = (await mapPool(subs, concurrency, fetchSub)).flat().sort((a, b) => b.score - a.score);

  if (failures > 0 && out.length === 0) {
    logger.warn(
      { failures, oauth: isRedditOAuthConfigured(), proxy: isRedditProxyConfigured() },
      isRedditOAuthConfigured()
        ? "Reddit returned no topics even with OAuth — check the app credentials/type at reddit.com/prefs/apps"
        : "Reddit returned no topics — this server's IP is being blocked by Reddit. Add a Reddit app (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET) for the official API, which works from a datacenter without changing location.",
    );
  }
  if (ttlMs > 0 && out.length > 0) redditCache.set(cacheKey, { data: out, exp: nowMs + ttlMs });
  return out;
}

// ─── Combined research: Google + Reddit working together ────────────────────────
// The "correct blogs to push" are topics validated by BOTH signals — real Google
// search demand (GSC) AND active community interest (Reddit). We normalize the
// two score scales, merge them, and BOOST overlaps so "both"-sourced candidates
// rise to the top. Until GSC is wired the list is Reddit-led; it sharpens as GSC
// data arrives. Honest: empty when there's nothing to research.

export interface BlogCandidate {
  keyword: string;
  source: "gsc" | "reddit" | "both";
  score: number;        // 0..1, comparable across sources
  reason: string;
  subreddit?: string;
  intent?: RedditIntent;   // what kind of need this is (complaint/question/…)
  painPoint?: string;      // the verbatim problem the blog should solve + answer
}

const STOP = new Set(["the", "and", "for", "with", "your", "how", "what", "are", "can", "from", "you", "that", "this", "best", "online", "money"]);
function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 4 && !STOP.has(w)));
}
/** Do a Reddit title and a GSC query cover the same topic? (shared significant words) */
function overlaps(a: string, b: string): boolean {
  const ta = tokens(a), tb = tokens(b);
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared >= 2 || (shared >= 1 && (ta.size <= 2 || tb.size <= 2));
}

/**
 * Merge Google Search Console opportunities and Reddit topics into one ranked
 * list of blog candidates. Overlapping topics become `source: "both"` with a
 * strong score boost — those are the highest-confidence blogs to write.
 */
export async function combinedResearch(limit = 20): Promise<{ candidates: BlogCandidate[]; gscConfigured: boolean; redditEnabled: boolean }> {
  // A GSC API failure must not sink the whole research call — fall back to
  // Reddit-led results and still report GSC as configured.
  let gsc: Opportunity[] = [];
  try {
    const gscRows = await fetchSearchAnalytics();
    gsc = gscRows ? rankOpportunities(gscRows, 50) : [];
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "combinedResearch: GSC fetch failed, continuing with Reddit only");
  }
  const reddit = await fetchRedditTopics({ perSub: 4 });

  const gMax = Math.max(...gsc.map((o) => o.score), 1);
  const rMax = Math.max(...reddit.map((t) => t.score), 1);

  const byKey = new Map<string, BlogCandidate>();
  const keyOf = (s: string) => s.toLowerCase().trim();

  for (const o of gsc) {
    byKey.set(keyOf(o.query), { keyword: o.query, source: "gsc", score: o.score / gMax, reason: `Google search: ${o.reason}` });
  }

  for (const t of reddit) {
    // If this Reddit topic matches an existing GSC query, fuse them and boost —
    // a complaint that also has real search demand is the highest-value blog.
    const match = gsc.find((o) => overlaps(t.title, o.query));
    if (match) {
      const existing = byKey.get(keyOf(match.query));
      if (existing) {
        existing.source = "both";
        existing.score = Math.min(1, existing.score + 0.4 + (t.score / rMax) * 0.1 + t.painScore * 0.1);
        existing.reason = `Google demand + Reddit ${t.intent} (r/${t.subreddit})`;
        existing.subreddit = t.subreddit;
        existing.intent = t.intent;
        existing.painPoint = t.snippet ? `${t.title} — ${t.snippet}` : t.title;
        continue;
      }
    }
    // Reddit-only: blend community upvotes with the pain signal so complaints and
    // unanswered questions rank above generic discussion even with modest upvotes.
    const score = Math.min(1, (t.score / rMax) * 0.45 + t.painScore * 0.45);
    byKey.set(keyOf(t.title), {
      keyword: t.title, source: "reddit",
      score,
      reason: `Reddit ${t.intent}: r/${t.subreddit} · ${t.score} pts`,
      subreddit: t.subreddit,
      intent: t.intent,
      painPoint: t.snippet ? `${t.title} — ${t.snippet}` : t.title,
    });
  }

  const candidates = [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  return { candidates, gscConfigured: isGscConfigured(), redditEnabled: isRedditEnabled() };
}

// ─── Gemini draft generation (grounded) ─────────────────────────────────────────

export class DraftNotConfiguredError extends Error {
  constructor() { super("Draft generation is not configured (set GEMINI_API_KEY)"); }
}

// Google Gemini (AI Studio / Generative Language API). Gemini 2.5 Flash has a
// generous free tier, which is why it's the default drafting model.
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
const DRAFT_MODEL = process.env.SEO_DRAFT_MODEL ?? "gemini-2.5-flash";

export function isDraftConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
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

// Google's 2026 search guidance, distilled into hard rules every generated post
// must follow. Centered on the "people-first / helpful content" system and
// E-E-A-T (Experience, Expertise, Authoritativeness, Trust). Updated as Google's
// guidance evolves — this is the single place to tune editorial quality.
const SEO_RULES_2026 = `
GOOGLE 2026 SEO RULES (follow ALL):
1. People-first, helpful content: answer the searcher's actual intent fully and satisfyingly; someone should leave feeling their question was resolved. Write for humans, not crawlers.
2. E-E-A-T: demonstrate first-hand Experience and Expertise; be Authoritative and Trustworthy. Be accurate, cite concrete specifics, and never overstate. No "AI slop" — no generic, padded, or repetitive filler.
3. Original value: add insight, examples, and practical steps a reader can't get from a thin rehash. No keyword stuffing, no auto-spun text, no content written mainly to rank.
4. Search intent & structure: one clear H1 (the title). Logical H2/H3 sections. Front-load the answer (inverted pyramid). Short paragraphs (2–4 sentences), bullet lists, and a step-by-step where useful.
5. Title: <=60 chars, specific and compelling, includes the primary keyword naturally (no clickbait, no ALL CAPS).
6. Meta description: <=155 chars, accurately summarizes the page and earns the click.
7. Natural language & entities: use the keyword and related terms/synonyms naturally; cover the topic's sub-questions (semantic completeness) rather than repeating the exact phrase.
8. Helpful extras: include a concise FAQ (2–4 real questions people ask) — these map to FAQ rich results — and, where relevant, a short key-takeaways list near the top.
9. Trust & accuracy (YMYL — this is finance): be precise and conservative. Never invent statistics, FX rates, fees, timelines, or guarantees. Note that availability/limits vary by country. Encourage readers to verify specifics in-app.
10. Freshness & clarity: write in clear, plain English at roughly an 8th-grade reading level; define jargon on first use; prefer the present tense and active voice.
11. Internal linking & CTA: include a single soft, honest call-to-action to open a free S-PAY account; suggest 1–2 relevant internal link anchors in Markdown (e.g. to the jobs board or how-it-works) using descriptive anchor text.
12. Accessibility & mobile-first: descriptive subheadings, meaningful link text (never "click here"), and image alt text if images are referenced. Assume most readers are on a phone on a slow connection.
13. No manipulation: no cloaking, doorway pages, hidden text, fake authorship, or scaled content abuse. Disclose nothing false. Everything must be verifiable and within the PRODUCT FACTS.
`.trim();

// Map a research signal (the subreddit it came from, or terms in the keyword) to
// a target audience, so the admin never has to pick one — the research does.
const SUBREDDIT_AUDIENCE: Record<string, string> = {
  remotework: "remote workers", digitalnomad: "digital nomads", freelance: "freelancers",
  freelancewriters: "freelance writers", workonline: "people earning online", forhire: "freelancers for hire",
  upwork: "Upwork freelancers", fiverr: "Fiverr sellers", juststart: "new online entrepreneurs",
  sidehustle: "people running a side hustle", passive_income: "people building passive income",
  entrepreneur: "entrepreneurs", smallbusiness: "small-business owners", ecommerce: "ecommerce sellers",
  saas: "SaaS founders", personalfinance: "people managing personal finances", povertyfinance: "people on a tight budget",
  fintech: "fintech-savvy readers", cryptocurrency: "crypto users", stablecoins: "stablecoin users",
  celo: "Celo users", payoneer: "Payoneer users weighing alternatives", wise: "Wise users weighing alternatives",
  expats: "expats", iwantout: "people planning to move abroad", cscareerquestions: "software engineers",
  developersindia: "developers in India", pinoyprogrammer: "developers in the Philippines",
  kenya: "remote workers in Kenya", nigeria: "remote workers in Nigeria", ghana: "remote workers in Ghana",
  southafrica: "remote workers in South Africa", india: "remote workers in India", brazil: "remote workers in Brazil",
  philippines: "remote workers in the Philippines", uganda: "remote workers in Uganda", tanzania: "remote workers in Tanzania",
};
const COUNTRY_TERMS: Array<{ term: string; label: string }> = [
  { term: "kenya", label: "Kenya" }, { term: "nigeria", label: "Nigeria" }, { term: "ghana", label: "Ghana" },
  { term: "south africa", label: "South Africa" }, { term: "uganda", label: "Uganda" }, { term: "tanzania", label: "Tanzania" },
  { term: "india", label: "India" }, { term: "philippines", label: "the Philippines" }, { term: "brazil", label: "Brazil" },
  { term: "mexico", label: "Mexico" }, { term: "indonesia", label: "Indonesia" },
];
const ROLE_TERMS: Array<{ term: string; label: string }> = [
  { term: "freelanc", label: "freelancers" }, { term: "remote work", label: "remote workers" },
  { term: "developer", label: "developers" }, { term: "tutor", label: "online tutors" },
  { term: "payroll", label: "businesses paying remote teams" }, { term: "marketplace", label: "marketplaces paying workers" },
];

/** Derive the target audience from research context (subreddit, then keyword terms). */
export function deriveAudience(opts: { keyword: string; source?: string; subreddit?: string }): string {
  if (opts.subreddit) {
    const a = SUBREDDIT_AUDIENCE[opts.subreddit.toLowerCase()];
    if (a) return a;
    return `the r/${opts.subreddit} community`;
  }
  const k = (opts.keyword ?? "").toLowerCase();
  const country = COUNTRY_TERMS.find((c) => k.includes(c.term));
  const role = ROLE_TERMS.find((r) => k.includes(r.term));
  if (country && role) return `${role.label} in ${country.label}`;
  if (country) return `remote workers in ${country.label}`;
  if (role) return role.label;
  return "remote workers and the businesses that pay them"; // S-PAY's core audience
}

/**
 * The blog body renders beneath the post title, which the page already outputs
 * as the single <h1>. So the body must NOT contain its own H1 (that would be a
 * duplicate H1 — a real SEO defect). Demote any H1 lines to H2. Pure/testable.
 */
export function normalizeArticleBody(md: string): string {
  return (md ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^#\s+/, "## ")) // a lone leading '#' (H1) → '##' (H2)
    .join("\n")
    .trim();
}

export interface DraftBrief {
  audience?: string;
  /** The verbatim complaint/question this post must address and resolve. */
  painPoint?: string;
  /** The kind of need, so the post leads with the right angle. */
  intent?: RedditIntent;
}

/**
 * Draft an SEO blog post for a target keyword, grounded in PRODUCT_FACTS and the
 * Google 2026 SEO rules, using Gemini. When a pain point is supplied (e.g. a real
 * Reddit complaint), the post is written to NAME that problem and walk the reader
 * to a solution — honestly positioning the relevant S-PAY capability. Throws
 * DraftNotConfiguredError until GEMINI_API_KEY is set — never a faked article.
 */
export async function generateBlogDraft(keyword: string, brief: DraftBrief = {}): Promise<BlogDraft> {
  if (!isDraftConfigured()) throw new DraftNotConfiguredError();

  const system =
    "You are an expert SEO content writer for S-PAY, a stablecoin money app for " +
    "global/remote workers. Write genuinely helpful, accurate, people-first " +
    "articles that satisfy search intent and align with Google's 2026 guidance " +
    "and E-E-A-T. Only state things supported by the PRODUCT FACTS — never " +
    "fabricate features, statistics, FX rates, fees, or earnings claims. Follow " +
    "every one of the GOOGLE 2026 SEO RULES. Output STRICT JSON only.\n\n" +
    SEO_RULES_2026 + "\n\nPRODUCT FACTS:\n" + PRODUCT_FACTS;

  const painBlock = brief.painPoint
    ? ` This topic comes from a real ${brief.intent ?? "discussion"} from the audience: ` +
      `"${brief.painPoint.slice(0, 300)}". Open by clearly naming this exact problem in the ` +
      `reader's words, validate it, then walk through practical solutions step by step. ` +
      `Where S-PAY genuinely solves part of it (per the PRODUCT FACTS), explain how — ` +
      `honestly, without overstating, and noting that availability/limits vary by country.`
    : "";

  const user =
    `Write a blog post targeting the search query: "${keyword}".` +
    (brief.audience ? ` Audience: ${brief.audience}.` : "") +
    painBlock +
    ` Apply every GOOGLE 2026 SEO RULE. Return JSON with keys: title (<=60 chars), ` +
    `metaDescription (<=155 chars), excerpt (<=200 chars), bodyMarkdown ` +
    `(900–1400 words: do NOT include a top-level '# ' H1 — the page adds the title as the ` +
    `H1; start sections at '## '. Include a short key-takeaways list near the top, logical ` +
    `H2/H3 sections, a 2–4 question FAQ under a '## FAQ' heading, 1–2 descriptive ` +
    `internal-link anchors to relative paths like /jobs or /how-it-works, and a single soft ` +
    `CTA to open a free S-PAY account; no fabricated claims, YMYL-accurate). ` +
    `JSON only, no prose around it.`;

  // Gemini generateContent. responseMimeType: application/json makes Gemini
  // return clean JSON (no code fences), so parsing is reliable.
  let res;
  try {
    res = await axios.post(
      `${GEMINI_API}/models/${DRAFT_MODEL}:generateContent`,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          // Disable 2.5-Flash "thinking" so the whole token budget goes to the
          // article (thinking can otherwise eat the budget and truncate output).
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      {
        timeout: 60000,
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY as string,
          "content-type": "application/json",
        },
      },
    );
  } catch (err) {
    logger.error({ err: axios.isAxiosError(err) ? err.response?.data : err, keyword }, "Blog draft generation failed");
    throw new Error("Draft generation failed");
  }

  // Gemini returns the text in candidates[0].content.parts[].text.
  const parts: Array<{ text?: string }> = res.data?.candidates?.[0]?.content?.parts ?? [];
  const text: string = parts.map((p) => p.text ?? "").join("").trim();
  let parsed: Partial<BlogDraft>;
  try {
    // Already JSON via responseMimeType; tolerate any stray code-fence wrapping.
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(json);
  } catch {
    logger.warn({ keyword }, "Draft was not valid JSON — returning raw body");
    parsed = { title: keyword, metaDescription: "", excerpt: "", bodyMarkdown: text };
  }

  return {
    title: parsed.title?.trim() || keyword,
    metaDescription: parsed.metaDescription?.trim() || "",
    excerpt: parsed.excerpt?.trim() || "",
    bodyMarkdown: normalizeArticleBody(parsed.bodyMarkdown ?? ""),
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

// ─── SEO cross-check (the editorial gate) ────────────────────────────────────────
// Every blog is scored against the Google 2026 rules BEFORE it can publish, so the
// engine can't quietly ship thin or non-compliant content at scale. Pure and
// testable; the publish route blocks on error-severity failures (human-overridable).

export interface SeoCheck { id: string; label: string; ok: boolean; severity: "error" | "warn"; detail?: string }
export interface SeoAudit { score: number; pass: boolean; errors: number; warnings: number; checks: SeoCheck[] }

export function auditDraft(input: {
  title?: string | null; metaDescription?: string | null; excerpt?: string | null;
  bodyMarkdown?: string | null; keyword?: string | null;
}): SeoAudit {
  const title = (input.title ?? "").trim();
  const meta = (input.metaDescription ?? "").trim();
  const excerpt = (input.excerpt ?? "").trim();
  const body = input.bodyMarkdown ?? "";
  const keyword = (input.keyword ?? "").trim().toLowerCase();
  const lowerBody = body.toLowerCase();

  const words = (body.replace(/[#>*_`~\-|]/g, " ").match(/[A-Za-z0-9']+/g) ?? []).length;
  const h1Count = (body.match(/^#\s+/gm) ?? []).length;
  const h2Count = (body.match(/^##\s+/gm) ?? []).length;
  const hasInternalLink = /\]\(\/[^)\s]/.test(body);                       // [text](/relative)
  const hasFaq = /^#{2,3}\s*(faq|frequently asked)/im.test(body) || (body.match(/\?\s*$/gm)?.length ?? 0) >= 2;
  const hasCta = /\bs-?pay\b/i.test(body) && /(open|create|sign[\s-]?up|get started|free account|register|join)/i.test(lowerBody);
  const keywordHit = !keyword || title.toLowerCase().includes(keyword) || lowerBody.includes(keyword)
    // For long Reddit-derived "keywords", count it a hit if most significant words appear.
    || (() => { const ks = [...tokens(keyword)]; return ks.length > 0 && ks.filter((w) => lowerBody.includes(w)).length / ks.length >= 0.6; })();

  const checks: SeoCheck[] = [
    { id: "title_present", label: "Has a title", ok: title.length > 0, severity: "error" },
    { id: "title_len", label: "Title ≤ 60 chars", ok: title.length > 0 && title.length <= 60, severity: "error", detail: `${title.length} chars` },
    { id: "meta_present", label: "Has a meta description", ok: meta.length > 0, severity: "error" },
    { id: "meta_len", label: "Meta ≤ 155 chars", ok: meta.length > 0 && meta.length <= 155, severity: "warn", detail: `${meta.length} chars` },
    { id: "excerpt_present", label: "Has an excerpt", ok: excerpt.length > 0, severity: "warn" },
    { id: "single_h1", label: "No duplicate H1 in body", ok: h1Count === 0, severity: "error", detail: h1Count ? `${h1Count} H1 line(s) in body` : undefined },
    { id: "has_h2", label: "≥ 2 H2 sections", ok: h2Count >= 2, severity: "error", detail: `${h2Count} H2` },
    { id: "word_count", label: "700–1600 words", ok: words >= 700 && words <= 1600, severity: "warn", detail: `${words} words` },
    { id: "faq", label: "Has an FAQ", ok: hasFaq, severity: "warn" },
    { id: "keyword", label: "Targets the keyword", ok: keywordHit, severity: "warn" },
    { id: "internal_link", label: "Has an internal link", ok: hasInternalLink, severity: "warn" },
    { id: "cta", label: "Has a soft S-PAY CTA", ok: hasCta, severity: "error" },
  ];

  const weight = (c: SeoCheck) => (c.severity === "error" ? 2 : 1);
  const total = checks.reduce((s, c) => s + weight(c), 0);
  const earned = checks.reduce((s, c) => s + (c.ok ? weight(c) : 0), 0);
  const errors = checks.filter((c) => !c.ok && c.severity === "error").length;
  const warnings = checks.filter((c) => !c.ok && c.severity === "warn").length;
  return { score: Math.round((100 * earned) / total), pass: errors === 0, errors, warnings, checks };
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
