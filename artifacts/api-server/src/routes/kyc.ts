import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { selectKycProvider } from "../lib/payout-providers";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Identity verification entry point (task D1). Provider-agnostic: most money-rail
// partners (Noah, Bridge, Conduit, Yellow Card) run their own hosted KYC/KYB, so
// S-PAY doesn't build an identity stack — it routes the user to the admin's
// designated KYC provider's hosted flow and the result webhooks back to update
// kycStatus. Honest about state: approved users are told so; everyone else gets
// the "activating soon" message until a KYC provider's keys are live.

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

    const provider = await selectKycProvider();
    if (!provider) {
      res.status(503).json({
        error: "not_configured",
        message: "Identity verification is activating soon. You'll be able to verify with a government ID and selfie — it unlocks your US bank account, EU IBAN, and cash-outs.",
      });
      return;
    }

    // Provider with no keys throws KycNotConfiguredError → honest 503. With keys,
    // startKyc creates the customer + returns the hosted verification URL; the
    // approval flows back via that provider's webhook to set kycStatus.
    try {
      const started = await provider.startKyc({
        userId: user.id,
        accountType: user.accountType,
        fullName: user.fullName,
        email: user.email,
        businessName: user.businessName ?? undefined,
        country: user.country ?? undefined,
      });
      res.json({ status: "started", verificationUrl: started.verificationUrl });
    } catch {
      req.log.info({ provider: provider.key }, "KYC requested — provider not configured");
      res.status(503).json({
        error: "not_configured",
        message: "Identity verification is being finalized with our verification partner. Check back shortly.",
      });
    }
  } catch (err) {
    req.log.error({ err }, "KYC start error");
    res.status(500).json({ error: "internal_error", message: "Could not start verification" });
  }
});

export default router;
