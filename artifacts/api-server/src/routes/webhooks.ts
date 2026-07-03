import { Router } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { notifyUser } from "../lib/notify";
import { getTokenBalances } from "../lib/celo-chain";
import { approveAuthorization, declineAuthorization } from "../lib/stripe-issuing";
import { ensureUserWallet, getSendableProvider } from "../lib/wallet-providers";
import { treasuryAddress } from "../lib/settings";
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
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed in production: this endpoint flips KYC state and records
    // deposits — never process unauthenticated events. (Dev/test stays open so
    // local tooling can exercise the handler.)
    logger.warn("Noah webhook received but NOAH_WEBHOOK_SECRET is not set — rejecting");
    res.status(401).json({ error: "webhook_secret_not_configured" });
    return;
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
  } else if (process.env.NODE_ENV === "production") {
    // Same fail-closed rule as the Noah endpoint: KYC decisions are only
    // trusted when they can be verified.
    logger.warn({ provider }, "KYC webhook received but its secret is not set — rejecting");
    res.status(401).json({ error: "webhook_secret_not_configured" });
    return;
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

/**
 * Verify Stripe's signature scheme without the SDK: the `stripe-signature`
 * header carries `t=<unix>,v1=<hmac>`, where v1 = HMAC-SHA256(secret,
 * `${t}.${rawBody}`). A 5-minute tolerance defeats replay of captured events.
 */
function verifyStripeSignature(header: string | undefined, rawBody: Buffer | string | undefined, secret: string): boolean {
  if (!header || !rawBody) return false;
  const parts = new Map(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1 || !/^\d+$/.test(t)) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // >5 min old — replay
  const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface IssuingAuthorization {
  id: string;
  amount?: number;                                   // cents (0 until decided)
  pending_request?: { amount?: number };             // cents — the amount to decide on
  approved?: boolean;
  merchant_data?: { name?: string; category?: string };
  card?: { id?: string; metadata?: { spay_user_id?: string }; cardholder?: string | { id?: string } };
}

/**
 * The card spends the USER'S balance: every swipe is decided in real time
 * against their on-chain USDC/USDT. Approve → record the purchase in their
 * history and (best-effort, async) sweep the settlement amount from their
 * wallet to the treasury so the program float is repaid. A sweep that fails is
 * logged for reconciliation — the authorization decision itself never waits on
 * an on-chain transfer (Stripe's window is ~2s).
 */
async function decideCardAuthorization(auth: IssuingAuthorization): Promise<void> {
  const amountCents = auth.pending_request?.amount ?? auth.amount ?? 0;
  const amountUsd = amountCents / 100;
  const spayUserId = auth.card?.metadata?.spay_user_id;
  const cardholderId = typeof auth.card?.cardholder === "string" ? auth.card.cardholder : auth.card?.cardholder?.id;

  // Resolve the user: card metadata first (we stamp spay_user_id at issuance),
  // cardholder linkage as fallback.
  let user;
  if (spayUserId) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.id, spayUserId)).limit(1);
  }
  if (!user && cardholderId) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.stripeCardholderId, cardholderId)).limit(1);
  }
  if (!user?.celoWalletAddress) {
    logger.warn({ authId: auth.id, spayUserId, cardholderId }, "Card authorization for unknown user/wallet — declining");
    await declineAuthorization(auth.id);
    return;
  }

  const balances = await getTokenBalances(user.celoWalletAddress);
  // Fail closed: an unreadable balance never approves a spend.
  if (!balances || balances.total < amountUsd) {
    await declineAuthorization(auth.id);
    logger.info({ authId: auth.id, userId: user.id, amountUsd, available: balances?.total ?? "unknown" }, "Card authorization declined — insufficient balance");
    notifyUser(user.id, "Card payment declined", `A ${amountUsd.toFixed(2)} USD card payment was declined — your balance couldn't cover it.`, "money");
    return;
  }

  await approveAuthorization(auth.id);
  const merchant = auth.merchant_data?.name?.trim() || "Merchant";
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "payment",
    amount: String(amountUsd),
    currency: "USDC",
    description: `Card purchase — ${merchant}`,
    counterparty: merchant,
    status: "completed",
  });
  notifyUser(user.id, "Card payment 💳", `${amountUsd.toFixed(2)} USD at ${merchant} — paid from your balance.`, "money");
  logger.info({ authId: auth.id, userId: user.id, amountUsd, merchant }, "Card authorization approved");

  // Settlement sweep (async): move the spent USDC from the user's wallet to the
  // treasury, which fronts the money to Stripe. Never blocks the decision.
  void (async () => {
    const treasury = treasuryAddress();
    if (!treasury) {
      logger.warn({ authId: auth.id, userId: user.id, amountUsd }, "Card settlement sweep skipped — TREASURY_CELO_ADDRESS not set; reconcile manually");
      return;
    }
    try {
      const wallet = await ensureUserWallet(user);
      const signer = wallet ? await getSendableProvider(wallet.provider) : null;
      if (!wallet || !signer) throw new Error("wallet provider unavailable");
      const token = balances.usdc >= amountUsd ? "USDC" as const : "USDT" as const;
      const txHash = await signer.sendToken(wallet, treasury, token, amountUsd);
      logger.info({ authId: auth.id, userId: user.id, amountUsd, txHash }, "Card settlement swept to treasury");
    } catch (err) {
      logger.error({ err, authId: auth.id, userId: user.id, amountUsd }, "Card settlement sweep FAILED — reconcile: user balance still holds the spent amount");
    }
  })();
}

router.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (webhookSecret) {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (!verifyStripeSignature(sig, rawBody, webhookSecret)) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    logger.warn("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set — rejecting");
    res.status(401).json({ error: "webhook_secret_not_configured" });
    return;
  }

  const event = req.body as { type: string; data?: { object?: IssuingAuthorization } };

  try {
    switch (event.type) {
      // Real-time decision: Stripe holds the merchant while we answer.
      // Requires the webhook endpoint to be subscribed to
      // issuing_authorization.request in the Stripe dashboard.
      case "issuing_authorization.request":
        if (event.data?.object?.id) await decideCardAuthorization(event.data.object);
        break;
      case "issuing_authorization.created":
        logger.info({ authId: event.data?.object?.id, approved: event.data?.object?.approved }, "Card authorization finalized");
        break;
      case "issuing_authorization.updated":
        logger.info({ authId: event.data?.object?.id }, "Card authorization updated");
        break;
      default:
        logger.info({ type: event.type }, "Unhandled Stripe event");
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Error processing Stripe webhook");
  }

  res.json({ received: true });
});

export default router;
