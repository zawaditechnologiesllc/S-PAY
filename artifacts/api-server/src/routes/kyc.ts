import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { selectKycProvider } from "../lib/payout-providers";
import { db, usersTable, kycVerificationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

// Identity verification entry point (task D1). Provider-agnostic: most money-rail
// partners (Noah, Bridge, Conduit, Yellow Card) run their own hosted KYC/KYB, so
// S-PAY doesn't build an identity stack — it routes the user to the admin's
// designated KYC provider's hosted flow and the result webhooks back to update
// kycStatus. Every attempt is recorded in kyc_verifications so the provider's
// customer id, hosted-flow URL and decision payload live in OUR system (audit
// trail + webhook correlation), even though the provider does the verifying.
// Honest about state: approved users are told so; everyone else gets the
// "activating soon" message until a KYC provider's keys are live.

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

    // Resume an in-flight verification with the same provider instead of
    // creating the user a second provider customer.
    const [inFlight] = await db.select().from(kycVerificationsTable)
      .where(and(
        eq(kycVerificationsTable.userId, user.id),
        eq(kycVerificationsTable.provider, provider.key),
        eq(kycVerificationsTable.status, "started"),
      ))
      .orderBy(desc(kycVerificationsTable.createdAt))
      .limit(1);
    if (inFlight?.verificationUrl) {
      res.json({ status: "started", verificationUrl: inFlight.verificationUrl, resumed: true });
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

      // Persist the attempt: provider + external customer id + hosted URL. The
      // webhook uses externalId to find this row and record the decision.
      await db.insert(kycVerificationsTable).values({
        userId: user.id,
        provider: provider.key,
        externalId: started.externalId ?? null,
        verificationUrl: started.verificationUrl,
        accountType: user.accountType,
      });
      // Keep the legacy Noah linkage in sync — the Noah webhook matches on it.
      if (provider.key === "noah" && started.externalId && !user.noahCustomerId) {
        await db.update(usersTable)
          .set({ noahCustomerId: started.externalId, updatedAt: new Date() })
          .where(eq(usersTable.id, user.id));
      }

      req.log.info({ provider: provider.key, userId: user.id }, "KYC verification started");
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

// Where the user stands: the account-level gate (kycStatus) plus the latest
// provider verification attempt, so the app can offer "Resume verification"
// with the stored hosted-flow URL instead of restarting.
router.get("/kyc/status", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    const [latest] = await db.select().from(kycVerificationsTable)
      .where(eq(kycVerificationsTable.userId, user.id))
      .orderBy(desc(kycVerificationsTable.createdAt))
      .limit(1);
    res.json({
      kycStatus: user.kycStatus,
      accountType: user.accountType,
      verification: latest ? {
        id: latest.id,
        provider: latest.provider,
        status: latest.status,
        verificationUrl: latest.status === "started" ? latest.verificationUrl : null,
        startedAt: latest.createdAt.toISOString(),
        decidedAt: latest.decidedAt?.toISOString() ?? null,
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "KYC status error");
    res.status(500).json({ error: "internal_error", message: "Could not load verification status" });
  }
});

export default router;
