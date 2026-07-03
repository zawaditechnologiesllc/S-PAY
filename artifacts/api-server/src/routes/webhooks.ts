import { Router } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { notifyUser } from "../lib/notify";
import { db, usersTable, transactionsTable, kycVerificationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

/**
 * Record a provider KYC/KYB decision on S-PAY's own verification trail. Matches
 * the attempt row by the provider's customer id (written at /kyc/start) and
 * stores the raw webhook payload for audit — the data stays in our system even
 * though the provider ran the check.
 */
async function recordKycDecision(
  provider: string,
  externalId: string,
  decision: "approved" | "rejected",
  payload: unknown,
): Promise<void> {
  await db.update(kycVerificationsTable)
    .set({ status: decision, payload: payload as object, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(kycVerificationsTable.provider, provider),
      eq(kycVerificationsTable.externalId, externalId),
      eq(kycVerificationsTable.status, "started"),
    ));
}

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
          await recordKycDecision("noah", event.customer_id, "approved", req.body);
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
          await recordKycDecision("noah", event.customer_id, "rejected", req.body);
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

// ─── Generic money-rail KYC webhooks (Bridge, Conduit, Yellow Card) ────────────
// One landing place for every non-Noah provider's KYC/KYB decision. Each provider
// is verified with its own secret (<PROVIDER>_WEBHOOK_SECRET); the event updates
// S-PAY's own kyc_verifications trail (matched by the provider customer id
// recorded at /kyc/start) and flips users.kycStatus — same contract as Noah.
const KYC_WEBHOOK_PROVIDERS: Record<string, { secretEnv: string; sigHeader: string }> = {
  bridge: { secretEnv: "BRIDGE_WEBHOOK_SECRET", sigHeader: "x-webhook-signature" },
  conduit: { secretEnv: "CONDUIT_WEBHOOK_SECRET", sigHeader: "x-webhook-signature" },
  yellowcard: { secretEnv: "YELLOWCARD_WEBHOOK_SECRET", sigHeader: "x-webhook-signature" },
};

router.post("/webhooks/kyc/:provider", async (req, res) => {
  const provider = String(req.params.provider);
  const conf = KYC_WEBHOOK_PROVIDERS[provider];
  if (!conf) {
    res.status(404).json({ error: "unknown_provider" });
    return;
  }

  const secret = process.env[conf.secretEnv];
  if (secret) {
    const sig = req.headers[conf.sigHeader] as string | undefined;
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (!sig || !verifyHmac(sig, rawBody ?? JSON.stringify(req.body), secret)) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  }

  const event = req.body as { event?: string; status?: string; customer_id?: string; external_id?: string };
  const externalId = event.customer_id ?? event.external_id;
  const raw = `${event.event ?? ""} ${event.status ?? ""}`.toLowerCase();
  const decision: "approved" | "rejected" | null =
    /approved|verified|active/.test(raw) ? "approved" : /rejected|failed|declined/.test(raw) ? "rejected" : null;

  logger.info({ provider, event: event.event ?? event.status, externalId }, "KYC webhook received");

  try {
    if (externalId && decision) {
      // Trail first (it stores the payload), then flip the user gate via the
      // verification row's userId — this provider linkage lives only in the trail.
      const [attempt] = await db.select().from(kycVerificationsTable)
        .where(and(eq(kycVerificationsTable.provider, provider), eq(kycVerificationsTable.externalId, externalId)))
        .orderBy(desc(kycVerificationsTable.createdAt))
        .limit(1);
      await recordKycDecision(provider, externalId, decision, req.body);
      if (attempt) {
        await db.update(usersTable)
          .set({ kycStatus: decision, updatedAt: new Date() })
          .where(eq(usersTable.id, attempt.userId));
        if (decision === "approved") {
          notifyUser(attempt.userId, "Identity verified ✅", "Your account is fully unlocked: bank details, cash-outs, and higher limits are now available.", "account");
        }
        logger.info({ provider, userId: attempt.userId, decision }, "Verification decision recorded");
      } else {
        logger.warn({ provider, externalId }, "KYC webhook has no matching verification attempt");
      }
    }
  } catch (err) {
    logger.error({ err, provider }, "Error processing KYC webhook");
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
