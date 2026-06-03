import { Router } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function verifyHmac(signature: string, body: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ─── Noah webhooks ─────────────────────────────────────────────────────────────
// Noah handles both KYC verification and global payouts (M-Pesa, MTN, PIX, SEPA).
// These events update user state automatically — no manual admin review needed.

router.post("/webhooks/noah", async (req, res) => {
  const sig = req.headers["x-noah-signature"] as string;
  const webhookSecret = process.env.NOAH_WEBHOOK_SECRET;

  if (webhookSecret && sig) {
    const isValid = verifyHmac(sig, JSON.stringify(req.body), webhookSecret);
    if (!isValid) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  const event = req.body as {
    event: string;
    customer_id?: string;
    amount?: number;
    currency?: string;
  };

  logger.info({ event: event.event, customerId: event.customer_id }, "Noah webhook received");

  try {
    switch (event.event) {
      case "customer.kyc_approved":
        if (event.customer_id) {
          await db.update(usersTable)
            .set({ kycStatus: "approved", updatedAt: new Date() })
            .where(eq(usersTable.noahCustomerId, event.customer_id));
          logger.info({ customerId: event.customer_id }, "KYC approved — user account unlocked");
        }
        break;

      case "customer.kyc_rejected":
        if (event.customer_id) {
          await db.update(usersTable)
            .set({ kycStatus: "rejected", updatedAt: new Date() })
            .where(eq(usersTable.noahCustomerId, event.customer_id));
          logger.warn({ customerId: event.customer_id }, "KYC rejected — user notified on next login");
        }
        break;

      case "transfer.completed":
        logger.info({ customerId: event.customer_id, amount: event.amount, currency: event.currency }, "Payout completed");
        break;

      case "transfer.failed":
        logger.warn({ customerId: event.customer_id, amount: event.amount }, "Payout failed");
        break;

      default:
        logger.info({ event: event.event }, "Unhandled Noah webhook event");
    }
  } catch (err) {
    logger.error({ err, event: event.event }, "Error processing Noah webhook");
  }

  res.json({ received: true });
});

// ─── Stripe webhooks ───────────────────────────────────────────────────────────

router.post("/webhooks/stripe", (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (webhookSecret && sig) {
    logger.info({ sig: sig.substring(0, 20) }, "Stripe webhook received");
  }

  const event = req.body as { type: string; data?: { object?: { id?: string } } };

  switch (event.type) {
    case "issuing_authorization.created":
      logger.info({ authId: event.data?.object?.id }, "Card authorization — processing");
      break;
    case "issuing_authorization.updated":
      logger.info({ authId: event.data?.object?.id }, "Card authorization updated");
      break;
    default:
      logger.info({ type: event.type }, "Unhandled Stripe event");
  }

  res.json({ received: true });
});

export default router;
