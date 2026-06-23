import { pgTable, text, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Virtual accounts (US ACH / EU IBAN) ─────────────────────────────────────────
// A persistent fiat receiving account a worker shares with employers/clients. A
// payer sends a normal domestic transfer; the issuing money-rail provider
// auto-converts to USDC and settles it on-chain to the worker's OWN Celo wallet
// (the single balance). This row therefore stores ACCOUNT DETAILS to receive
// into — never a balance. Spendable balance is always the on-chain USDC.
//
// Sticky single issuer: an account is issued once by one provider and stays with
// it (a worker can't be handed a different account number each time). One active
// account per (user, currency); presented generically ("Your USD account"),
// never branded by provider.

export const virtualAccountStatusEnum = pgEnum("virtual_account_status", ["active", "closed"]);

export const virtualAccountsTable = pgTable("virtual_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),          // issuing money-rail key (sticky): noah | bridge | …
  externalId: text("external_id"),               // the provider's account id, for reconciliation
  currency: text("currency").notNull(),          // USD | EUR
  accountType: text("account_type").notNull(),   // ach | iban
  country: text("country"),                      // US | DE | …
  holderName: text("holder_name").notNull(),     // person, or businessName for business accounts
  bankName: text("bank_name"),
  accountNumberMasked: text("account_number_masked"), // last4 only — full number stays at the provider
  routingNumber: text("routing_number"),         // ACH routing (US)
  ibanMasked: text("iban_masked"),               // masked IBAN (EU)
  status: virtualAccountStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_virtual_accounts_user").on(t.userId),
  // Sticky: at most one active account per user + currency.
  uniqueIndex("idx_virtual_accounts_user_currency").on(t.userId, t.currency),
]).enableRLS();

export const insertVirtualAccountSchema = createInsertSchema(virtualAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVirtualAccount = z.infer<typeof insertVirtualAccountSchema>;
export type VirtualAccount = typeof virtualAccountsTable.$inferSelect;
