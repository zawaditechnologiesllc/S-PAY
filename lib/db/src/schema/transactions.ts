import { pgTable, text, numeric, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "send", "receive", "withdraw", "recharge", "payment",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending", "completed", "failed",
]);

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: text("currency").notNull().default("USDC"),
  description: text("description").notNull(),
  counterparty: text("counterparty"),
  status: transactionStatusEnum("status").default("completed").notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Wallet history + dashboard sums: WHERE user_id ORDER BY created_at DESC
  index("idx_transactions_user_created").on(t.userId, t.createdAt.desc()),
  // Admin: full feed and type-filtered feed, newest first
  index("idx_transactions_created").on(t.createdAt.desc()),
  index("idx_transactions_type_created").on(t.type, t.createdAt.desc()),
  // RLS with no policies = deny-all for Supabase's auto REST API;
  // the S-PAY API connects as table owner and is unaffected.
]).enableRLS();

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
