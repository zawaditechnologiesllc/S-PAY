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
  source: "Himalayas" | "RemoteOK" | "Remotive" | "Arbeitnow" | "TheMuse" | "WeWorkRemotely";
  sourceUrl: string;
  isNew: boolean;
  affiliateCta: { label: string; url: string } | null;
  postedAt: string;
}

const REMOTIVE_AFFILIATE = process.env.REMOTIVE_AFFILIATE_URL ?? "https://remotive.com";
const REMOTE_COM_AFFILIATE = process.env.REMOTE_COM_AFFILIATE_URL ?? "https://remote.com";

const jobsCache = new Map<string, { data: NormalizedJob[]; cachedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchJobs(keyword?: string, category?: string, limit = 30): Promise<{
  jobs: NormalizedJob[];
  total: number;
  remoteCom: { label: string; url: string };
}> {
  const cacheKey = `${keyword ?? "all"}-${category ?? "all"}`;
  const cached = jobsCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    const jobs = cached.data.slice(0, limit);
    return { jobs, total: cached.data.length, remoteCom: { label: "Hiring globally? Manage your team with Remote.com", url: REMOTE_COM_AFFILIATE } };
  }

  const results = await Promise.allSettled([
    fetchHimalayas(keyword),
    fetchRemoteOK(keyword),
    fetchRemotive(keyword, category),
    fetchArbeitnow(keyword),
    fetchTheMuse(keyword),
    fetchWeWorkRemotely(keyword),
  ]);

  const [r0, r1, r2, r3, r4, r5] = results;
  const himalayas     = r0.status === "fulfilled" ? r0.value : [];
  const remoteok      = r1.status === "fulfilled" ? r1.value : [];
  const remotive      = r2.status === "fulfilled" ? r2.value : [];
  const arbeitnow     = r3.status === "fulfilled" ? r3.value : [];
  const themuse       = r4.status === "fulfilled" ? r4.value : [];
  const weworkremotely = r5.status === "fulfilled" ? r5.value : [];

  if (r0.status === "rejected") logger.warn({ err: r0.reason }, "Himalayas fetch failed");
  if (r1.status === "rejected") logger.warn({ err: r1.reason }, "RemoteOK fetch failed");
  if (r2.status === "rejected") logger.warn({ err: r2.reason }, "Remotive fetch failed");
  if (r3.status === "rejected") logger.warn({ err: r3.reason }, "Arbeitnow fetch failed");
  if (r4.status === "rejected") logger.warn({ err: r4.reason }, "TheMuse fetch failed");
  if (r5.status === "rejected") logger.warn({ err: r5.reason }, "WeWorkRemotely fetch failed");

  // Interleave sources so each appears in the feed, then deduplicate by title+company
  const all = interleave([himalayas, remoteok, remotive, arbeitnow, themuse, weworkremotely]);

  const seen = new Set<string>();
  const deduped = all.filter((j) => {
    const key = `${j.title}-${j.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  jobsCache.set(cacheKey, { data: deduped, cachedAt: Date.now() });

  const jobs = deduped.slice(0, limit);
  return { jobs, total: deduped.length, remoteCom: { label: "Hiring globally? Manage your team with Remote.com", url: REMOTE_COM_AFFILIATE } };
}

/** Round-robin interleave so no single source dominates the top of the list */
function interleave(arrays: NormalizedJob[][]): NormalizedJob[] {
  const result: NormalizedJob[] = [];
  const maxLen = Math.max(...arrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (arr[i] !== undefined) result.push(arr[i]);
    }
  }
  return result;
}

async function fetchHimalayas(keyword?: string): Promise<NormalizedJob[]> {
  const url = `https://himalayas.app/jobs/api/search?search=${encodeURIComponent(keyword ?? "")}&limit=20`;
  const res = await axios.get(url, { timeout: 8000 });
  const jobs = res.data?.jobs ?? [];
  return jobs.map((j: any): NormalizedJob => ({
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
  }));
}

async function fetchRemoteOK(keyword?: string): Promise<NormalizedJob[]> {
  const res = await axios.get("https://remoteok.io/api", {
    timeout: 8000,
    headers: { "User-Agent": "S-PAY Jobs Aggregator/1.0" },
  });
  const all: any[] = res.data ?? [];
  const jobs = all.slice(1); // first item is metadata
  return jobs
    .filter((j: any) => !keyword || JSON.stringify(j).toLowerCase().includes(keyword.toLowerCase()))
    .slice(0, 20)
    .map((j: any): NormalizedJob => ({
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

async function fetchRemotive(keyword?: string, category?: string): Promise<NormalizedJob[]> {
  const params: Record<string, string> = { limit: "20" };
  if (keyword) params.search = keyword;
  if (category) params.category = category;
  const res = await axios.get("https://remotive.com/api/remote-jobs", { params, timeout: 8000 });
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

async function fetchArbeitnow(keyword?: string): Promise<NormalizedJob[]> {
  const url = keyword
    ? `https://arbeitnow.com/api/job-board-api?search=${encodeURIComponent(keyword)}`
    : "https://arbeitnow.com/api/job-board-api";
  const res = await axios.get(url, { timeout: 8000 });
  const jobs: any[] = res.data?.data ?? [];
  return jobs
    .filter((j: any) => j.remote)
    .slice(0, 20)
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

async function fetchTheMuse(keyword?: string): Promise<NormalizedJob[]> {
  const params: Record<string, string> = { page: "0", descending: "true" };
  if (keyword) params.query = keyword;
  const res = await axios.get("https://www.themuse.com/api/public/jobs", { params, timeout: 8000 });
  const jobs: any[] = res.data?.results ?? [];
  return jobs
    .filter((j: any) => j.locations?.some((l: any) => /remote/i.test(l.name ?? "")))
    .slice(0, 20)
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

async function fetchWeWorkRemotely(keyword?: string): Promise<NormalizedJob[]> {
  // WWR provides an RSS feed — parse it with simple regex (no extra package needed)
  const feedUrl = keyword
    ? `https://weworkremotely.com/remote-jobs/search.rss?term=${encodeURIComponent(keyword)}`
    : "https://weworkremotely.com/remote-jobs.rss";
  const res = await axios.get<string>(feedUrl, {
    timeout: 8000,
    headers: { "User-Agent": "S-PAY Jobs Aggregator/1.0", Accept: "application/rss+xml" },
    responseType: "text",
  });
  const xml = res.data;
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20);
  return items.map((m, i): NormalizedJob => {
    const inner = m[1];
    const get = (tag: string) => inner.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]?.trim()
      ?? inner.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1]?.trim()
      ?? "";
    const title = get("title").replace(/^[^:]+:\s+/, ""); // strip "Company: " prefix WWR adds
    const company = get("title").match(/^([^:]+):/)?.[1]?.trim() ?? "";
    const link = get("link") || get("guid");
    const pubDate = get("pubDate");
    return {
      id: `wwr-${i}-${Date.now()}`,
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
    };
  });
}

function isNewJob(dateStr?: string): boolean {
  if (!dateStr) return false;
  const posted = new Date(dateStr);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return posted > threeDaysAgo;
}
