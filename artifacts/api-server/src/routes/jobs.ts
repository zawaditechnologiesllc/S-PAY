import { Router } from "express";
import { fetchJobs, getJobById, type NormalizedJob } from "../lib/jobs";

const router = Router();

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
