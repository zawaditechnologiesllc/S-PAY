import axios from "axios";
import { logger } from "./logger";

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  companyLogo: string | null;
  salary: string;
  location: string;
  jobType: string;
  category: string;
  description: string | null;
  applyUrl: string;
  source: "SPAY" | "Himalayas" | "RemoteOK" | "Remotive" | "Arbeitnow" | "TheMuse" | "WeWorkRemotely" | "Jobicy" | "WorkingNomads" | "Jobspresso" | "RemoteCo" | "DailyRemote" | "Nodesk" | "4DayWeek" | "AuthenticJobs" | "SmashingMagazine" | "WPHired" | "LaraJobs" | "JustRemote" | "SkipTheDrive" | "SupportDriven" | "EuropeRemotely" | "Pangian" | "RemoteLeaf" | "GoRemote" | "ProBlogger" | "CrunchBoard" | "VentureLoop" | "StartupJobs" | "HNJobs" | "PythonOrg" | "DjangoJobs" | "RailsJobs" | "Coroflot" | "Krop" | "JSRemotely" | "AIJobs" | "CryptoJobsList" | "Web3Career" | "FlutterJobs" | "GolangCafe" | "GraphQLJobs" | "Jobgether" | "DynamiteJobs" | "TechCareers" | "DataScienceJobs" | "MLRemote" | "Climatebase" | "DevOpsCafe" | "SecurityJobs" | "CloudJobs" | "SalesGravy" | "GoodGigs" | "JobsinTech" | "AndroidDev" | "iOSJobs" | "BlockchainJobs" | "Web3Jobs" | "ReactJobs" | "NodeJobs" | "VueJobs";
  sourceUrl: string;
  isNew: boolean;
  affiliateCta: { label: string; url: string } | null;
  postedAt: string;
}

const REMOTIVE_AFFILIATE = process.env.REMOTIVE_AFFILIATE_URL ?? "https://remotive.com";
const REMOTE_COM_AFFILIATE = process.env.REMOTE_COM_AFFILIATE_URL ?? "https://remote.com";

// ─── Categories ───────────────────────────────────────────────────────────────

export const CATEGORY_LABELS = ["Engineering", "Design", "Marketing", "Product", "Sales", "Finance", "Operations"] as const;

// Web sends Remotive-style ids ("software-dev"); mobile sends plain labels ("Engineering").
const REMOTIVE_ID_TO_LABEL: Record<string, string> = {
  "software-dev": "Engineering",
  "design": "Design",
  "marketing": "Marketing",
  "product": "Product",
  "sales": "Sales",
  "finance": "Finance",
  "all-others": "Operations",
};

/** Accepts either form, case-insensitive. Returns a canonical label or null (= no filtering). */
export function resolveCategoryLabel(category?: string): string | null {
  if (!category) return null;
  const lower = category.trim().toLowerCase();
  if (REMOTIVE_ID_TO_LABEL[lower]) return REMOTIVE_ID_TO_LABEL[lower];
  return CATEGORY_LABELS.find((l) => l.toLowerCase() === lower) ?? null;
}

export function normalizeCategory(raw: string): string {
  const s = raw.toLowerCase();
  if (/design|ux\b|ui\b|creative|visual|graphic|brand|illustrat|animat/.test(s)) return "Design";
  if (/market|growth|content|seo\b|social\s*media|copywrite|communicat|public\s*relat|\bpr\b|demand\s*gen/.test(s)) return "Marketing";
  if (/product\s*manag|program\s*manag|\bpm\b|product\s*owner|scrum|agile\s*coach/.test(s)) return "Product";
  if (/\bsales\b|account\s*exec|business\s*dev|\bbdr\b|\bsdr\b|revenue\s*ops|partnership/.test(s)) return "Sales";
  if (/financ|accounting|\btax\b|payroll|audit|bookkeep|controller|treasury/.test(s)) return "Finance";
  if (/operat|support|customer\s*(success|service)|hr\b|human\s*resourc|recruit|talent|\badmin|legal|compliance|logistics|writer|writing|translat|educat|teach/.test(s)) return "Operations";
  if (/engineer|software|develop|programm|tech|cloud|devops|backend|frontend|fullstack|data\s*(science|eng)|machine\s*learn|artificial|\bml\b|\bai\b|platform|infra|architect|security|cyber|database|qa\b|testing|mobile\s*dev/.test(s)) return "Engineering";
  return "Engineering";
}

// ─── Filtering (pure, unit-testable) ─────────────────────────────────────────

function stripHtml(html: string | null): string {
  return html ? html.replace(/<[^>]+>/g, " ") : "";
}

/**
 * In-memory filtering over the aggregated dataset. Category matches the
 * normalized label; keyword is an AND-match of all terms across title,
 * company, category, location, and description.
 */
export function filterJobs(jobs: NormalizedJob[], keyword?: string, category?: string): NormalizedJob[] {
  let result = jobs;

  const label = resolveCategoryLabel(category);
  if (label) result = result.filter((j) => j.category === label);

  const terms = (keyword ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length > 0) {
    result = result.filter((j) => {
      const haystack = `${j.title} ${j.company} ${j.category} ${j.location} ${stripHtml(j.description)}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }

  return result;
}

// ─── Single aggregated dataset: SWR cache + Postgres snapshot ─────────────────
// All 60 sources are fetched once (boot warm-up + hourly refresh). Search and
// category filters never hit upstream — they filter this dataset in memory,
// so every request answers instantly.

const CACHE_TTL_MS = 60 * 60 * 1000; // refresh hourly
const DB_SNAPSHOT_KEY = "jobs:default-feed";

let allJobsCache: { data: NormalizedJob[]; cachedAt: number } | null = null;
let refreshInFlight: Promise<NormalizedJob[]> | null = null;

async function getAllJobs(): Promise<NormalizedJob[]> {
  if (allJobsCache) {
    // Serve instantly; revalidate in the background when stale
    if (Date.now() - allJobsCache.cachedAt >= CACHE_TTL_MS) {
      refreshAllJobs().catch((err) => logger.warn({ err }, "Background jobs refresh failed"));
    }
    return allJobsCache.data;
  }
  return refreshAllJobs();
}

async function refreshAllJobs(): Promise<NormalizedJob[]> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const data = await aggregateAllSources();
      // Never clobber good data with an empty result (e.g. transient upstream outage)
      if (data.length === 0 && allJobsCache && allJobsCache.data.length > 0) return allJobsCache.data;
      allJobsCache = { data, cachedAt: Date.now() };
      persistSnapshot(data).catch((err) => logger.warn({ err }, "Jobs snapshot persistence failed"));
      return data;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Save the feed to the jobs_cache table so cold starts serve jobs instantly */
async function persistSnapshot(data: NormalizedJob[]): Promise<void> {
  if (!process.env.DATABASE_URL || data.length === 0) return;
  const { db, jobsCacheTable } = await import("@workspace/db");
  await db
    .insert(jobsCacheTable)
    .values({ key: DB_SNAPSHOT_KEY, data, cachedAt: new Date() })
    .onConflictDoUpdate({ target: jobsCacheTable.key, set: { data, cachedAt: new Date() } });
  logger.info({ count: data.length }, "Jobs snapshot persisted to database");
}

/**
 * Called on server boot: hydrate the feed from the last Postgres snapshot
 * (instant availability), then refresh from live sources if stale.
 */
export async function warmJobsCache(): Promise<void> {
  if (process.env.DATABASE_URL && !allJobsCache) {
    try {
      const { db, jobsCacheTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select().from(jobsCacheTable).where(eq(jobsCacheTable.key, DB_SNAPSHOT_KEY)).limit(1);
      const snapshot = row?.data as NormalizedJob[] | undefined;
      if (Array.isArray(snapshot) && snapshot.length > 0) {
        allJobsCache = { data: snapshot, cachedAt: row!.cachedAt.getTime() };
        logger.info({ count: snapshot.length }, "Jobs cache hydrated from database snapshot");
      }
    } catch (err) {
      logger.warn({ err }, "Jobs snapshot hydration skipped");
    }
  }
  if (!allJobsCache || Date.now() - allJobsCache.cachedAt >= CACHE_TTL_MS) {
    const data = await refreshAllJobs();
    logger.info({ total: data.length }, "Jobs feed warmed from live sources");
  }
}

/** Re-fetch the feed every hour so 3,000–5,000 fresh jobs are always available */
export function startJobsRefreshLoop(intervalMs = CACHE_TTL_MS): NodeJS.Timeout {
  const timer = setInterval(() => {
    refreshAllJobs().then(
      (data) => logger.info({ total: data.length }, "Scheduled jobs refresh complete"),
      (err) => logger.warn({ err }, "Scheduled jobs refresh failed"),
    );
  }, intervalMs);
  timer.unref();
  return timer;
}

// ─── S-PAY's own listings (admin-injected, pinned first, SEO content) ────────

let customJobsCache: { data: NormalizedJob[]; cachedAt: number } | null = null;
const CUSTOM_JOBS_TTL_MS = 30 * 1000;

export function invalidateCustomJobs(): void {
  customJobsCache = null;
}

async function getCustomJobs(): Promise<NormalizedJob[]> {
  if (customJobsCache && Date.now() - customJobsCache.cachedAt < CUSTOM_JOBS_TTL_MS) {
    return customJobsCache.data;
  }
  if (!process.env.DATABASE_URL) return [];
  try {
    const { db, customJobsTable } = await import("@workspace/db");
    const { eq, desc } = await import("drizzle-orm");
    const rows = await db.select().from(customJobsTable)
      .where(eq(customJobsTable.active, true))
      .orderBy(desc(customJobsTable.createdAt));
    const data: NormalizedJob[] = rows.map((r) => ({
      id: `sp-${r.id}`,
      title: r.title,
      company: r.company,
      companyLogo: null,
      salary: r.salary,
      location: r.location,
      jobType: "full_time",
      category: resolveCategoryLabel(r.category) ?? normalizeCategory(r.category),
      description: r.description,
      applyUrl: r.applyUrl,
      source: "SPAY",
      sourceUrl: r.applyUrl,
      isNew: isNewJob(r.createdAt.toISOString()),
      affiliateCta: null,
      postedAt: r.createdAt.toISOString(),
    }));
    customJobsCache = { data, cachedAt: Date.now() };
    return data;
  } catch (err) {
    logger.warn({ err }, "Custom jobs read failed");
    return customJobsCache?.data ?? [];
  }
}

// ─── Public API used by the routes ───────────────────────────────────────────

export async function fetchJobs(keyword?: string, category?: string, limit = 30): Promise<{
  jobs: NormalizedJob[];
  total: number;
  remoteCom: { label: string; url: string };
}> {
  const [custom, aggregated] = await Promise.all([getCustomJobs(), getAllJobs()]);
  const filtered = filterJobs([...custom, ...aggregated], keyword, category);
  return {
    jobs: filtered.slice(0, limit),
    total: filtered.length,
    remoteCom: { label: "Hiring globally? Manage your team with Remote.com", url: REMOTE_COM_AFFILIATE },
  };
}

export async function getJobById(jobId: string): Promise<NormalizedJob | null> {
  const [custom, aggregated] = await Promise.all([getCustomJobs(), getAllJobs()]);
  return custom.find((j) => j.id === jobId) ?? aggregated.find((j) => j.id === jobId) ?? null;
}

/** Every live job id+date — feeds the SEO sitemap. */
export async function getAllJobsForSitemap(): Promise<Array<{ id: string; postedAt: string }>> {
  const [custom, aggregated] = await Promise.all([getCustomJobs(), getAllJobs()]);
  return [...custom, ...aggregated].map((j) => ({ id: j.id, postedAt: j.postedAt }));
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

async function aggregateAllSources(): Promise<NormalizedJob[]> {
  const results = await Promise.allSettled([
    fetchHimalayas(),
    fetchRemoteOK(),
    fetchRemotive(),
    fetchArbeitnow(),
    fetchTheMuse(),
    fetchWeWorkRemotely(),
    fetchJobicy(),
    fetchWorkingNomads(),
    fetchJobspresso(),
    fetchRemoteCo(),
    fetchDailyRemote(),
    fetchNodesk(),
    fetch4DayWeek(),
    fetchAuthenticJobs(),
    fetchSmashingMagazine(),
    fetchWPHired(),
    fetchLaraJobs(),
    fetchJustRemote(),
    fetchSkipTheDrive(),
    fetchSupportDriven(),
    fetchEuropeRemotely(),
    fetchPangian(),
    fetchRemoteLeaf(),
    fetchGoRemote(),
    fetchProBlogger(),
    fetchCrunchBoard(),
    fetchVentureLoop(),
    fetchStartupJobs(),
    fetchHNJobs(),
    fetchPythonOrg(),
    fetchDjangoJobs(),
    fetchRailsJobs(),
    fetchCoroflot(),
    fetchKrop(),
    fetchJSRemotely(),
    fetchAIJobs(),
    fetchCryptoJobsList(),
    fetchWeb3Career(),
    fetchFlutterJobs(),
    fetchGolangCafe(),
    fetchGraphQLJobs(),
    fetchJobgether(),
    fetchDynamiteJobs(),
    fetchTechCareers(),
    fetchDataScienceJobs(),
    fetchMLRemote(),
    fetchClimatebase(),
    fetchDevOpsCafe(),
    fetchSecurityJobs(),
    fetchCloudJobs(),
    fetchSalesGravy(),
    fetchGoodGigs(),
    fetchJobsinTech(),
    fetchAndroidDev(),
    fetchiOSJobs(),
    fetchBlockchainJobs(),
    fetchWeb3Jobs(),
    fetchReactJobs(),
    fetchNodeJobs(),
    fetchVueJobs(),
  ]);

  const names = [
    "Himalayas","RemoteOK","Remotive","Arbeitnow","TheMuse","WeWorkRemotely",
    "Jobicy","WorkingNomads","Jobspresso","RemoteCo","DailyRemote","Nodesk","4DayWeek",
    "AuthenticJobs","SmashingMagazine","WPHired","LaraJobs","JustRemote","SkipTheDrive",
    "SupportDriven","EuropeRemotely","Pangian","RemoteLeaf","GoRemote","ProBlogger",
    "CrunchBoard","VentureLoop","StartupJobs","HNJobs","PythonOrg","DjangoJobs",
    "RailsJobs","Coroflot","Krop","JSRemotely","AIJobs","CryptoJobsList","Web3Career",
    "FlutterJobs","GolangCafe","GraphQLJobs","Jobgether","DynamiteJobs","TechCareers",
    "DataScienceJobs","MLRemote","Climatebase","DevOpsCafe","SecurityJobs","CloudJobs",
    "SalesGravy","GoodGigs","JobsinTech","AndroidDev","iOSJobs","BlockchainJobs",
    "Web3Jobs","ReactJobs","NodeJobs","VueJobs",
  ];
  // Individual source outages are routine and self-heal on the hourly refresh —
  // log one compact line each (a full AxiosError dump per source floods the end
  // of every boot log with scary red blocks that read like real failures).
  const failedSources: string[] = [];
  const sources = results.map((r, i) => {
    if (r.status === "rejected") failedSources.push(names[i] ?? `#${i}`);
    return r.status === "fulfilled" ? r.value : [];
  });
  if (failedSources.length > 0) {
    logger.warn(
      { failedCount: failedSources.length, totalSources: results.length, failedSources },
      "Some job sources unreachable this cycle — feed continues from the rest, retries hourly",
    );
  }

  // Interleave sources so each appears in the feed, then deduplicate by title+company
  const all = interleave(sources);

  const seen = new Set<string>();
  return all
    .map((j) => ({
      ...j,
      category: normalizeCategory(j.category),
      // Cap description size: 4,000+ jobs × unbounded HTML would pressure the
      // 512MB instance and bloat the Postgres snapshot.
      description: j.description && j.description.length > 16000
        ? `${j.description.slice(0, 16000)}…`
        : j.description,
    }))
    .filter((j) => {
      if (!j.title) return false;
      const key = `${j.title}-${j.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Round-robin interleave so no single source dominates the top of the list */
function interleave(arrays: NormalizedJob[][]): NormalizedJob[] {
  if (arrays.length === 0) return [];
  const result: NormalizedJob[] = [];
  const maxLen = Math.max(...arrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (arr[i] !== undefined) result.push(arr[i]);
    }
  }
  return result;
}

/** Deterministic short id from a URL/title so job detail links survive cache refreshes */
function stableId(prefix: string, input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return `${prefix}-${h.toString(36)}`;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

function mapHimalayasJob(j: any): NormalizedJob {
  return {
    id: `h-${j.slug ?? j.id}`,
    title: j.title ?? "",
    company: j.companyName ?? "",
    companyLogo: j.companyLogo ?? null,
    salary: j.salary ?? "Competitive",
    location: j.locationRestrictions?.join(", ") ?? "Worldwide",
    jobType: "full_time",
    category: j.categories?.[0] ?? "Technology",
    description: j.description ?? null,
    applyUrl: j.applicationLink ?? j.url ?? "",
    source: "Himalayas",
    sourceUrl: j.url ? `https://himalayas.app${j.url}` : "https://himalayas.app",
    isNew: isNewJob(j.createdAt),
    affiliateCta: null,
    postedAt: j.createdAt ?? new Date().toISOString(),
  };
}

async function fetchHimalayas(): Promise<NormalizedJob[]> {
  // 5 pages of 100 from the public API for full coverage
  const pages = await Promise.allSettled(
    [0, 100, 200, 300, 400].map((offset) =>
      axios.get(`https://himalayas.app/jobs/api?limit=100&offset=${offset}`, { timeout: 12000 }),
    ),
  );
  const raw: any[] = pages.flatMap((p) => (p.status === "fulfilled" ? (p.value.data?.jobs ?? []) : []));
  const seen = new Set<string>();
  return raw
    .filter((j: any) => {
      const key = String(j.slug ?? j.id ?? "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(mapHimalayasJob);
}

async function fetchRemoteOK(): Promise<NormalizedJob[]> {
  const res = await axios.get("https://remoteok.io/api", {
    timeout: 12000,
    headers: { "User-Agent": "S-PAY Jobs Aggregator/1.0" },
  });
  const all: any[] = res.data ?? [];
  const jobs = all.slice(1); // first item is metadata
  return jobs.map((j: any): NormalizedJob => ({
    id: `r-${j.id}`,
    title: j.position ?? "",
    company: j.company ?? "",
    companyLogo: j.company_logo ?? null,
    salary: j.salary ?? "Competitive",
    location: j.location ?? "Worldwide",
    jobType: "full_time",
    category: j.tags?.[0] ?? "Technology",
    description: j.description ?? null,
    applyUrl: j.apply_url ?? j.url ?? "",
    source: "RemoteOK",
    sourceUrl: j.url ?? "https://remoteok.io",
    isNew: isNewJob(j.date),
    affiliateCta: null,
    postedAt: j.date ?? new Date().toISOString(),
  }));
}

async function fetchRemotive(): Promise<NormalizedJob[]> {
  // No limit param: Remotive returns its full live dataset (~1,500–2,000 jobs)
  const res = await axios.get("https://remotive.com/api/remote-jobs", { timeout: 20000 });
  const jobs = res.data?.jobs ?? [];
  return jobs.map((j: any): NormalizedJob => ({
    id: `rv-${j.id}`,
    title: j.title ?? "",
    company: j.company_name ?? "",
    companyLogo: j.company_logo ?? null,
    salary: j.salary ?? "Competitive",
    location: j.candidate_required_location ?? "Worldwide",
    jobType: (j.job_type ?? "full_time").toLowerCase().replace(" ", "_"),
    category: j.category ?? "Technology",
    description: j.description ?? null,
    applyUrl: j.url ?? "",
    source: "Remotive",
    sourceUrl: j.url ?? "https://remotive.com",
    isNew: isNewJob(j.publication_date),
    affiliateCta: { label: "See 150,000+ remote jobs on Remotive", url: REMOTIVE_AFFILIATE },
    postedAt: j.publication_date ?? new Date().toISOString(),
  }));
}

async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  const base = "https://arbeitnow.com/api/job-board-api";
  const pages = await Promise.allSettled(
    [1, 2, 3, 4, 5, 6].map((page) =>
      axios.get(page === 1 ? base : `${base}?page=${page}`, { timeout: 12000 }),
    ),
  );
  const allJobs: any[] = pages.flatMap((p) =>
    p.status === "fulfilled" ? (p.value.data?.data ?? []) : []
  );
  const seen = new Set<string>();
  return allJobs
    .filter((j: any) => {
      if (!j.remote) return false;
      if (seen.has(j.slug)) return false;
      seen.add(j.slug);
      return true;
    })
    .map((j: any): NormalizedJob => ({
      id: `an-${j.slug}`,
      title: j.title ?? "",
      company: j.company_name ?? "",
      companyLogo: null,
      salary: "Competitive",
      location: j.location ?? "Worldwide",
      jobType: j.job_types?.[0]?.toLowerCase().replace(/ /g, "_") ?? "full_time",
      category: j.tags?.[0] ?? "Technology",
      description: j.description ?? null,
      applyUrl: j.url ?? "",
      source: "Arbeitnow",
      sourceUrl: j.url ?? "https://www.arbeitnow.com",
      isNew: isNewJob(new Date(j.created_at * 1000).toISOString()),
      affiliateCta: null,
      postedAt: new Date(j.created_at * 1000).toISOString(),
    }));
}

async function fetchTheMuse(): Promise<NormalizedJob[]> {
  const pages = await Promise.allSettled(
    [0, 1, 2, 3, 4].map((page) =>
      axios.get("https://www.themuse.com/api/public/jobs", {
        params: { page: String(page), descending: "true" },
        timeout: 12000,
      }),
    ),
  );
  const raw: any[] = pages.flatMap((p) => (p.status === "fulfilled" ? (p.value.data?.results ?? []) : []));
  const seen = new Set<string>();
  return raw
    .filter((j: any) => {
      if (!j.locations?.some((l: any) => /remote/i.test(l.name ?? ""))) return false;
      const key = String(j.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 150)
    .map((j: any): NormalizedJob => ({
      id: `tm-${j.id}`,
      title: j.name ?? "",
      company: j.company?.name ?? "",
      companyLogo: null,
      salary: "Competitive",
      location: j.locations?.map((l: any) => l.name).join(", ") ?? "Remote",
      jobType: j.levels?.[0]?.name?.toLowerCase().replace(/ /g, "_") ?? "full_time",
      category: j.categories?.[0]?.name ?? "Technology",
      description: null,
      applyUrl: j.refs?.landing_page ?? "",
      source: "TheMuse",
      sourceUrl: j.refs?.landing_page ?? "https://www.themuse.com/jobs",
      isNew: isNewJob(j.publication_date),
      affiliateCta: null,
      postedAt: j.publication_date ?? new Date().toISOString(),
    }));
}

const WWR_FEEDS = [
  "https://weworkremotely.com/remote-jobs.rss",
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "https://weworkremotely.com/categories/remote-product-jobs.rss",
  "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "https://weworkremotely.com/categories/remote-all-other-remote-jobs.rss",
];

async function fetchWeWorkRemotely(): Promise<NormalizedJob[]> {
  const feeds = await Promise.allSettled(
    WWR_FEEDS.map((url) =>
      axios.get<string>(url, {
        timeout: 12000,
        headers: { "User-Agent": "S-PAY Jobs Aggregator/1.0", Accept: "application/rss+xml" },
        responseType: "text",
      }),
    ),
  );
  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  for (const feed of feeds) {
    if (feed.status !== "fulfilled") continue;
    const xml = feed.value.data;
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (const m of items) {
      const inner = m[1];
      const get = (tag: string) => inner.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]?.trim()
        ?? inner.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1]?.trim()
        ?? "";
      const rawTitle = get("title");
      const title = rawTitle.replace(/^[^:]+:\s+/, ""); // strip "Company: " prefix WWR adds
      const company = rawTitle.match(/^([^:]+):/)?.[1]?.trim() ?? "";
      const link = get("link") || get("guid");
      const dedupeKey = link || `${title}-${company}`;
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const pubDate = get("pubDate");
      jobs.push({
        id: stableId("wwr", dedupeKey),
        title,
        company,
        companyLogo: null,
        salary: "Competitive",
        location: "Worldwide",
        jobType: "full_time",
        category: get("category") || "Technology",
        description: null,
        applyUrl: link,
        source: "WeWorkRemotely",
        sourceUrl: link || "https://weworkremotely.com",
        isNew: isNewJob(pubDate),
        affiliateCta: null,
        postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }
  }
  return jobs;
}

async function fetchJobicy(): Promise<NormalizedJob[]> {
  const res = await axios.get("https://jobicy.com/api/v2/remote-jobs", { params: { count: 100 }, timeout: 12000 });
  const jobs: any[] = res.data?.jobs ?? [];
  return jobs.map((j: any): NormalizedJob => ({
    id: `jcy-${j.id ?? j.jobSlug}`,
    title: j.jobTitle ?? "",
    company: j.companyName ?? "",
    companyLogo: j.companyLogo ?? null,
    salary: j.annualSalaryMin && j.annualSalaryMax
      ? `$${Math.round(j.annualSalaryMin / 1000)}k–$${Math.round(j.annualSalaryMax / 1000)}k`
      : "Competitive",
    location: j.jobGeo ?? "Worldwide",
    jobType: (j.jobType ?? "full_time").toLowerCase().replace(/[^a-z]/g, "_"),
    category: j.jobIndustry?.[0] ?? "Technology",
    description: j.jobExcerpt ?? null,
    applyUrl: j.url ?? "",
    source: "Jobicy",
    sourceUrl: j.url ?? "https://jobicy.com",
    isNew: isNewJob(j.pubDate),
    affiliateCta: null,
    postedAt: j.pubDate ?? new Date().toISOString(),
  }));
}

async function fetchWorkingNomads(): Promise<NormalizedJob[]> {
  const res = await axios.get("https://www.workingnomads.com/api/exposed_jobs/", { timeout: 12000 });
  const jobs: any[] = Array.isArray(res.data) ? res.data : [];
  return jobs.slice(0, 600).map((j: any): NormalizedJob => ({
    id: `wn-${j.id}`,
    title: j.title ?? "",
    company: j.company ?? "",
    companyLogo: j.company_logo_url ?? null,
    salary: j.salary ?? "Competitive",
    location: j.location ?? "Worldwide",
    jobType: "full_time",
    category: j.category ?? "Technology",
    description: null,
    applyUrl: j.url ?? "",
    source: "WorkingNomads",
    sourceUrl: j.url ?? "https://www.workingnomads.com",
    isNew: isNewJob(j.pub_date),
    affiliateCta: null,
    postedAt: j.pub_date ?? new Date().toISOString(),
  }));
}

async function fetchRSSFeed(feedUrl: string, source: NormalizedJob["source"]): Promise<NormalizedJob[]> {
  const res = await axios.get<string>(feedUrl, {
    timeout: 8000,
    headers: { "User-Agent": "S-PAY Jobs Aggregator/1.0", Accept: "application/rss+xml,application/atom+xml,text/xml" },
    responseType: "text",
  });
  const xml = res.data;
  const base = feedUrl.replace(/[?#].*/, "").replace(/\/(feed|rss|atom).*/, "");
  // Support both RSS <item> and Atom <entry>
  let rawMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const isAtom = rawMatches.length === 0;
  if (isAtom) rawMatches = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  const items = rawMatches.slice(0, 100);
  return items.map((m): NormalizedJob => {
    const inner = m[1];
    const get = (tag: string) =>
      inner.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]?.trim() ??
      inner.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1]?.trim() ??
      "";
    const getAttr = (tag: string, attr: string) =>
      inner.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`))?.[1]?.trim() ?? "";
    const rawTitle = get("title");
    const title = rawTitle.replace(/^[^:]+:\s+/, "");
    const company = rawTitle.includes(":") ? rawTitle.split(":")[0]?.trim() ?? "" : get("dc:creator") ?? "";
    const link = isAtom
      ? (getAttr("link", "href") || get("link") || get("id"))
      : (get("link") || get("guid"));
    const pubDate = isAtom ? (get("published") || get("updated")) : get("pubDate");
    return {
      id: stableId(source.toLowerCase().replace(/\W/g, ""), link || rawTitle),
      title,
      company,
      companyLogo: null,
      salary: "Competitive",
      location: "Remote",
      jobType: "full_time",
      category: get("category") || "Technology",
      description: null,
      applyUrl: link,
      source,
      sourceUrl: link || base,
      isNew: isNewJob(pubDate),
      affiliateCta: null,
      postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    };
  });
}

// ─── RSS sources ──────────────────────────────────────────────────────────────
async function fetchJobspresso() { return fetchRSSFeed("https://jobspresso.co/feed/", "Jobspresso"); }
async function fetchRemoteCo() { return fetchRSSFeed("https://remote.co/remote-jobs/feed/", "RemoteCo"); }
async function fetchDailyRemote() { return fetchRSSFeed("https://dailyremote.com/rss", "DailyRemote"); }
async function fetchNodesk() { return fetchRSSFeed("https://nodesk.co/remote-jobs/rss.xml", "Nodesk"); }
async function fetch4DayWeek() { return fetchRSSFeed("https://4dayweek.io/jobs/rss", "4DayWeek"); }
async function fetchAuthenticJobs()  { return fetchRSSFeed("https://authenticjobs.com/feed/", "AuthenticJobs"); }
async function fetchSmashingMagazine() { return fetchRSSFeed("https://www.smashingmagazine.com/jobs/feed/", "SmashingMagazine"); }
async function fetchWPHired()        { return fetchRSSFeed("https://www.wphired.com/feed/", "WPHired"); }
async function fetchLaraJobs()       { return fetchRSSFeed("https://larajobs.com/feed", "LaraJobs"); }
async function fetchJustRemote()     { return fetchRSSFeed("https://justremote.co/feed/", "JustRemote"); }
async function fetchSkipTheDrive()   { return fetchRSSFeed("https://www.skipthedrive.com/feed/", "SkipTheDrive"); }
async function fetchSupportDriven()  { return fetchRSSFeed("https://jobs.supportdriven.com/feed/", "SupportDriven"); }
async function fetchEuropeRemotely() { return fetchRSSFeed("https://europeremotely.com/feed/", "EuropeRemotely"); }
async function fetchPangian()        { return fetchRSSFeed("https://www.pangian.com/job-travel-remote/feed/", "Pangian"); }
async function fetchRemoteLeaf()     { return fetchRSSFeed("https://remoteleaf.com/whoishiring/feed/", "RemoteLeaf"); }
async function fetchGoRemote()       { return fetchRSSFeed("https://goremote.io/feed/", "GoRemote"); }
async function fetchProBlogger()     { return fetchRSSFeed("https://problogger.com/jobs/feed/", "ProBlogger"); }
async function fetchCrunchBoard()    { return fetchRSSFeed("https://www.crunchboard.com/feed/", "CrunchBoard"); }
async function fetchVentureLoop()    { return fetchRSSFeed("https://www.ventureloop.com/ventureloop/rss.php?company=0&feed=RSS&tag=0&q=remote", "VentureLoop"); }
async function fetchStartupJobs()    { return fetchRSSFeed("https://startup.jobs/rss", "StartupJobs"); }
async function fetchHNJobs()         { return fetchRSSFeed("https://news.ycombinator.com/jobs.rss", "HNJobs"); }
async function fetchPythonOrg()      { return fetchRSSFeed("https://www.python.org/jobs/feed/rss/", "PythonOrg"); }
async function fetchDjangoJobs()     { return fetchRSSFeed("https://www.djangojobs.net/jobs/feed/", "DjangoJobs"); }
async function fetchRailsJobs()      { return fetchRSSFeed("https://jobs.rubyonrails.org/jobs.atom", "RailsJobs"); }
async function fetchCoroflot()       { return fetchRSSFeed("https://www.coroflot.com/rss/jobs/rss.xml", "Coroflot"); }
async function fetchKrop()           { return fetchRSSFeed("https://www.krop.com/creativejobs/rss/", "Krop"); }
async function fetchJSRemotely()     { return fetchRSSFeed("https://jsremotely.com/feed/", "JSRemotely"); }
async function fetchAIJobs()         { return fetchRSSFeed("https://aijobs.net/feed/", "AIJobs"); }
async function fetchCryptoJobsList() { return fetchRSSFeed("https://cryptojobslist.com/rss", "CryptoJobsList"); }
async function fetchWeb3Career()     { return fetchRSSFeed("https://web3.career/rss.xml", "Web3Career"); }
async function fetchFlutterJobs()    { return fetchRSSFeed("https://flutterjobs.info/feed/", "FlutterJobs"); }
async function fetchJobgether()      { return fetchRSSFeed("https://jobgether.com/feed/", "Jobgether"); }
async function fetchDynamiteJobs()   { return fetchRSSFeed("https://dynamitejobs.com/feed/", "DynamiteJobs"); }
async function fetchTechCareers()    { return fetchRSSFeed("https://techcareers.io/rss/", "TechCareers"); }
async function fetchDataScienceJobs() { return fetchRSSFeed("https://datascience.jobs/feed/", "DataScienceJobs"); }
async function fetchMLRemote()       { return fetchRSSFeed("https://mlremote.com/feed/", "MLRemote"); }
async function fetchClimatebase()    { return fetchRSSFeed("https://climatebase.org/jobs/feed/", "Climatebase"); }
async function fetchDevOpsCafe()     { return fetchRSSFeed("https://devops.com/jobs/feed/", "DevOpsCafe"); }
async function fetchSecurityJobs()   { return fetchRSSFeed("https://www.securityjobs.net/rss/", "SecurityJobs"); }
async function fetchCloudJobs()      { return fetchRSSFeed("https://cloudjobs.io/feed/", "CloudJobs"); }
async function fetchSalesGravy()     { return fetchRSSFeed("https://www.salesgravy.com/feed/", "SalesGravy"); }
async function fetchGoodGigs()       { return fetchRSSFeed("https://www.goodgigs.net/feed/", "GoodGigs"); }
async function fetchJobsinTech()     { return fetchRSSFeed("https://www.jobsintech.io/feed/", "JobsinTech"); }
async function fetchAndroidDev()     { return fetchRSSFeed("https://androidjobs.io/feed/", "AndroidDev"); }
async function fetchiOSJobs()        { return fetchRSSFeed("https://iosdevjobs.com/feed/", "iOSJobs"); }
async function fetchBlockchainJobs() { return fetchRSSFeed("https://blockchain.works-hub.com/rss/", "BlockchainJobs"); }
async function fetchWeb3Jobs()       { return fetchRSSFeed("https://web3jobs.com/feed/", "Web3Jobs"); }
async function fetchReactJobs()      { return fetchRSSFeed("https://reactjobs.us/feed/", "ReactJobs"); }
async function fetchNodeJobs()       { return fetchRSSFeed("https://nodejobs.io/feed/", "NodeJobs"); }

async function fetchGolangCafe(): Promise<NormalizedJob[]> {
  const res = await axios.get<any[]>("https://golang.cafe/api/jobs", { timeout: 8000 });
  const jobs: any[] = Array.isArray(res.data) ? res.data : [];
  return jobs.slice(0, 100).map((j: any): NormalizedJob => ({
    id: stableId("gc", j.url ?? `${j.jobtitle ?? j.title}-${j.company}`),
    title: j.jobtitle ?? j.title ?? "",
    company: j.company ?? "",
    companyLogo: null,
    salary: j.salary ?? "Competitive",
    location: j.location ?? "Remote",
    jobType: "full_time",
    category: "Engineering",
    description: j.description ?? null,
    applyUrl: j.url ?? "https://golang.cafe",
    source: "GolangCafe",
    sourceUrl: j.url ?? "https://golang.cafe",
    isNew: isNewJob(j.created_at),
    affiliateCta: null,
    postedAt: j.created_at ?? new Date().toISOString(),
  }));
}

async function fetchGraphQLJobs(): Promise<NormalizedJob[]> {
  const res = await axios.get<any>("https://graphql.jobs/r/api", { timeout: 8000 });
  const jobs: any[] = Array.isArray(res.data) ? res.data : (res.data?.jobs ?? []);
  return jobs.slice(0, 100).map((j: any): NormalizedJob => ({
    id: stableId("gql", j.url ?? `${j.title}-${j.company?.name ?? j.company}`),
    title: j.title ?? "",
    company: j.company?.name ?? j.company ?? "",
    companyLogo: null,
    salary: "Competitive",
    location: j.locationNames?.join(", ") ?? j.location ?? "Remote",
    jobType: "full_time",
    category: "Engineering",
    description: j.description ?? null,
    applyUrl: j.applyUrl ?? j.url ?? "https://graphql.jobs",
    source: "GraphQLJobs",
    sourceUrl: j.url ?? "https://graphql.jobs",
    isNew: isNewJob(j.createdAt),
    affiliateCta: null,
    postedAt: j.createdAt ?? new Date().toISOString(),
  }));
}

async function fetchVueJobs(): Promise<NormalizedJob[]> {
  const res = await axios.get<any>("https://vuejobs.com/feed.json", { timeout: 8000 });
  const items: any[] = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);
  return items.slice(0, 100).map((j: any): NormalizedJob => ({
    id: stableId("vue", j.url ?? j.title ?? ""),
    title: j.title ?? "",
    company: j.author?.name ?? "",
    companyLogo: null,
    salary: "Competitive",
    location: "Remote",
    jobType: "full_time",
    category: "Engineering",
    description: j.content_text ?? j.summary ?? null,
    applyUrl: j.url ?? "https://vuejobs.com",
    source: "VueJobs",
    sourceUrl: j.url ?? "https://vuejobs.com",
    isNew: isNewJob(j.date_published),
    affiliateCta: null,
    postedAt: j.date_published ?? new Date().toISOString(),
  }));
}

function isNewJob(dateStr?: string): boolean {
  if (!dateStr) return false;
  const posted = new Date(dateStr);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return posted > threeDaysAgo;
}
