import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getMaintenance, getSiteContent } from "../lib/settings";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Public platform status — the web/mobile clients use this to show the
// maintenance screen without needing authentication.
router.get("/status", async (_req, res) => {
  const m = await getMaintenance();
  res.json({ status: "ok", maintenance: m.enabled, message: m.enabled ? m.message : undefined });
});

export default router;

// Public marketing content (hero/footer/colours) — editable in /admin/settings
router.get("/site-content", async (_req, res) => {
  try {
    res.json(await getSiteContent());
  } catch {
    res.status(500).json({ error: "internal_error", message: "Failed to load site content" });
  }
});
