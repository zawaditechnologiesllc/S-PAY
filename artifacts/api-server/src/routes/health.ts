import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getMaintenance } from "../lib/settings";

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
