import { pgTable, text, timestamp, pgEnum, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── KYC / KYB verifications (provider-run identity checks) ──────────────────────
// S-PAY never builds its own identity stack: the admin designates a money-rail
// provider (Noah, Bridge, Conduit, Yellow Card…) whose HOSTED KYC/KYB flow users
// are sent to, and the result webhooks back. This table is S-PAY's own record of
// every verification attempt — which provider ran it, the provider's customer id
// (to correlate webhooks), the hosted-flow URL (so a user can resume), and the
// provider's decision payload — so the data lives in OUR system even though the
// provider does the verifying. users.kycStatus stays the single gate the app
// checks; this table is the audit trail + provider linkage behind it.

export const kycVerificationStatusEnum = pgEnum("kyc_verification_status", [
  "started",   // hosted flow opened; waiting on the user/provider
  "approved",  // provider webhook confirmed the identity
  "rejected",  // provider webhook rejected it (user can start again)
]);

export const kycVerificationsTable = pgTable("kyc_verifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),          // money-rail key that ran it: noah | bridge | conduit | yellowcard
  externalId: text("external_id"),               // the provider's customer/verification id — correlates their webhook
  status: kycVerificationStatusEnum("status").default("started").notNull(),
  verificationUrl: text("verification_url"),     // the provider's hosted flow — lets the user resume verification
  accountType: text("account_type"),             // personal (KYC) | business (KYB) at the time of the attempt
  payload: jsonb("payload"),                     // provider decision payload (webhook body) — stored for audit/compliance
  decidedAt: timestamp("decided_at"),            // when the provider approved/rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_kyc_verifications_user").on(t.userId),
  index("idx_kyc_verifications_external").on(t.externalId), // every provider webhook lookup
  index("idx_kyc_verifications_created").on(t.createdAt.desc()),
]).enableRLS();

export const insertKycVerificationSchema = createInsertSchema(kycVerificationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKycVerification = z.infer<typeof insertKycVerificationSchema>;
export type KycVerification = typeof kycVerificationsTable.$inferSelect;
