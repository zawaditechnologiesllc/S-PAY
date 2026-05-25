import { Router } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router = Router();

function verifyHmac(signature: string, body: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

router.post("/webhooks/noah", (req, res) => {
  const sig = req.headers["x-noah-signature"] as string;
  const webhookSecret = process.env.NOAH_WEBHOOK_SECRET;

  if (webhookSecret && sig) {
    const isValid = verifyHmac(sig, JSON.stringify(req.body), webhookSecret);
    if (!isValid) {
      res.status(401).json({ error: "invalid_signature", message: "Invalid webhook signature" });
      return;
    }
  }

  const event = req.body;
  logger.info({ event: event.event, customerId: event.customer_id }, "Noah webhook received");

  switch (event.event) {
    case "customer.kyc_approved":
      logger.info({ customerId: event.customer_id }, "KYC approved — issuing virtual account");
      break;
    case "transfer.completed":
      logger.info({ userId: event.user_id, amount: event.amount }, "Transfer completed — notifying user");
      break;
    case "customer.kyc_rejected":
      logger.info({ customerId: event.customer_id }, "KYC rejected");
      break;
    default:
      logger.info({ event: event.event }, "Unknown Noah webhook event");
  }

  res.json({ received: true });
});

router.post("/webhooks/stripe", (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (webhookSecret && sig) {
    logger.info({ sig: sig.substring(0, 20) }, "Stripe webhook received with signature");
  }

  const event = req.body;
  logger.info({ type: event.type }, "Stripe webhook received");

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
