import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kycStatusEnum = pgEnum("kyc_status", ["pending", "approved", "rejected"]);
export const accountTypeEnum = pgEnum("account_type", ["personal", "business"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),          // null for social-only accounts
  googleId: text("google_id").unique(),          // null for email/password accounts
  appleId: text("apple_id").unique(),            // Sign in with Apple subject id
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  phoneNumber: text("phone_number"),
  country: text("country"),                      // self-reported at signup; drives payout method defaults
  accountType: accountTypeEnum("account_type").default("personal").notNull(), // personal → Noah KYC · business → Noah KYB
  businessName: text("business_name"),           // required for business accounts; goes on business virtual accounts
  kycStatus: kycStatusEnum("kyc_status").default("pending").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  celoWalletAddress: text("celo_wallet_address"),
  privyWalletId: text("privy_wallet_id"),         // Privy server-wallet id used to sign Celo transactions
  signupSource: text("signup_source"),           // acquisition channel: jobs, jobs:<id>, landing, google, mobile…
  noahCustomerId: text("noah_customer_id"),
  stripeCardholderId: text("stripe_cardholder_id"),
  stripeCardId: text("stripe_card_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
