import { Router } from "express";
import { fetchJobs } from "../lib/jobs";

const router = Router();

const jobDetailCache = new Map<string, unknown>();

router.get("/jobs", async (req, res) => {
  try {
    const keyword = req.query.keyword as string | undefined;
    const category = req.query.category as string | undefined;
    const limit = req.query.limit as string | undefined;
    const result = await fetchJobs(keyword, category, Number(limit) || 30);
    result.jobs.forEach((j) => jobDetailCache.set(j.id, j));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Jobs fetch error");
    res.status(500).json({ error: "fetch_error", message: "Failed to fetch job listings" });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  const jobId = req.params.jobId as string;
  const cached = jobDetailCache.get(jobId);
  if (cached) {
    res.json(cached);
    return;
  }
  try {
    const result = await fetchJobs(undefined, undefined, 100);
    const job = result.jobs.find((j) => j.id === jobId);
    if (!job) {
      res.status(404).json({ error: "not_found", message: "Job not found" });
      return;
    }
    res.json(job);
  } catch (err) {
    req.log.error({ err }, "Job detail fetch error");
    res.status(404).json({ error: "not_found", message: "Job not found" });
  }
});

export default router;
