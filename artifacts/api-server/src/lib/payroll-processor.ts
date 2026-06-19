import {
  db, employersTable, payrollBatchesTable, payrollPaymentsTable, transactionsTable,
  type Employer,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { resolveWorker, payrollFee, round6, type IdentifierType } from "./payroll";
import { enqueueWebhook } from "./payroll-webhooks";
import { notifyUser } from "./notify";
import { logger } from "./logger";

// ── Batch processor ─────────────────────────────────────────────────────────────
// Runs after an employer submits a batch. For each payment it:
//   1. resolves (or auto-creates) the worker,
//   2. atomically debits the employer's balance by amount+fee and credits the
//      worker's S-PAY ledger with a "receive" transaction,
//   3. notifies the worker,
//   4. records success/failure on the payment row.
// Then it rolls the batch up to completed / partially_completed / failed and
// fires the matching webhook. Idempotent per payment: a payment already in a
// terminal state is skipped, so a re-run never double-pays.
//
// The employer balance → worker ledger move is the live, auditable settlement.
// On-chain delivery to the worker's external wallet (or a Noah local-currency
// payout) is the final rail, performed by settleOnChain when configured; until
// then funds are spendable inside S-PAY and cashed out via the normal withdraw
// flow — never faked.

export async function processBatch(batchId: string): Promise<void> {
  const [batch] = await db.select().from(payrollBatchesTable)
    .where(eq(payrollBatchesTable.id, batchId)).limit(1);
  if (!batch) return;
  if (batch.status !== "processing") return; // only process a freshly-submitted batch

  const [employer] = await db.select().from(employersTable)
    .where(eq(employersTable.id, batch.employerId)).limit(1);
  if (!employer) return;

  const payments = await db.select().from(payrollPaymentsTable)
    .where(eq(payrollPaymentsTable.batchId, batchId));

  let completed = 0;
  let failed = 0;

  for (const payment of payments) {
    if (payment.status === "completed") { completed++; continue; }
    if (payment.status === "failed") { failed++; continue; }

    const amount = Number(payment.amount);
    const fee = payrollFee(amount);
    try {
      const result = await payOne(employer, {
        paymentId: payment.id,
        identifier: payment.workerIdentifier,
        identifierType: payment.identifierType as IdentifierType,
        amount,
        fee,
        currency: payment.currency,
        reason: payment.reason ?? undefined,
        employerName: employer.companyName,
      });
      if (result.ok) {
        completed++;
        void enqueueWebhook(employer, "payment.completed", {
          batchId, paymentId: payment.id, workerIdentifier: payment.workerIdentifier,
          amount, currency: payment.currency, resolvedUserId: result.userId,
        }, { batchId });
      } else {
        failed++;
        void enqueueWebhook(employer, "payment.failed", {
          batchId, paymentId: payment.id, workerIdentifier: payment.workerIdentifier,
          amount, currency: payment.currency, reason: result.error,
        }, { batchId });
      }
    } catch (err) {
      failed++;
      logger.error({ err, paymentId: payment.id }, "Payroll payment errored");
      await db.update(payrollPaymentsTable).set({
        status: "failed", errorMessage: "internal error",
      }).where(eq(payrollPaymentsTable.id, payment.id)).catch(() => {});
    }
  }

  const status: "completed" | "failed" | "partially_completed" =
    failed === 0 ? "completed" : completed === 0 ? "failed" : "partially_completed";

  await db.update(payrollBatchesTable).set({
    status, completedCount: completed, failedCount: failed,
    completedAt: new Date(), updatedAt: new Date(),
  }).where(eq(payrollBatchesTable.id, batchId));

  const event = status === "completed" ? "batch.completed"
    : status === "failed" ? "batch.failed" : "batch.partially_completed";
  void enqueueWebhook(employer, event, {
    batchId, reference: batch.reference, status,
    paymentCount: payments.length, completedCount: completed, failedCount: failed,
  }, { batchId, urlOverride: batch.webhookUrl ?? undefined });
}

interface PayInput {
  paymentId: string;
  identifier: string;
  identifierType: IdentifierType;
  amount: number;
  fee: number;
  currency: string;
  reason?: string;
  employerName: string;
}

interface PayResult { ok: boolean; userId?: string; error?: string }

/**
 * Resolve one worker and, if successful, atomically debit the employer and
 * credit the worker inside a single DB transaction. The debit uses a guarded
 * UPDATE (balance_usdc >= cost) so two concurrent batches can never overdraw.
 */
async function payOne(employer: Employer, input: PayInput): Promise<PayResult> {
  const resolution = await resolveWorker(input.identifier, input.identifierType, employer);
  if (!resolution.user) {
    await db.update(payrollPaymentsTable).set({
      status: "failed", errorMessage: resolution.error ?? "Worker could not be resolved",
    }).where(eq(payrollPaymentsTable.id, input.paymentId));
    return { ok: false, error: resolution.error ?? "Worker could not be resolved" };
  }

  const worker = resolution.user;
  await db.update(payrollPaymentsTable).set({
    status: "resolved", resolvedUserId: worker.id, workerCreated: resolution.created,
    resolvedAt: new Date(),
  }).where(eq(payrollPaymentsTable.id, input.paymentId));

  const cost = round6(input.amount + input.fee);

  const settled = await db.transaction(async (tx) => {
    // Guarded debit: only succeeds if the employer still has the funds.
    const debited = await tx.update(employersTable)
      .set({ balanceUsdc: sql`${employersTable.balanceUsdc} - ${cost}`, updatedAt: new Date() })
      .where(sql`${employersTable.id} = ${employer.id} AND ${employersTable.balanceUsdc} >= ${cost}`)
      .returning({ id: employersTable.id });
    if (debited.length === 0) return null; // insufficient balance

    const [credit] = await tx.insert(transactionsTable).values({
      userId: worker.id,
      type: "receive",
      amount: String(input.amount),
      currency: input.currency,
      description: input.reason
        ? `Payroll from ${input.employerName} — ${input.reason}`
        : `Payroll from ${input.employerName}`,
      counterparty: input.employerName,
      status: "completed",
    }).returning();

    await tx.update(payrollPaymentsTable).set({
      status: "completed", transactionId: credit.id, paidAt: new Date(), errorMessage: null,
    }).where(eq(payrollPaymentsTable.id, input.paymentId));

    return credit.id;
  });

  if (!settled) {
    await db.update(payrollPaymentsTable).set({
      status: "failed", errorMessage: "Employer balance insufficient at settlement time",
    }).where(eq(payrollPaymentsTable.id, input.paymentId));
    return { ok: false, error: "Employer balance insufficient" };
  }

  notifyUser(
    worker.id,
    "You got paid 💸",
    input.reason
      ? `${input.employerName} paid you ${input.amount} ${input.currency} (${input.reason}). It's in your S-PAY balance.`
      : `${input.employerName} paid you ${input.amount} ${input.currency}. It's in your S-PAY balance.`,
    "money",
  );
  return { ok: true, userId: worker.id };
}
