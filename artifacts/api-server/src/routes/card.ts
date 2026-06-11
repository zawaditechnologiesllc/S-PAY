import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { isCardProgramEnabled } from "../lib/settings";
import { isStripeConfigured, issueVirtualCard, fetchCardSummary } from "../lib/stripe-issuing";
import { db, usersTable, cardWaitlistTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Card lifecycle:
//   program OFF  → cardStatus "coming_soon"  (waitlist UI)
//   program ON, no card  → "not_issued"      (one-tap create)
//   program ON, issued   → "active"/"locked" (live Stripe summary)
// The admin switch lives in /admin/feature-flags; issuance needs STRIPE_SECRET_KEY.

router.get("/card/details", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const enabled = await isCardProgramEnabled();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [waitlistRow] = await db.select({ id: cardWaitlistTable.id }).from(cardWaitlistTable)
      .where(eq(cardWaitlistTable.userId, userId)).limit(1);

    const base = {
      totalBalance: 0,
      currency: "USD",
      cardholderName: user?.fullName ?? "",
      onWaitlist: Boolean(waitlistRow),
    };

    if (!enabled) {
      res.json({ ...base, hasCard: false, isComingSoon: true, cards: [], cardStatus: "coming_soon" });
      return;
    }

    if (user?.stripeCardId && isStripeConfigured()) {
      const summary = await fetchCardSummary(user.stripeCardId);
      if (summary) {
        res.json({
          ...base,
          hasCard: true,
          isComingSoon: false,
          cardStatus: summary.status,
          cards: [{
            id: summary.cardId,
            last4: summary.last4,
            network: summary.brand,
            expiryMonth: summary.expMonth,
            expiryYear: summary.expYear,
            isPrimary: true,
            status: summary.status,
            cardType: "virtual",
            label: "S-PAY Virtual Card",
          }],
        });
        return;
      }
    }

    res.json({ ...base, hasCard: false, isComingSoon: false, cards: [], cardStatus: "not_issued" });
  } catch (err) {
    req.log.error({ err }, "Card details error");
    res.status(500).json({ error: "internal_error", message: "Failed to load card details" });
  }
});

router.post("/card/issue", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    if (!(await isCardProgramEnabled())) {
      res.status(403).json({ error: "feature_disabled", message: "The card program has not been switched on yet. Join the waitlist to be notified." });
      return;
    }
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "not_configured", message: "Card issuing is not live yet — Stripe integration pending. You're on the list!" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    if (user.kycStatus !== "approved") {
      res.status(403).json({ error: "kyc_required", message: "Complete identity verification (KYC) before creating your card." });
      return;
    }

    if (!user.stripeCardId) {
      const issued = await issueVirtualCard(user);
      await db.update(usersTable)
        .set({ stripeCardholderId: issued.cardholderId, stripeCardId: issued.cardId, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    }

    // Return the same shape as GET /card/details so clients can swap state directly
    const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const summary = fresh?.stripeCardId ? await fetchCardSummary(fresh.stripeCardId) : null;
    res.json({
      hasCard: Boolean(summary),
      isComingSoon: false,
      cardStatus: summary?.status ?? "not_issued",
      totalBalance: 0,
      currency: "USD",
      cardholderName: fresh?.fullName ?? "",
      onWaitlist: false,
      cards: summary ? [{
        id: summary.cardId,
        last4: summary.last4,
        network: summary.brand,
        expiryMonth: summary.expMonth,
        expiryYear: summary.expYear,
        isPrimary: true,
        status: summary.status,
        cardType: "virtual",
        label: "S-PAY Virtual Card",
      }] : [],
    });
  } catch (err) {
    req.log.error({ err }, "Card issue error");
    res.status(500).json({ error: "issue_failed", message: "Could not create your card. Please try again or contact support." });
  }
});

router.get("/card/transactions", requireAuth, (req, res) => {
  // Real card transactions arrive via Stripe Issuing webhooks once the
  // program is live — until then every user has a clean, honest history.
  res.json({ transactions: [], total: 0 });
});

router.get("/card/spending-summary", requireAuth, (req, res) => {
  res.json({ totalSpent: 0, currency: "USD", period: "this_month", categories: [] });
});

router.post("/card/waitlist", requireAuth, async (req, res) => {
  try {
    const { userId, email } = req.user!;
    await db.insert(cardWaitlistTable)
      .values({ userId, email })
      .onConflictDoNothing({ target: cardWaitlistTable.userId });
    res.json({ message: "You are on the list. We will notify you when the S-PAY virtual card launches." });
  } catch (err) {
    req.log.error({ err }, "Card waitlist error");
    res.status(500).json({ error: "internal_error", message: "Could not join the waitlist. Please try again." });
  }
});

export default router;
