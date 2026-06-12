import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Identity verification entry point (task D1). The button works today and is
// honest about state: approved users are told so, everyone else gets the
// "activating soon" message until NOAH_API_KEY is live — then this handler
// grows the Noah customer creation + hosted verification URL.

router.post("/kyc/start", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    if (user.kycStatus === "approved") {
      res.json({ status: "approved", message: "Your identity is already verified — all features are unlocked." });
      return;
    }
    if (!process.env.NOAH_API_KEY) {
      res.status(503).json({
        error: "not_configured",
        message: "Identity verification is activating soon. You'll be able to verify with a government ID and selfie — it unlocks your US bank account, EU IBAN, and cash-outs.",
      });
      return;
    }
    // TODO (D1): create the Noah customer (individual vs business per
    // user.accountType, include businessName), save noahCustomerId, and return
    // Noah's hosted verification URL. Approval flows back via /webhooks/noah.
    res.status(503).json({
      error: "not_configured",
      message: "Identity verification is being finalized with our verification partner. Check back shortly.",
    });
  } catch (err) {
    req.log.error({ err }, "KYC start error");
    res.status(500).json({ error: "internal_error", message: "Could not start verification" });
  }
});

export default router;
