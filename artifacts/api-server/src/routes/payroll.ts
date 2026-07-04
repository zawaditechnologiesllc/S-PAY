import { Router } from "express";
import { randomBytes } from "node:crypto";
import { requireAuth } from "../middlewares/auth";
import { requireEmployer, generateApiKey } from "../lib/employer-auth";
import {
  resolveWorker, payrollFee, getPayrollFeeConfig, round6, inferIdentifierType, validateIdentifier,
  type IdentifierType,
} from "../lib/payroll";
import { processBatch } from "../lib/payroll-processor";
import { enqueueWebhook } from "../lib/payroll-webhooks";
import { ensureUserWallet } from "../lib/wallet-providers";
import { payoutProviderCatalog, quotesForCorridor } from "../lib/payout-providers";
import {
  db, employersTable, employerApiKeysTable, payrollBatchesTable, payrollPaymentsTable,
  payrollWebhookDeliveriesTable, usersTable, type Employer,
} from "@workspace/db";
import { and, eq, desc, count, sql } from "drizzle-orm";

const router = Router();

const VALID_TYPES: IdentifierType[] = ["email", "phone", "spay_id", "celo_address"];
const MAX_PAYMENTS_PER_BATCH = 10_000;
// Batches up to this size settle inline so the submit response carries the
// final result. Larger ones (AI-workforce scale: thousands of annotators in
// one run) are accepted with 202 and settle in the background — the batch is
// polled via GET /payroll/batches/:id or observed through the signed webhooks.
const SYNC_PROCESS_LIMIT = 25;

// Public, non-secret view of an employer.
function publicEmployer(e: Employer) {
  return {
    id: e.id,
    companyName: e.companyName,
    email: e.email,
    websiteUrl: e.websiteUrl,
    country: e.country,
    status: e.status,
    balanceUsdc: Number(e.balanceUsdc),
    fundingAddress: e.fundingAddress,
    webhookUrl: e.webhookUrl,
    autoCreateWorkers: e.autoCreateWorkers,
    createdAt: e.createdAt.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Employer onboarding & key management — authenticated as the owning S-PAY user
// (JWT). A marketplace registers once, then mints API keys its backend uses.
// ═══════════════════════════════════════════════════════════════════════════════

// Register the signed-in user's company as a payroll employer (one per user).
router.post("/payroll/employers/register", requireAuth, async (req, res) => {
  try {
    const { companyName, email, websiteUrl, country, autoCreateWorkers, webhookUrl } = req.body as {
      companyName?: string; email?: string; websiteUrl?: string; country?: string;
      autoCreateWorkers?: boolean; webhookUrl?: string;
    };
    if (!companyName?.trim()) {
      res.status(400).json({ error: "validation_error", message: "companyName is required" });
      return;
    }
    const ownerId = req.user!.userId;

    // Payroll is a business-only feature: paying workers is a company function,
    // and live mode requires KYB on a business entity. Personal accounts are
    // pointed at the business-account upgrade instead of silently registered.
    const [owner] = await db.select({ accountType: usersTable.accountType })
      .from(usersTable).where(eq(usersTable.id, ownerId)).limit(1);
    if (owner?.accountType !== "business") {
      res.status(403).json({
        error: "business_account_required",
        message: "Payroll is available on business accounts only. Upgrade to a business account to pay your team.",
      });
      return;
    }

    const [existing] = await db.select().from(employersTable)
      .where(eq(employersTable.ownerUserId, ownerId)).limit(1);
    if (existing) {
      res.status(409).json({ error: "already_registered", message: "You already have an employer account.", employer: publicEmployer(existing) });
      return;
    }

    const [employer] = await db.insert(employersTable).values({
      ownerUserId: ownerId,
      companyName: companyName.trim(),
      email: (email ?? req.user!.email).trim().toLowerCase(),
      websiteUrl: websiteUrl?.trim() || null,
      country: country?.trim() || null,
      webhookUrl: webhookUrl?.trim() || null,
      webhookSecret: `whsec_${randomBytes(24).toString("base64url")}`,
      autoCreateWorkers: autoCreateWorkers !== false,
    }).returning();

    res.status(201).json({
      employer: publicEmployer(employer),
      webhookSecret: employer.webhookSecret, // shown once so they can verify callbacks
      message: "Employer registered. Generate an API key to start sending payroll. Business verification (KYB) unlocks live mode.",
    });
  } catch (err) {
    req.log.error({ err }, "Employer register error");
    res.status(500).json({ error: "internal_error", message: "Could not register employer" });
  }
});

// Owner-scoped employer lookup helper (by JWT user).
async function employerForOwner(userId: string): Promise<Employer | null> {
  const [e] = await db.select().from(employersTable).where(eq(employersTable.ownerUserId, userId)).limit(1);
  return e ?? null;
}

// Owner view of their own employer (dashboard).
router.get("/payroll/employers/me", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) {
    res.status(404).json({ error: "not_found", message: "No employer account. Register one first." });
    return;
  }
  res.json({ employer: publicEmployer(employer) });
});

router.patch("/payroll/employers/me", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) {
    res.status(404).json({ error: "not_found", message: "No employer account." });
    return;
  }
  const { companyName, email, websiteUrl, country, webhookUrl, autoCreateWorkers } = req.body as Record<string, unknown>;
  const [updated] = await db.update(employersTable).set({
    companyName: typeof companyName === "string" && companyName.trim() ? companyName.trim() : employer.companyName,
    email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : employer.email,
    websiteUrl: typeof websiteUrl === "string" ? websiteUrl.trim() || null : employer.websiteUrl,
    country: typeof country === "string" ? country.trim() || null : employer.country,
    webhookUrl: typeof webhookUrl === "string" ? webhookUrl.trim() || null : employer.webhookUrl,
    autoCreateWorkers: typeof autoCreateWorkers === "boolean" ? autoCreateWorkers : employer.autoCreateWorkers,
    updatedAt: new Date(),
  }).where(eq(employersTable.id, employer.id)).returning();
  res.json({ employer: publicEmployer(updated) });
});

// Mint an API key. Sandbox keys (test mode) are always allowed; live keys
// require a verified employer so unverified accounts can't move real money.
router.post("/payroll/employers/me/api-keys", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) {
    res.status(404).json({ error: "not_found", message: "Register an employer first." });
    return;
  }
  const { name, sandbox, scopes, expiresInDays } = req.body as {
    name?: string; sandbox?: boolean; scopes?: string[]; expiresInDays?: number;
  };
  const isSandbox = sandbox !== false; // default to a safe sandbox key
  if (!isSandbox && employer.status !== "verified") {
    res.status(403).json({ error: "not_verified", message: "Live keys require business verification. Use a sandbox (test) key meanwhile." });
    return;
  }
  const validScopes = Array.isArray(scopes) && scopes.length
    ? scopes.filter((s) => ["payroll:read", "payroll:write"].includes(s))
    : ["payroll:read", "payroll:write"];
  const generated = generateApiKey(isSandbox);
  const expiresAt = expiresInDays && expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86_400_000) : null;

  const [row] = await db.insert(employerApiKeysTable).values({
    employerId: employer.id,
    name: name?.trim() || (isSandbox ? "Sandbox key" : "Live key"),
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    sandbox: isSandbox,
    scopes: validScopes,
    expiresAt,
  }).returning();

  res.status(201).json({
    apiKey: generated.plaintext, // shown exactly once — store it now
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    sandbox: row.sandbox,
    scopes: validScopes,
    expiresAt: expiresAt?.toISOString() ?? null,
    message: "Store this key now — it won't be shown again.",
  });
});

router.get("/payroll/employers/me/api-keys", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) {
    res.status(404).json({ error: "not_found", message: "No employer account." });
    return;
  }
  const rows = await db.select().from(employerApiKeysTable)
    .where(eq(employerApiKeysTable.employerId, employer.id))
    .orderBy(desc(employerApiKeysTable.createdAt));
  res.json({
    apiKeys: rows.map((k) => ({
      id: k.id, name: k.name, prefix: k.keyPrefix, sandbox: k.sandbox,
      scopes: k.scopes, lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
});

router.delete("/payroll/employers/me/api-keys/:keyId", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) {
    res.status(404).json({ error: "not_found", message: "No employer account." });
    return;
  }
  const [updated] = await db.update(employerApiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(employerApiKeysTable.id, req.params.keyId as string), eq(employerApiKeysTable.employerId, employer.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found", message: "API key not found." });
    return;
  }
  res.json({ revoked: true, id: updated.id });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Funding — how an employer tops up the prepaid balance payroll draws from.
//   • Live: send USDC on Celo to the employer's funding address.
//   • Sandbox: mint test balance freely (never touches real funds).
// ═══════════════════════════════════════════════════════════════════════════════

// Owner requests/provisions the Celo deposit address that funds live balance.
router.post("/payroll/funding/address", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) {
    res.status(404).json({ error: "not_found", message: "Register an employer first." });
    return;
  }
  if (employer.fundingAddress) {
    res.json({ fundingAddress: employer.fundingAddress, network: "Celo", currency: "USDC" });
    return;
  }
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, employer.ownerUserId)).limit(1);
  const wallet = owner ? await ensureUserWallet(owner) : null;
  if (!wallet) {
    res.status(503).json({ error: "not_configured", message: "Funding wallets are activating soon. Use sandbox mode to integrate meanwhile." });
    return;
  }
  await db.update(employersTable).set({ fundingAddress: wallet.address, updatedAt: new Date() })
    .where(eq(employersTable.id, employer.id));
  res.json({
    fundingAddress: wallet.address,
    network: "Celo",
    currency: "USDC",
    instructions: "Send USDC on Celo to this address. Confirmed deposits credit your payroll balance.",
  });
});

// Sandbox-only test top-up. Requires a sandbox API key so it can never touch a
// live balance.
router.post("/payroll/sandbox/fund", requireEmployer("payroll:write"), async (req, res) => {
  const { employer, sandbox } = req.employerAuth!;
  if (!sandbox) {
    res.status(403).json({ error: "live_key", message: "Test funding requires a sandbox (test) API key." });
    return;
  }
  const amount = Number((req.body as { amount?: number }).amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "amount must be a positive number" });
    return;
  }
  const [updated] = await db.update(employersTable)
    .set({ balanceUsdc: sql`${employersTable.balanceUsdc} + ${round6(amount)}`, updatedAt: new Date() })
    .where(eq(employersTable.id, employer.id)).returning();
  res.json({ balanceUsdc: Number(updated.balanceUsdc), credited: round6(amount), sandbox: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Batches — the core payroll API, authenticated by API key.
// ═══════════════════════════════════════════════════════════════════════════════

interface IncomingPayment {
  workerIdentifier?: string;
  identifierType?: string;
  amount?: number | string;
  currency?: string;
  reason?: string;
  externalId?: string;
}

// Create a batch (draft). Validates and stores every payment line; resolves
// nothing and charges nothing until /submit. Idempotent via `idempotencyKey`.
router.post("/payroll/batches", requireEmployer("payroll:write"), async (req, res) => {
  try {
    const { employer, sandbox } = req.employerAuth!;
    const body = req.body as {
      reference?: string; description?: string; currency?: string;
      webhookUrl?: string; idempotencyKey?: string; metadata?: unknown;
      payments?: IncomingPayment[];
    };
    const idempotencyKey = body.idempotencyKey?.trim() || (req.headers["idempotency-key"] as string | undefined)?.trim() || null;

    // Idempotency: same key from the same employer returns the original batch.
    if (idempotencyKey) {
      const [dupe] = await db.select().from(payrollBatchesTable)
        .where(and(eq(payrollBatchesTable.employerId, employer.id), eq(payrollBatchesTable.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (dupe) {
        res.status(200).json({ batch: await batchView(dupe.id), idempotent: true });
        return;
      }
    }

    const payments = body.payments;
    if (!Array.isArray(payments) || payments.length === 0) {
      res.status(400).json({ error: "validation_error", message: "Provide a non-empty payments array." });
      return;
    }
    if (payments.length > MAX_PAYMENTS_PER_BATCH) {
      res.status(400).json({ error: "too_large", message: `A batch can hold at most ${MAX_PAYMENTS_PER_BATCH} payments. Split into multiple batches.` });
      return;
    }

    // Validate every line before writing anything.
    const cleaned: Array<{ identifier: string; type: IdentifierType; amount: number; currency: string; reason: string | null; externalId: string | null }> = [];
    const errors: Array<{ index: number; message: string }> = [];
    payments.forEach((p, i) => {
      const identifier = String(p.workerIdentifier ?? "").trim();
      if (!identifier) { errors.push({ index: i, message: "workerIdentifier is required" }); return; }
      const type = (p.identifierType && VALID_TYPES.includes(p.identifierType as IdentifierType))
        ? (p.identifierType as IdentifierType)
        : inferIdentifierType(identifier);
      const idErr = validateIdentifier(identifier, type);
      if (idErr) { errors.push({ index: i, message: idErr }); return; }
      const amount = Number(p.amount);
      if (!Number.isFinite(amount) || amount <= 0) { errors.push({ index: i, message: "amount must be a positive number" }); return; }
      cleaned.push({
        identifier, type, amount: round6(amount),
        currency: (p.currency ?? body.currency ?? "USDC").toUpperCase(),
        reason: p.reason?.trim() || null,
        externalId: p.externalId?.trim() || null,
      });
    });
    if (errors.length) {
      res.status(400).json({ error: "validation_error", message: "Some payments are invalid.", errors });
      return;
    }

    const feeCfg = await getPayrollFeeConfig(); // admin-set, live from /admin/settings
    const totalAmount = round6(cleaned.reduce((s, p) => s + p.amount, 0));
    const feeAmount = round6(cleaned.reduce((s, p) => s + payrollFee(p.amount, feeCfg), 0));

    const [batch] = await db.insert(payrollBatchesTable).values({
      employerId: employer.id,
      reference: body.reference?.trim() || null,
      description: body.description?.trim() || null,
      sandbox,
      currency: (body.currency ?? "USDC").toUpperCase(),
      status: "draft",
      totalAmount: String(totalAmount),
      feeAmount: String(feeAmount),
      paymentCount: cleaned.length,
      webhookUrl: body.webhookUrl?.trim() || null,
      idempotencyKey,
      metadata: (body.metadata as object) ?? null,
    }).returning();

    await db.insert(payrollPaymentsTable).values(cleaned.map((p) => ({
      batchId: batch.id,
      employerId: employer.id,
      workerIdentifier: p.identifier,
      identifierType: p.type,
      amount: String(p.amount),
      currency: p.currency,
      reason: p.reason,
      externalId: p.externalId,
    })));

    res.status(201).json({ batch: await batchView(batch.id) });
  } catch (err) {
    // Unique-violation on idempotency key under a race → return the winner.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "duplicate", message: "A batch with this idempotency key already exists." });
      return;
    }
    req.log.error({ err }, "Create batch error");
    res.status(500).json({ error: "internal_error", message: "Could not create batch" });
  }
});

// Submit a draft batch: check funds cover total+fees, flip to processing, then
// resolve + pay every worker. Total cost is held against the employer balance.
router.post("/payroll/batches/:batchId/submit", requireEmployer("payroll:write"), async (req, res) => {
  try {
    const { employer } = req.employerAuth!;
    const [batch] = await db.select().from(payrollBatchesTable)
      .where(and(eq(payrollBatchesTable.id, req.params.batchId as string), eq(payrollBatchesTable.employerId, employer.id)))
      .limit(1);
    if (!batch) {
      res.status(404).json({ error: "not_found", message: "Batch not found." });
      return;
    }
    if (batch.status !== "draft") {
      // Idempotent submit: return current state instead of erroring on retries.
      // A batch stuck in "processing" (server restarted mid-run) is resumed —
      // the processor is idempotent per payment and guarded against concurrent
      // runs, so this is always safe to kick.
      if (batch.status === "processing") {
        void processBatch(batch.id).catch((err) => req.log.error({ err, batchId: batch.id }, "Batch resume errored"));
      }
      res.status(200).json({ batch: await batchView(batch.id), alreadySubmitted: true });
      return;
    }

    const cost = round6(Number(batch.totalAmount) + Number(batch.feeAmount));
    if (Number(employer.balanceUsdc) < cost) {
      res.status(402).json({
        error: "insufficient_balance",
        message: `Your payroll balance (${Number(employer.balanceUsdc)} USDC) is below this batch's cost (${cost} USDC). Top up and retry.`,
        required: cost, available: Number(employer.balanceUsdc),
      });
      return;
    }

    await db.update(payrollBatchesTable)
      .set({ status: "processing", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(payrollBatchesTable.id, batch.id));
    void enqueueWebhook(employer, "batch.processing", { batchId: batch.id, reference: batch.reference }, { batchId: batch.id, urlOverride: batch.webhookUrl ?? undefined });

    // Small batches settle inline so the response carries the final result.
    // Large ones (thousands of workers) return 202 immediately and settle in
    // the background — final state arrives via webhooks or GET /batches/:id.
    // Safe either way: processing is idempotent per payment (terminal payments
    // are never re-paid), so a crash mid-batch just resumes on re-submit.
    if (batch.paymentCount <= SYNC_PROCESS_LIMIT) {
      await processBatch(batch.id);
      res.json({ batch: await batchView(batch.id) });
      return;
    }

    void processBatch(batch.id).catch((err) => {
      req.log.error({ err, batchId: batch.id }, "Background batch processing errored — re-submit to resume");
    });
    res.status(202).json({
      batch: await batchView(batch.id),
      processing: true,
      message: "Batch accepted and processing in the background. Track it via GET /payroll/batches/{batchId} or your webhooks (batch.completed / batch.partially_completed / batch.failed).",
    });
  } catch (err) {
    req.log.error({ err }, "Submit batch error");
    res.status(500).json({ error: "internal_error", message: "Could not submit batch" });
  }
});

// Cancel a still-draft batch.
router.post("/payroll/batches/:batchId/cancel", requireEmployer("payroll:write"), async (req, res) => {
  const { employer } = req.employerAuth!;
  const [batch] = await db.select().from(payrollBatchesTable)
    .where(and(eq(payrollBatchesTable.id, req.params.batchId as string), eq(payrollBatchesTable.employerId, employer.id)))
    .limit(1);
  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Batch not found." });
    return;
  }
  if (batch.status !== "draft") {
    res.status(409).json({ error: "not_cancellable", message: `Only draft batches can be cancelled (this one is ${batch.status}).` });
    return;
  }
  await db.update(payrollBatchesTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(payrollBatchesTable.id, batch.id));
  res.json({ batch: await batchView(batch.id) });
});

// List batches (paginated, newest first; optional status filter).
router.get("/payroll/batches", requireEmployer("payroll:read"), async (req, res) => {
  const { employer } = req.employerAuth!;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const statusFilter = typeof req.query.status === "string" ? req.query.status : null;

  const where = statusFilter
    ? and(eq(payrollBatchesTable.employerId, employer.id), eq(payrollBatchesTable.status, statusFilter as never))
    : eq(payrollBatchesTable.employerId, employer.id);

  const rows = await db.select().from(payrollBatchesTable).where(where)
    .orderBy(desc(payrollBatchesTable.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(payrollBatchesTable).where(where);
  res.json({ batches: rows.map(serializeBatch), total, limit, offset });
});

// Batch detail (without the full payment list).
router.get("/payroll/batches/:batchId", requireEmployer("payroll:read"), async (req, res) => {
  const { employer } = req.employerAuth!;
  const [batch] = await db.select().from(payrollBatchesTable)
    .where(and(eq(payrollBatchesTable.id, req.params.batchId as string), eq(payrollBatchesTable.employerId, employer.id)))
    .limit(1);
  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Batch not found." });
    return;
  }
  res.json({ batch: serializeBatch(batch) });
});

// Payments within a batch (paginated).
router.get("/payroll/batches/:batchId/payments", requireEmployer("payroll:read"), async (req, res) => {
  const { employer } = req.employerAuth!;
  const [batch] = await db.select().from(payrollBatchesTable)
    .where(and(eq(payrollBatchesTable.id, req.params.batchId as string), eq(payrollBatchesTable.employerId, employer.id)))
    .limit(1);
  if (!batch) {
    res.status(404).json({ error: "not_found", message: "Batch not found." });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const rows = await db.select().from(payrollPaymentsTable)
    .where(eq(payrollPaymentsTable.batchId, batch.id))
    .orderBy(desc(payrollPaymentsTable.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(payrollPaymentsTable)
    .where(eq(payrollPaymentsTable.batchId, batch.id));
  res.json({ payments: rows.map(serializePayment), total, limit, offset });
});

// Rollup analytics across all of an employer's payroll activity.
async function summaryFor(employer: Employer) {
  const [agg] = await db.select({
    totalBatches: count(),
    disbursed: sql<string>`coalesce(sum(${payrollBatchesTable.totalAmount}) filter (where ${payrollBatchesTable.status} in ('completed','partially_completed')), 0)`,
    fees: sql<string>`coalesce(sum(${payrollBatchesTable.feeAmount}) filter (where ${payrollBatchesTable.status} in ('completed','partially_completed')), 0)`,
  }).from(payrollBatchesTable).where(eq(payrollBatchesTable.employerId, employer.id));
  const [pay] = await db.select({
    totalPayments: count(),
    completed: sql<number>`count(*) filter (where ${payrollPaymentsTable.status} = 'completed')`,
    failed: sql<number>`count(*) filter (where ${payrollPaymentsTable.status} = 'failed')`,
    workersCreated: sql<number>`count(*) filter (where ${payrollPaymentsTable.workerCreated} = true)`,
  }).from(payrollPaymentsTable).where(eq(payrollPaymentsTable.employerId, employer.id));
  return {
    balanceUsdc: Number(employer.balanceUsdc),
    totalBatches: agg.totalBatches,
    totalDisbursed: Number(agg.disbursed),
    totalFees: Number(agg.fees),
    totalPayments: pay.totalPayments,
    completedPayments: Number(pay.completed),
    failedPayments: Number(pay.failed),
    workersOnboarded: Number(pay.workersCreated),
  };
}

async function listBatchesFor(employerId: string, limit: number, offset: number) {
  const where = eq(payrollBatchesTable.employerId, employerId);
  const rows = await db.select().from(payrollBatchesTable).where(where)
    .orderBy(desc(payrollBatchesTable.createdAt)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(payrollBatchesTable).where(where);
  return { batches: rows.map(serializeBatch), total, limit, offset };
}

router.get("/payroll/summary", requireEmployer("payroll:read"), async (req, res) => {
  res.json(await summaryFor(req.employerAuth!.employer));
});

// ── Owner dashboard (JWT) ───────────────────────────────────────────────────────
// The web portal is used by the signed-in owner, not a server holding an API
// key — so dashboard reads authenticate with the user's session and resolve the
// employer from it. API keys remain purely for the marketplace's backend.

router.get("/payroll/dashboard/summary", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) { res.status(404).json({ error: "not_found", message: "No employer account." }); return; }
  res.json(await summaryFor(employer));
});

router.get("/payroll/dashboard/batches", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) { res.status(404).json({ error: "not_found", message: "No employer account." }); return; }
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  res.json(await listBatchesFor(employer.id, limit, offset));
});

router.get("/payroll/dashboard/batches/:batchId", requireAuth, async (req, res) => {
  const employer = await employerForOwner(req.user!.userId);
  if (!employer) { res.status(404).json({ error: "not_found", message: "No employer account." }); return; }
  const [batch] = await db.select().from(payrollBatchesTable)
    .where(and(eq(payrollBatchesTable.id, req.params.batchId as string), eq(payrollBatchesTable.employerId, employer.id))).limit(1);
  if (!batch) { res.status(404).json({ error: "not_found", message: "Batch not found." }); return; }
  const payments = await db.select().from(payrollPaymentsTable)
    .where(eq(payrollPaymentsTable.batchId, batch.id)).orderBy(desc(payrollPaymentsTable.createdAt)).limit(500);
  res.json({ batch: serializeBatch(batch), payments: payments.map(serializePayment) });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Webhooks — delivery log + a test fire so integrators can wire up receivers.
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/payroll/webhooks/test", requireEmployer("payroll:write"), async (req, res) => {
  const { employer } = req.employerAuth!;
  const urlOverride = (req.body as { url?: string }).url?.trim() || undefined;
  if (!urlOverride && !employer.webhookUrl) {
    res.status(400).json({ error: "no_webhook", message: "Set a webhook URL on your employer profile, or pass one in the body." });
    return;
  }
  const id = await enqueueWebhook(employer, "webhook.test", { message: "This is a test event from S-PAY payroll." }, { urlOverride });
  res.json({ queued: true, deliveryId: id });
});

router.get("/payroll/webhooks/deliveries", requireEmployer("payroll:read"), async (req, res) => {
  const { employer } = req.employerAuth!;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await db.select().from(payrollWebhookDeliveriesTable)
    .where(eq(payrollWebhookDeliveriesTable.employerId, employer.id))
    .orderBy(desc(payrollWebhookDeliveriesTable.createdAt)).limit(limit);
  res.json({
    deliveries: rows.map((d) => ({
      id: d.id, eventType: d.eventType, url: d.url, status: d.status,
      responseStatus: d.responseStatus, attempts: d.attempts, lastError: d.lastError,
      batchId: d.batchId, deliveredAt: d.deliveredAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Payout rails — which providers settle worker cash-outs, and a corridor quote
// comparison. Backed by the pluggable payout-providers layer (admin-switchable).
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/payroll/payout-providers", requireAuth, async (_req, res) => {
  res.json({ providers: payoutProviderCatalog() });
});

router.get("/payroll/payout-quote", requireAuth, async (req, res) => {
  const targetCurrency = String(req.query.targetCurrency ?? "USD");
  const method = String(req.query.method ?? "bank_transfer");
  const amount = Number(req.query.amount) || 0;
  const quotes = await quotesForCorridor(targetCurrency, method, amount);
  res.json({ targetCurrency, method, amount, quotes });
});

// ── serializers ────────────────────────────────────────────────────────────────

function serializeBatch(b: typeof payrollBatchesTable.$inferSelect) {
  return {
    id: b.id,
    reference: b.reference,
    description: b.description,
    sandbox: b.sandbox,
    currency: b.currency,
    status: b.status,
    totalAmount: Number(b.totalAmount),
    feeAmount: Number(b.feeAmount),
    totalCost: round6(Number(b.totalAmount) + Number(b.feeAmount)),
    paymentCount: b.paymentCount,
    completedCount: b.completedCount,
    failedCount: b.failedCount,
    webhookUrl: b.webhookUrl,
    idempotencyKey: b.idempotencyKey,
    submittedAt: b.submittedAt?.toISOString() ?? null,
    completedAt: b.completedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

function serializePayment(p: typeof payrollPaymentsTable.$inferSelect) {
  return {
    id: p.id,
    workerIdentifier: p.workerIdentifier,
    identifierType: p.identifierType,
    amount: Number(p.amount),
    currency: p.currency,
    reason: p.reason,
    status: p.status,
    resolvedUserId: p.resolvedUserId,
    workerCreated: p.workerCreated,
    transactionId: p.transactionId,
    errorMessage: p.errorMessage,
    externalId: p.externalId,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

async function batchView(batchId: string) {
  const [b] = await db.select().from(payrollBatchesTable).where(eq(payrollBatchesTable.id, batchId)).limit(1);
  return serializeBatch(b);
}

export default router;
