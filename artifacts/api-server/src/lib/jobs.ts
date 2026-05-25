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
  source: "Himalayas" | "RemoteOK" | "Remotive";
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
  ]);

  const himalayas = results[0].status === "fulfilled" ? results[0].value : [];
  const remoteok = results[1].status === "fulfilled" ? results[1].value : [];
  const remotive = results[2].status === "fulfilled" ? results[2].value : [];

  if (results[0].status === "rejected") logger.warn({ err: results[0].reason }, "Himalayas fetch failed");
  if (results[1].status === "rejected") logger.warn({ err: results[1].reason }, "RemoteOK fetch failed");
  if (results[2].status === "rejected") logger.warn({ err: results[2].reason }, "Remotive fetch failed");

  const all = [...himalayas, ...remoteok, ...remotive];

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

function isNewJob(dateStr?: string): boolean {
  if (!dateStr) return false;
  const posted = new Date(dateStr);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return posted > threeDaysAgo;
}
