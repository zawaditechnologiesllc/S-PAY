import { pgTable, text, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
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
  emailVerified: boolean("email_verified").default(false).notNull(), // soft verification — never blocks login, shown as a banner until confirmed
  emailVerifyToken: text("email_verify_token"),          // sha256 of the emailed token
  emailVerifyExpires: timestamp("email_verify_expires"),
  passwordResetToken: text("password_reset_token"),      // sha256 of the emailed token
  passwordResetExpires: timestamp("password_reset_expires"),
  notificationsReadAt: timestamp("notifications_read_at"), // everything created after this is "unread"
  isAdmin: boolean("is_admin").default(false).notNull(),
  celoWalletAddress: text("celo_wallet_address"), // provisioned lazily on the first money action — never at signup/login (keeps WaaS MAU billing at zero for jobs-only users)
  // Wallet-as-a-service linkage. The DB column keeps its historical name
  // (privy_wallet_id) from when Privy was the only provider; it stores the
  // server-wallet id of whichever provider created the wallet.
  walletId: text("privy_wallet_id"),
  walletProvider: text("wallet_provider"),        // "privy" | "cdp" | "turnkey" — which WaaS holds this wallet's key (signs its transactions)
  signupSource: text("signup_source"),           // acquisition channel: jobs, jobs:<id>, landing, google, mobile…
  noahCustomerId: text("noah_customer_id"),
  stripeCardholderId: text("stripe_cardholder_id"),
  stripeCardId: text("stripe_card_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_users_phone").on(t.phoneNumber),          // P2P recipient lookup on every send
  index("idx_users_noah_customer").on(t.noahCustomerId), // every Noah KYC/deposit webhook
  index("idx_users_created").on(t.createdAt.desc()),   // admin list + 30-day actives
  index("idx_users_kyc_status").on(t.kycStatus),       // admin KYC filter/counts
]).enableRLS();

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
