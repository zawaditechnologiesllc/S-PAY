import { createHmac } from "node:crypto";
import { db, payrollWebhookDeliveriesTable, type Employer } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ── Employer webhooks ───────────────────────────────────────────────────────────
// When a batch finishes (or a payment fails, or a test is requested) we POST a
// signed JSON event to the employer's webhook URL. The signature lets the
// employer verify the call really came from S-PAY:
//
//   X-SPay-Signature: t=<unix>,v1=<hex hmac_sha256(secret, `${t}.${body}`)>
//
// Every attempt is recorded in payroll_webhook_deliveries for auditing, and a
// failed delivery is retried a few times with exponential backoff.

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000;

export type WebhookEvent =
  | "batch.processing"
  | "batch.completed"
  | "batch.partially_completed"
  | "batch.failed"
  | "payment.completed"
  | "payment.failed"
  | "webhook.test";

export function signPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function signatureHeader(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${signPayload(secret, timestamp, body)}`;
}

/**
 * Queue a webhook delivery. Records an audit row immediately and attempts
 * delivery in the background (fire-and-forget with retries) so it never blocks
 * the API response or a money flow. Returns the delivery row id.
 */
export async function enqueueWebhook(
  employer: Employer,
  event: WebhookEvent,
  data: Record<string, unknown>,
  opts: { batchId?: string; urlOverride?: string } = {},
): Promise<string | null> {
  const url = opts.urlOverride ?? employer.webhookUrl;
  if (!url) return null; // employer hasn't configured a webhook — nothing to do

  const payload = {
    event,
    employerId: employer.id,
    createdAt: new Date().toISOString(),
    data,
  };

  const [row] = await db.insert(payrollWebhookDeliveriesTable).values({
    employerId: employer.id,
    eventType: event,
    url,
    batchId: opts.batchId ?? null,
    payload,
    status: "pending",
  }).returning();

  void attemptDelivery(row.id, url, payload, employer.webhookSecret ?? "");
  return row.id;
}

async function attemptDelivery(
  deliveryId: string,
  url: string,
  payload: Record<string, unknown>,
  secret: string,
): Promise<void> {
  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "S-PAY-Payroll-Webhooks/1.0",
          "x-spay-event": String(payload.event ?? ""),
          ...(secret ? { "x-spay-signature": signatureHeader(secret, body) } : {}),
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.ok) {
        await db.update(payrollWebhookDeliveriesTable).set({
          status: "delivered",
          responseStatus: res.status,
          attempts: attempt,
          deliveredAt: new Date(),
        }).where(eq(payrollWebhookDeliveriesTable.id, deliveryId));
        return;
      }

      await db.update(payrollWebhookDeliveriesTable).set({
        responseStatus: res.status,
        attempts: attempt,
        lastError: `HTTP ${res.status}`,
        status: attempt >= MAX_ATTEMPTS ? "failed" : "pending",
      }).where(eq(payrollWebhookDeliveriesTable.id, deliveryId));
    } catch (err) {
      await db.update(payrollWebhookDeliveriesTable).set({
        attempts: attempt,
        lastError: err instanceof Error ? err.message : "delivery error",
        status: attempt >= MAX_ATTEMPTS ? "failed" : "pending",
      }).where(eq(payrollWebhookDeliveriesTable.id, deliveryId)).catch(() => {});
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1)); // 2s, 4s, 8s, 16s
    }
  }
  logger.warn({ deliveryId, url }, "Payroll webhook delivery exhausted retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
