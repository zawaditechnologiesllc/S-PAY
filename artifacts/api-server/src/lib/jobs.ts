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
  source: "Himalayas" | "RemoteOK" | "Remotive" | "Arbeitnow" | "TheMuse" | "WeWorkRemotely" | "Jobicy" | "WorkingNomads" | "Jobspresso" | "RemoteCo" | "DailyRemote" | "Nodesk" | "4DayWeek" | "AuthenticJobs" | "SmashingMagazine" | "WPHired" | "LaraJobs" | "JustRemote" | "SkipTheDrive" | "SupportDriven" | "EuropeRemotely" | "Pangian" | "RemoteLeaf" | "GoRemote" | "ProBlogger" | "CrunchBoard" | "VentureLoop" | "StartupJobs" | "HNJobs" | "PythonOrg" | "DjangoJobs" | "RailsJobs" | "Coroflot" | "Krop" | "JSRemotely" | "AIJobs" | "CryptoJobsList" | "Web3Career" | "FlutterJobs" | "GolangCafe" | "GraphQLJobs" | "Jobgether" | "DynamiteJobs" | "TechCareers" | "DataScienceJobs" | "MLRemote" | "Climatebase" | "DevOpsCafe" | "SecurityJobs" | "CloudJobs" | "SalesGravy" | "GoodGigs" | "JobsinTech" | "AndroidDev" | "iOSJobs" | "BlockchainJobs" | "Web3Jobs" | "ReactJobs" | "NodeJobs" | "VueJobs";
  sourceUrl: string;
  isNew: boolean;
  affiliateCta: { label: string; url: string } | null;
  postedAt: string;
}

const REMOTIVE_AFFILIATE = process.env.REMOTIVE_AFFILIATE_URL ?? "https://remotive.com";
const REMOTE_COM_AFFILIATE = process.env.REMOTE_COM_AFFILIATE_URL ?? "https://remote.com";

const REMOTIVE_ID_TO_LABEL: Record<string, string> = {
  "software-dev": "Engineering",
  "design": "Design",
  "marketing": "Marketing",
  "product": "Product",
  "sales": "Sales",
  "finance": "Finance",
  "all-others": "Operations",
};

function normalizeCategory(raw: string): string {
  const s = raw.toLowerCase();
  if (/engineer|software|develop|programm|tech|cloud|devops|backend|frontend|fullstack|data\s*(science|eng)|machine\s*learn|artificial|ml\b|ai\b|platform|infra|architect|security|cyber|database|qa\b|testing|mobile\s*dev/.test(s)) return "Engineering";
  if (/design|ux\b|ui\b|creative|visual|graphic|brand|illustrat|animat/.test(s)) return "Design";
  if (/market|growth|content|seo\b|social\s*media|copywrite|communicat|public\s*relat|\bpr\b|demand\s*gen/.test(s)) return "Marketing";
  if (/product\s*manag|program\s*manag|\bpm\b|product\s*owner|scrum|agile\s*coach/.test(s)) return "Product";
  if (/\bsales\b|account\s*exec|business\s*dev|\bbdr\b|\bsdr\b|revenue\s*ops|partnership/.test(s)) return "Sales";
  if (/financ|accounting|\btax\b|payroll|audit|bookkeep|controller|treasury/.test(s)) return "Finance";
  if (/operat|support|customer\s*(success|service)|hr\b|human\s*resourc|recruit|talent|admin|legal|compliance|logistics/.test(s)) return "Operations";
  return "Engineering";
}

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
    fetchJobicy(keyword),
    fetchWorkingNomads(keyword),
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
  const sources = results.map((r, i) => {
    if (r.status === "rejected") logger.warn({ err: r.reason }, `${names[i]} fetch failed`);
    return r.status === "fulfilled" ? r.value : [];
  });

  // Interleave sources so each appears in the feed, then deduplicate by title+company
  const all = interleave(sources);

  const seen = new Set<string>();
  let deduped = all
    .map((j) => ({ ...j, category: normalizeCategory(j.category) }))
    .filter((j) => {
      const key = `${j.title}-${j.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Post-filter by category so all sources (not just Remotive) are category-aware
  if (category) {
    const target = REMOTIVE_ID_TO_LABEL[category] ?? null;
    if (target) deduped = deduped.filter((j) => j.category === target);
  }

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
  const url = `https://himalayas.app/jobs/api/search?search=${encodeURIComponent(keyword ?? "")}&limit=75`;
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
    .slice(0, 100)
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
  const params: Record<string, string> = { limit: "100" };
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
  const base = keyword
    ? `https://arbeitnow.com/api/job-board-api?search=${encodeURIComponent(keyword)}`
    : "https://arbeitnow.com/api/job-board-api";
  const pages = await Promise.allSettled([
    axios.get(base, { timeout: 8000 }),
    axios.get(`${base}${keyword ? "&" : "?"}page=2`, { timeout: 8000 }),
    axios.get(`${base}${keyword ? "&" : "?"}page=3`, { timeout: 8000 }),
  ]);
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

async function fetchTheMuse(keyword?: string): Promise<NormalizedJob[]> {
  const params: Record<string, string> = { page: "0", descending: "true" };
  if (keyword) params.query = keyword;
  const res = await axios.get("https://www.themuse.com/api/public/jobs", { params, timeout: 8000 });
  const jobs: any[] = res.data?.results ?? [];
  return jobs
    .filter((j: any) => j.locations?.some((l: any) => /remote/i.test(l.name ?? "")))
    .slice(0, 75)
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
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 60);
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

async function fetchJobicy(keyword?: string): Promise<NormalizedJob[]> {
  const params: Record<string, string | number> = { count: 100 };
  if (keyword) params.search = keyword;
  const res = await axios.get("https://jobicy.com/api/v2/remote-jobs", { params, timeout: 8000 });
  const jobs: any[] = res.data?.jobs ?? [];
  return jobs.slice(0, 100).map((j: any): NormalizedJob => ({
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

async function fetchWorkingNomads(keyword?: string): Promise<NormalizedJob[]> {
  const res = await axios.get("https://www.workingnomads.com/api/exposed_jobs/", {
    timeout: 8000,
    params: keyword ? { q: keyword } : {},
  });
  const jobs: any[] = Array.isArray(res.data) ? res.data : [];
  return jobs.slice(0, 100).map((j: any): NormalizedJob => ({
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
  const items = rawMatches.slice(0, 50);
  return items.map((m, i): NormalizedJob => {
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
      id: `${source.toLowerCase().replace(/\W/g, "")}-${i}-${Date.now()}`,
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

// ─── Existing RSS sources ─────────────────────────────────────────────────────
async function fetchJobspresso() { return fetchRSSFeed("https://jobspresso.co/feed/", "Jobspresso"); }
async function fetchRemoteCo() { return fetchRSSFeed("https://remote.co/remote-jobs/feed/", "RemoteCo"); }
async function fetchDailyRemote() { return fetchRSSFeed("https://dailyremote.com/rss", "DailyRemote"); }
async function fetchNodesk() { return fetchRSSFeed("https://nodesk.co/remote-jobs/rss.xml", "Nodesk"); }
async function fetch4DayWeek() { return fetchRSSFeed("https://4dayweek.io/jobs/rss", "4DayWeek"); }

// ─── 47 new RSS sources ───────────────────────────────────────────────────────
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
  return jobs.slice(0, 50).map((j: any, i: number): NormalizedJob => ({
    id: `gc-${i}-${Date.now()}`,
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
  return jobs.slice(0, 50).map((j: any, i: number): NormalizedJob => ({
    id: `gql-${i}-${Date.now()}`,
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
  return items.slice(0, 50).map((j: any, i: number): NormalizedJob => ({
    id: `vue-${i}-${Date.now()}`,
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
