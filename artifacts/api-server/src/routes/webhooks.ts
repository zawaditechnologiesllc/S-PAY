import { Router } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { notifyUser } from "../lib/notify";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function verifyHmac(signature: string, body: Buffer | string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — treat that as an invalid signature
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

// ─── Noah webhooks ─────────────────────────────────────────────────────────────
// Noah handles both KYC verification and global payouts (M-Pesa, MTN, PIX, SEPA).
// These events update user state automatically — no manual admin review needed.

router.post("/webhooks/noah", async (req, res) => {
  const sig = req.headers["x-noah-signature"] as string;
  const webhookSecret = process.env.NOAH_WEBHOOK_SECRET;

  if (webhookSecret) {
    // Once a secret is configured, unsigned requests are rejected outright.
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (!sig || !verifyHmac(sig, rawBody ?? JSON.stringify(req.body), webhookSecret)) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  const event = req.body as {
    event: string;
    customer_id?: string;
    amount?: number;
    currency?: string;
    tx_hash?: string;            // on-chain settlement hash, when the provider supplies one
  };

  logger.info({ event: event.event, customerId: event.customer_id }, "Noah webhook received");

  try {
    switch (event.event) {
      // Personal accounts: KYC · Business accounts: KYB (business + representative)
      case "customer.kyc_approved":
      case "business.kyb_approved":
      case "customer.kyb_approved":
        if (event.customer_id) {
          await db.update(usersTable)
            .set({ kycStatus: "approved", updatedAt: new Date() })
            .where(eq(usersTable.noahCustomerId, event.customer_id));
          const [approved] = await db.select({ id: usersTable.id }).from(usersTable)
            .where(eq(usersTable.noahCustomerId, event.customer_id)).limit(1);
          if (approved) notifyUser(approved.id, "Identity verified ✅", "Your account is fully unlocked: bank details, cash-outs, and higher limits are now available.", "account");
          logger.info({ customerId: event.customer_id, event: event.event }, "Verification approved — account unlocked");
        }
        break;

      case "customer.kyc_rejected":
      case "business.kyb_rejected":
      case "customer.kyb_rejected":
        if (event.customer_id) {
          await db.update(usersTable)
            .set({ kycStatus: "rejected", updatedAt: new Date() })
            .where(eq(usersTable.noahCustomerId, event.customer_id));
          logger.warn({ customerId: event.customer_id, event: event.event }, "Verification rejected — user notified on next login");
        }
        break;

      // Fiat hit the user's virtual account (USD wire/ACH or EU SEPA). The
      // provider auto-converts it to USDC and settles it on-chain to the user's
      // OWN Celo wallet — the single balance. This webhook is the provider's
      // confirmation of that settlement, so we record the matching "receive"
      // history row (with the settlement tx hash when supplied). The spendable
      // balance itself is always read live from chain, never from this row.
      case "payment.received":
      case "deposit.completed":
      case "onramp.completed":
        if (event.customer_id && typeof event.amount === "number" && event.amount > 0) {
          const [user] = await db.select().from(usersTable)
            .where(eq(usersTable.noahCustomerId, event.customer_id)).limit(1);
          if (user) {
            const token = event.currency?.toUpperCase() === "USDT" ? "USDT" : "USDC";
            await db.insert(transactionsTable).values({
              userId: user.id,
              type: "receive",
              amount: String(event.amount),
              currency: token,
              description: `Bank deposit — auto-converted to ${token}`,
              counterparty: "Virtual account deposit",
              status: "completed",
              txHash: event.tx_hash ?? null,
            });
            notifyUser(user.id, "Deposit received 🏦", `A bank deposit of ${event.amount} arrived and was settled to your wallet as ${token}.`);
            logger.info({ customerId: event.customer_id, amount: event.amount, token, txHash: event.tx_hash }, "Fiat deposit converted to USDC and settled to the user's wallet");
          }
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
