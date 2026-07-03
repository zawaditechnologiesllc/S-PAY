import { integer, pgTable, text, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
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
  spayId: text("spay_id").unique().notNull().$defaultFn(() => `spay_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`), // Public user identifier for payroll/marketplaces
  emailVerified: boolean("email_verified").default(false).notNull(), // soft verification — never blocks login, shown as a banner until confirmed
  emailVerifyToken: text("email_verify_token"),          // sha256 of the emailed token
  emailVerifyExpires: timestamp("email_verify_expires"),
  passwordResetToken: text("password_reset_token"),      // sha256 of the emailed token
  passwordResetExpires: timestamp("password_reset_expires"),
  // Email MFA: a 6-digit code emailed at sign-in. Password alone never returns a
  // session token — the code (10-min expiry) is the second factor on login.
  // Stored as sha256(code), never plaintext; the attempt counter invalidates the
  // code after a handful of wrong guesses so it can't be brute-forced.
  loginVerificationCode: text("login_verification_code"),
  loginVerificationExpires: timestamp("login_verification_expires"),
  loginVerificationAttempts: integer("login_verification_attempts").default(0).notNull(),
  notificationsReadAt: timestamp("notifications_read_at"), // everything created after this is "unread"
  isAdmin: boolean("is_admin").default(false).notNull(), // legacy, unused — see admin_role
  adminRole: text("admin_role"),                 // null = regular user; "superadmin" | "manager" | "support" (env ADMIN_EMAILS are always superadmin)
  // Transaction PIN — bcrypt hash, never the PIN itself. Gates money actions
  // (send, withdraw). Attempt counter + lockout window defend against guessing.
  transactionPinHash: text("transaction_pin_hash"),
  pinSetAt: timestamp("pin_set_at"),
  pinAttempts: integer("pin_attempts").default(0).notNull(),
  pinLockedUntil: timestamp("pin_locked_until"),
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
  index("idx_users_spay_id").on(t.spayId),             // payroll worker resolution by S-PAY ID
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
