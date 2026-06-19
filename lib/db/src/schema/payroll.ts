import { pgTable, text, numeric, timestamp, integer, boolean, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Payroll / Payouts-as-a-Service ─────────────────────────────────────────────
// Lets marketplaces (Upwork, Fiverr, Studypool…) pay their workers through
// S-PAY. An employer holds a prepaid USDC ledger balance, submits batches of
// worker payments via the API, and S-PAY resolves each worker (by email/phone/
// S-PAY id/Celo address — auto-creating + inviting unknown workers) and credits
// their in-app balance. Workers then cash out through the normal withdraw flow.
//
// Honest by construction: money only moves between internal ledger rows here —
// the employer must first fund their balance with real USDC (deposit address),
// or in `sandbox` mode use test balance that can never touch production funds.

export const employerStatusEnum = pgEnum("employer_status", [
  "pending",   // registered, awaiting business (KYB) verification
  "verified",  // cleared to send live payroll
  "rejected",  // KYB failed
  "suspended", // temporarily blocked by an admin
]);

export const payrollBatchStatusEnum = pgEnum("payroll_batch_status", [
  "draft",               // created, editable, not yet charged
  "processing",          // submitted — workers being resolved + paid
  "completed",           // every payment succeeded
  "partially_completed", // some payments failed (e.g. unresolved workers)
  "failed",              // nothing could be paid (e.g. insufficient balance)
  "cancelled",           // cancelled while still a draft
]);

export const payrollPaymentStatusEnum = pgEnum("payroll_payment_status", [
  "pending",    // queued, not yet resolved
  "resolved",   // worker matched/created, awaiting credit
  "completed",  // worker credited
  "failed",     // could not resolve or credit
]);

export const workerIdentifierTypeEnum = pgEnum("worker_identifier_type", [
  "email", "phone", "spay_id", "celo_address",
]);

// One row per marketplace/company that pays through S-PAY. Owned by a regular
// S-PAY user (the person who registered it) so they can sign in and manage it.
export const employersTable = pgTable("employers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text("owner_user_id").notNull(), // the S-PAY user who manages this employer
  companyName: text("company_name").notNull(),
  email: text("email").notNull(),               // business contact email
  websiteUrl: text("website_url"),
  country: text("country"),
  status: employerStatusEnum("status").default("pending").notNull(),
  // Prepaid float the employer draws payroll from, in USDC (6dp). Funded by
  // sending USDC to fundingAddress, or topped up freely in sandbox.
  balanceUsdc: numeric("balance_usdc", { precision: 18, scale: 6 }).default("0").notNull(),
  fundingAddress: text("funding_address"),      // Celo address employers deposit USDC to (JIT-provisioned)
  // Default destination for batch-completed / payment-failed callbacks. Each
  // batch may override it. Signed with webhookSecret (HMAC-SHA256).
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),        // generated at registration; used to sign callbacks
  // When a payment names a worker S-PAY has never seen, auto-create an account
  // and invite them to claim the funds (higher conversion). Off = strict mode:
  // such payments fail and must be retried with a known identifier.
  autoCreateWorkers: boolean("auto_create_workers").default(true).notNull(),
  metadata: jsonb("metadata"),                  // employer-supplied custom fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_employers_owner").on(t.ownerUserId),
  index("idx_employers_status").on(t.status),
]).enableRLS();

// API credentials an employer's backend uses to call the payroll API. Only the
// SHA-256 hash is stored — the plaintext key is shown once at creation. The
// `live`/`test` environment is baked into the key so a sandbox key can never
// move real money.
export const employerApiKeysTable = pgTable("employer_api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  employerId: text("employer_id").notNull(),
  name: text("name"),                           // human label e.g. "Production", "Staging"
  keyPrefix: text("key_prefix").notNull(),      // first chars shown in the UI: spk_live_a1b2…
  keyHash: text("key_hash").notNull(),          // sha256(plaintext) — the only stored secret
  sandbox: boolean("sandbox").default(false).notNull(), // test key → sandbox-only
  scopes: jsonb("scopes").default(["payroll:read", "payroll:write"]).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),           // null = active
  expiresAt: timestamp("expires_at"),           // null = no expiry
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_employer_api_keys_hash").on(t.keyHash), // O(1) auth lookup
  index("idx_employer_api_keys_employer").on(t.employerId),
]).enableRLS();

// A payroll run: a set of worker payments submitted together.
export const payrollBatchesTable = pgTable("payroll_batches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  employerId: text("employer_id").notNull(),
  reference: text("reference"),                 // employer's own id for this run, e.g. "2026-06-payroll"
  description: text("description"),
  sandbox: boolean("sandbox").default(false).notNull(), // matches the key that created it
  currency: text("currency").default("USDC").notNull(),
  status: payrollBatchStatusEnum("status").default("draft").notNull(),
  totalAmount: numeric("total_amount", { precision: 18, scale: 6 }).default("0").notNull(),
  feeAmount: numeric("fee_amount", { precision: 18, scale: 6 }).default("0").notNull(),
  paymentCount: integer("payment_count").default(0).notNull(),
  completedCount: integer("completed_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  webhookUrl: text("webhook_url"),              // overrides employer default for this batch
  // Per-employer idempotency: re-submitting the same key returns the original
  // batch instead of charging twice (critical for financial APIs).
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata"),
  submittedAt: timestamp("submitted_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_payroll_batches_employer_created").on(t.employerId, t.createdAt.desc()),
  index("idx_payroll_batches_status").on(t.status),
  // One idempotency key per employer — guards the double-charge window.
  uniqueIndex("idx_payroll_batches_idem").on(t.employerId, t.idempotencyKey),
]).enableRLS();

// One worker payment inside a batch.
export const payrollPaymentsTable = pgTable("payroll_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  batchId: text("batch_id").notNull(),
  employerId: text("employer_id").notNull(),
  workerIdentifier: text("worker_identifier").notNull(), // email/phone/id/address as sent
  identifierType: workerIdentifierTypeEnum("identifier_type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: text("currency").default("USDC").notNull(),
  reason: text("reason"),                        // "August hours", "Project X" — shown to the worker
  status: payrollPaymentStatusEnum("status").default("pending").notNull(),
  resolvedUserId: text("resolved_user_id"),      // S-PAY user the worker resolved/created to
  workerCreated: boolean("worker_created").default(false).notNull(), // true if we auto-created + invited them
  transactionId: text("transaction_id"),         // the worker's "receive" ledger row
  errorMessage: text("error_message"),           // why it failed, if it did
  resolvedAt: timestamp("resolved_at"),
  paidAt: timestamp("paid_at"),
  externalId: text("external_id"),               // employer's own id for this line, echoed back
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_payroll_payments_batch").on(t.batchId),
  index("idx_payroll_payments_employer_created").on(t.employerId, t.createdAt.desc()),
  index("idx_payroll_payments_resolved_user").on(t.resolvedUserId),
]).enableRLS();

// Audit log of webhook callbacks fired to employers, with delivery state so
// failed deliveries can be inspected and retried.
export const payrollWebhookDeliveriesTable = pgTable("payroll_webhook_deliveries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  employerId: text("employer_id").notNull(),
  eventType: text("event_type").notNull(),       // batch.completed | payment.failed | …
  url: text("url").notNull(),
  batchId: text("batch_id"),
  payload: jsonb("payload").notNull(),
  status: text("status").default("pending").notNull(), // pending | delivered | failed
  responseStatus: integer("response_status"),    // HTTP status the employer returned
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_payroll_webhooks_employer_created").on(t.employerId, t.createdAt.desc()),
]).enableRLS();

export const insertEmployerSchema = createInsertSchema(employersTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type Employer = typeof employersTable.$inferSelect;
export type EmployerApiKey = typeof employerApiKeysTable.$inferSelect;
export type PayrollBatch = typeof payrollBatchesTable.$inferSelect;
export type PayrollPayment = typeof payrollPaymentsTable.$inferSelect;
export type PayrollWebhookDelivery = typeof payrollWebhookDeliveriesTable.$inferSelect;
export type InsertEmployer = z.infer<typeof insertEmployerSchema>;
