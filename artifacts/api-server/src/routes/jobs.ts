import { Router } from "express";
import { fetchJobs, getJobById, getAllJobsForSitemap, type NormalizedJob } from "../lib/jobs";

const router = Router();

// SEO engine: a sitemap of every live job URL (3,000–5,000 fresh entries
// daily). Served from the web domain via the /jobs-sitemap.xml rewrite in
// vercel.json; SITE_URL controls the host the URLs point at.
router.get("/sitemap.xml", async (req, res) => {
  try {
    const site = (process.env.SITE_URL ?? "https://spayewallet.com").replace(/\/+$/, "");
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const jobs = (await getAllJobsForSitemap()).slice(0, 45000);
    const today = new Date().toISOString().slice(0, 10);

    const urls = [
      `<url><loc>${site}/jobs</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>0.9</priority></url>`,
      ...jobs.map((j) => {
        const lastmod = (j.postedAt || "").slice(0, 10) || today;
        return `<url><loc>${site}/jobs/${esc(encodeURIComponent(j.id))}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`;
      }),
    ].join("\n");

    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  } catch (err) {
    req.log.error({ err }, "Sitemap error");
    res.status(500).send("");
  }
});

// Jobs served after the hourly rotation keep working from this cache
const jobDetailCache = new Map<string, NormalizedJob>();

router.get("/jobs", async (req, res) => {
  try {
    const keyword = req.query.keyword as string | undefined;
    const category = req.query.category as string | undefined;
    const limit = req.query.limit as string | undefined;
    const result = await fetchJobs(keyword, category, Number(limit) || 200);
    result.jobs.forEach((j) => jobDetailCache.set(j.id, j));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Jobs fetch error");
    res.status(500).json({ error: "fetch_error", message: "Failed to fetch job listings" });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  const jobId = req.params.jobId as string;
  try {
    const job = (await getJobById(jobId)) ?? jobDetailCache.get(jobId);
    if (!job) {
      res.status(404).json({ error: "not_found", message: "Job not found" });
      return;
    }
    jobDetailCache.set(job.id, job);
    res.json(job);
  } catch (err) {
    req.log.error({ err }, "Job detail fetch error");
    res.status(404).json({ error: "not_found", message: "Job not found" });
  }
});

export default router;
