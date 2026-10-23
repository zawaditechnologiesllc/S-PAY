import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAnyAdmin } from "../lib/admin-roles";
import {
  getScoreView, updateScoreSettings, deleteScoreHistory, exportScoreData,
  createScoreShare, revokeScoreShares, verifyScoreShare, adminScoreStats, ScoreError,
} from "../lib/score";

const router = Router();

// S-PAY Score — the member's 300–850 reliability score (personal + business).
// Model + customer-facing explanation: @workspace/score-model. Data trail:
// lib/score.ts. Every endpoint here acts only on the signed-in member's own data,
// except the public share-link verifier and the admin stats.

function fail(req: Request, res: Response, err: unknown, what: string): void {
  if (err instanceof ScoreError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  req.log.error({ err }, `${what} error`);
  res.status(500).json({ error: "internal_error", message: `Failed to ${what.toLowerCase()}` });
}

router.get("/score/me", requireAuth, async (req, res) => {
  try {
    res.json(await getScoreView(req.user!.userId));
  } catch (err) {
    fail(req, res, err, "Load score");
  }
});

router.put("/score/settings", requireAuth, async (req, res) => {
  try {
    const { enabled, partnerSharing } = req.body as { enabled?: unknown; partnerSharing?: unknown };
    if (enabled === undefined && partnerSharing === undefined) {
      res.status(400).json({ error: "validation_error", message: "Provide enabled and/or partnerSharing" });
      return;
    }
    if ((enabled !== undefined && typeof enabled !== "boolean") || (partnerSharing !== undefined && typeof partnerSharing !== "boolean")) {
      res.status(400).json({ error: "validation_error", message: "enabled and partnerSharing must be booleans" });
      return;
    }
    await updateScoreSettings(req.user!.userId, { enabled, partnerSharing });
    req.log.info({ userId: req.user!.userId, enabled, partnerSharing }, "S-PAY Score settings changed");
    res.json(await getScoreView(req.user!.userId));
  } catch (err) {
    fail(req, res, err, "Update score settings");
  }
});

router.delete("/score/history", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteScoreHistory(req.user!.userId);
    res.json({ message: deleted > 0 ? `Deleted ${deleted} monthly snapshot${deleted === 1 ? "" : "s"}.` : "There was no score history to delete." });
  } catch (err) {
    fail(req, res, err, "Delete score history");
  }
});

router.get("/score/export", requireAuth, async (req, res) => {
  try {
    const data = await exportScoreData(req.user!.userId);
    res.set("Content-Disposition", `attachment; filename="spay-score-${new Date().toISOString().slice(0, 10)}.json"`);
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    fail(req, res, err, "Export score data");
  }
});

router.post("/score/share", requireAuth, async (req, res) => {
  try {
    const { showExactScore, days } = req.body as { showExactScore?: unknown; days?: unknown };
    const validDays = [1, 7, 30];
    const d = days === undefined ? 7 : Number(days);
    if (!validDays.includes(d)) {
      res.status(400).json({ error: "validation_error", message: "days must be 1, 7 or 30" });
      return;
    }
    res.status(201).json(await createScoreShare(req.user!.userId, { showExactScore: showExactScore === true, days: d }));
  } catch (err) {
    fail(req, res, err, "Create score share");
  }
});

router.delete("/score/share", requireAuth, async (req, res) => {
  try {
    const n = await revokeScoreShares(req.user!.userId);
    res.json({ message: n > 0 ? `Revoked ${n} link${n === 1 ? "" : "s"}.` : "You had no active links." });
  } catch (err) {
    fail(req, res, err, "Revoke score shares");
  }
});

// Public: anyone holding a member-issued link sees only what the member chose
// to share (band, optionally the exact score). Unknown/expired/revoked → 404.
router.get("/score/verify/:token", async (req, res) => {
  try {
    const result = await verifyScoreShare(String(req.params.token));
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    if (!result) {
      res.status(404).json({ error: "not_found", message: "This S-PAY Score link is invalid, expired or was revoked." });
      return;
    }
    res.json(result);
  } catch (err) {
    fail(req, res, err, "Verify score share");
  }
});

router.get("/admin/score/stats", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await adminScoreStats());
  } catch (err) {
    fail(req, res, err, "Load score stats");
  }
});

export default router;
