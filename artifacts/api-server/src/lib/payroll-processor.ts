import {
  db, employersTable, payrollBatchesTable, payrollPaymentsTable, transactionsTable, usersTable,
  type Employer,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { resolveWorker, payrollFee, round6, type IdentifierType } from "./payroll";
import { enqueueWebhook } from "./payroll-webhooks";
import { notifyUser } from "./notify";
import { logger } from "./logger";
import { ensureUserWallet, getSendableProvider, type UserWallet, type WalletProvider } from "./wallet-providers";
import { treasuryAddress } from "./settings";
import type { CeloToken } from "./celo-chain";

// ── Batch processor ─────────────────────────────────────────────────────────────
// Runs after an employer submits a batch. For each payment it:
//   1. resolves (or auto-creates) the worker,
//   2. reserves the cost against the employer's prepaid ledger (guarded debit),
//   3. SETTLES ON-CHAIN: sends real USDC from the employer's funding wallet to
//      the worker's Celo wallet, and best-effort sweeps the S-PAY fee to the
//      treasury,
//   4. records a "receive" transaction with the on-chain tx hash and notifies
//      the worker.
// Then it rolls the batch up to completed / partially_completed / failed and
// fires the matching webhook. Idempotent per payment: a payment already in a
// terminal state is skipped, so a re-run never double-pays.
//
// The single balance: a worker's spendable balance is the USDC in their own
// Celo wallet — read live from chain. Payroll therefore only counts as paid
// once the on-chain transfer has a tx hash. If the on-chain rail isn't
// available (no wallet provider configured, or the send fails), the payment is
// marked FAILED with an honest reason and the employer is NOT charged — we
// never write a "received" row the balance can't back.
//
// Sandbox batches never touch the chain: they credit a clearly-labelled TEST
// transaction so integrators can exercise the API without real money.

interface SettlementContext {
  fundingWallet: UserWallet; // the employer's funding wallet (owner's Celo wallet)
  signer: WalletProvider;    // the provider allowed to sign sends from it
}

/**
 * Resolve the on-chain settlement rail for a LIVE batch: the employer's funding
 * wallet (the owner's Celo wallet, which holds the prepaid USDC) plus the
 * provider permitted to sign sends from it. Returns null when no wallet provider
 * is configured/enabled — the caller then fails the batch honestly rather than
 * faking settlement.
 */
async function resolveSettlement(employer: Employer): Promise<SettlementContext | null> {
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, employer.ownerUserId)).limit(1);
  if (!owner) return null;
  const fundingWallet = await ensureUserWallet(owner);
  if (!fundingWallet) return null;
  const signer = await getSendableProvider(fundingWallet.provider);
  if (!signer) return null;
  return { fundingWallet, signer };
}

// One runner per batch: prevents a re-submitted (resumed) batch from being
// processed concurrently with a still-running background run, which could
// double-pay a payment that is mid-settlement. In-memory is sufficient for the
// single-instance deployment; a multi-instance deployment would move this to a
// DB advisory lock.
const activeBatches = new Set<string>();

export async function processBatch(batchId: string): Promise<void> {
  if (activeBatches.has(batchId)) return;
  activeBatches.add(batchId);
  try {
    await processBatchInner(batchId);
  } finally {
    activeBatches.delete(batchId);
  }
}

async function processBatchInner(batchId: string): Promise<void> {
  const [batch] = await db.select().from(payrollBatchesTable)
    .where(eq(payrollBatchesTable.id, batchId)).limit(1);
  if (!batch) return;
  if (batch.status !== "processing") return; // only process a freshly-submitted batch

  const [employer] = await db.select().from(employersTable)
    .where(eq(employersTable.id, batch.employerId)).limit(1);
  if (!employer) return;

  // Resolve the on-chain settlement rail once for the whole live batch.
  const settlement = batch.sandbox ? null : await resolveSettlement(employer);
  if (!batch.sandbox && !settlement) {
    logger.warn({ batchId, employerId: employer.id }, "Live payroll batch cannot settle on-chain — no wallet provider configured");
  }

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
      const result = await payOne(employer, batch.sandbox, settlement, {
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
          amount, currency: payment.currency, resolvedUserId: result.userId, txHash: result.txHash,
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

interface PayResult { ok: boolean; userId?: string; txHash?: string; error?: string }

function tokenOf(currency: string): CeloToken {
  return currency?.toUpperCase() === "USDT" ? "USDT" : "USDC";
}

async function failPayment(paymentId: string, message: string): Promise<PayResult> {
  await db.update(payrollPaymentsTable).set({ status: "failed", errorMessage: message })
    .where(eq(payrollPaymentsTable.id, paymentId));
  return { ok: false, error: message };
}

/**
 * Resolve one worker and pay them. LIVE payments move real USDC on-chain from
 * the employer's funding wallet to the worker's Celo wallet (the saga:
 * reserve → settle → record, with compensation on failure). Sandbox payments
 * credit a clearly-labelled TEST ledger row and never touch the chain.
 */
async function payOne(
  employer: Employer,
  sandbox: boolean,
  settlement: SettlementContext | null,
  input: PayInput,
): Promise<PayResult> {
  const resolution = await resolveWorker(input.identifier, input.identifierType, employer);
  if (!resolution.user) {
    return failPayment(input.paymentId, resolution.error ?? "Worker could not be resolved");
  }

  const worker = resolution.user;
  await db.update(payrollPaymentsTable).set({
    status: "resolved", resolvedUserId: worker.id, workerCreated: resolution.created,
    resolvedAt: new Date(),
  }).where(eq(payrollPaymentsTable.id, input.paymentId));

  return sandbox
    ? settleSandbox(employer, worker, input)
    : settleLive(employer, worker, settlement, input);
}

/** Sandbox: ledger-only TEST credit, no chain movement, no real-money wording. */
async function settleSandbox(employer: Employer, worker: { id: string }, input: PayInput): Promise<PayResult> {
  const cost = round6(input.amount + input.fee);
  const settled = await db.transaction(async (tx) => {
    const debited = await tx.update(employersTable)
      .set({ balanceUsdc: sql`${employersTable.balanceUsdc} - ${cost}`, updatedAt: new Date() })
      .where(sql`${employersTable.id} = ${employer.id} AND ${employersTable.balanceUsdc} >= ${cost}`)
      .returning({ id: employersTable.id });
    if (debited.length === 0) return null;

    const [credit] = await tx.insert(transactionsTable).values({
      userId: worker.id,
      type: "receive",
      amount: String(input.amount),
      currency: input.currency,
      description: `[TEST] Sandbox payroll from ${input.employerName}${input.reason ? ` — ${input.reason}` : ""}`,
      counterparty: input.employerName,
      status: "completed",
    }).returning();

    await tx.update(payrollPaymentsTable).set({
      status: "completed", transactionId: credit.id, paidAt: new Date(), errorMessage: null,
    }).where(eq(payrollPaymentsTable.id, input.paymentId));
    return credit.id;
  });

  if (!settled) {
    return failPayment(input.paymentId, "Sandbox balance insufficient at settlement time");
  }
  return { ok: true, userId: worker.id };
}

/**
 * Live: reserve the cost on the employer ledger, send real USDC on-chain to the
 * worker, then record the receive with the tx hash. On a send failure the
 * reservation is refunded and the payment fails honestly — the worker is never
 * shown money the chain can't back.
 */
async function settleLive(
  employer: Employer,
  worker: Parameters<typeof ensureUserWallet>[0] & { id: string },
  settlement: SettlementContext | null,
  input: PayInput,
): Promise<PayResult> {
  if (!settlement) {
    return failPayment(input.paymentId, "On-chain settlement unavailable — no wallet provider is configured. Set a wallet provider in /admin/settings.");
  }

  // The worker needs a Celo wallet to receive USDC on-chain.
  const workerWallet = await ensureUserWallet(worker);
  if (!workerWallet) {
    return failPayment(input.paymentId, "Worker wallet could not be provisioned — payout rail unavailable.");
  }

  const token = tokenOf(input.currency);
  const cost = round6(input.amount + input.fee);

  // 1) Reserve: guarded debit of the employer's prepaid ledger.
  const reserved = await db.update(employersTable)
    .set({ balanceUsdc: sql`${employersTable.balanceUsdc} - ${cost}`, updatedAt: new Date() })
    .where(sql`${employersTable.id} = ${employer.id} AND ${employersTable.balanceUsdc} >= ${cost}`)
    .returning({ id: employersTable.id });
  if (reserved.length === 0) {
    return failPayment(input.paymentId, "Employer balance insufficient at settlement time");
  }

  // 2) Settle on-chain: move the worker's amount from the funding wallet.
  let txHash: string;
  try {
    txHash = await settlement.signer.sendToken(settlement.fundingWallet, workerWallet.address, token, input.amount);
  } catch (err) {
    // Compensate: nothing reached the worker — return the full reservation.
    await db.update(employersTable)
      .set({ balanceUsdc: sql`${employersTable.balanceUsdc} + ${cost}`, updatedAt: new Date() })
      .where(eq(employersTable.id, employer.id));
    logger.error({ err, paymentId: input.paymentId, employerId: employer.id }, "On-chain payroll settlement failed — reservation refunded");
    return failPayment(input.paymentId, "On-chain settlement failed — the amount was returned to your payroll balance. Please retry.");
  }

  // 3) Record the worker's receive with the real on-chain hash.
  const [credit] = await db.insert(transactionsTable).values({
    userId: worker.id,
    type: "receive",
    amount: String(input.amount),
    currency: token,
    description: input.reason
      ? `Payroll from ${input.employerName} — ${input.reason}`
      : `Payroll from ${input.employerName}`,
    counterparty: input.employerName,
    status: "completed",
    txHash,
  }).returning();

  await db.update(payrollPaymentsTable).set({
    status: "completed", transactionId: credit.id, paidAt: new Date(), errorMessage: null,
  }).where(eq(payrollPaymentsTable.id, input.paymentId));

  // 4) Collect the S-PAY fee on-chain to the treasury. Best-effort: the worker
  // is already paid, so a sweep failure is logged for reconciliation rather than
  // failing (and confusing) the payment. Without a treasury address the fee
  // stays in the funding wallet for later reconciliation.
  const treasury = treasuryAddress();
  if (input.fee > 0 && treasury) {
    try {
      await settlement.signer.sendToken(settlement.fundingWallet, treasury, token, input.fee);
    } catch (sweepErr) {
      logger.warn({ sweepErr, paymentId: input.paymentId, fee: input.fee, token }, "Payroll fee sweep to treasury failed — reconcile later");
    }
  }

  notifyUser(
    worker.id,
    "You got paid 💸",
    input.reason
      ? `${input.employerName} paid you ${input.amount} ${token} (${input.reason}). It's in your wallet.`
      : `${input.employerName} paid you ${input.amount} ${token}. It's in your wallet.`,
    "money",
  );
  return { ok: true, userId: worker.id, txHash };
}
