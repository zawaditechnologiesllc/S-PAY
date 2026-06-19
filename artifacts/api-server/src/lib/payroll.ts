import { db, usersTable, type User, type Employer } from "@workspace/db";
import { eq } from "drizzle-orm";
import { notifyUser } from "./notify";

// ── Payroll helpers: worker resolution, fees, identifier handling ───────────────

export type IdentifierType = "email" | "phone" | "spay_id" | "celo_address";

/** Lowercase + trim an email for consistent matching. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Normalise a phone number to a comparable form: keep a leading "+" and digits
 * only, dropping spaces, dashes and parentheses. Not full E.164 (we don't guess
 * a country code), but enough to match "+254 712 345678" with "+254712345678".
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CELO_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

/** Infer the identifier type when the employer didn't specify one. */
export function inferIdentifierType(identifier: string): IdentifierType {
  const v = identifier.trim();
  if (CELO_ADDR_RE.test(v)) return "celo_address";
  if (EMAIL_RE.test(v)) return "email";
  if (/^\+?[0-9][0-9\s\-()]{5,}$/.test(v)) return "phone";
  return "spay_id";
}

/** Validate that an identifier looks plausible for its declared type. */
export function validateIdentifier(identifier: string, type: IdentifierType): string | null {
  const v = identifier.trim();
  if (!v) return "Identifier is empty";
  switch (type) {
    case "email": return EMAIL_RE.test(v) ? null : "Not a valid email address";
    case "celo_address": return CELO_ADDR_RE.test(v) ? null : "Not a valid Celo (0x…) address";
    case "phone": return /^\+?[0-9][0-9\s\-()]{5,}$/.test(v) ? null : "Not a valid phone number";
    case "spay_id": return v.length >= 8 ? null : "Not a valid S-PAY id";
  }
}

export interface ResolveResult {
  user: User | null;
  created: boolean;
  error?: string;
}

/**
 * Resolve a worker identifier to an S-PAY user. Matching order:
 *   spay_id      → users.id
 *   email        → users.email (normalised)
 *   phone        → users.phone_number (normalised, with a digits fallback)
 *   celo_address → users.celo_wallet_address
 *
 * If no user is found and the employer allows it, auto-create a claimable
 * account and send an invite notification. A celo_address with no S-PAY user
 * can't be auto-created (we have no email/phone to invite) and resolves to null.
 */
export async function resolveWorker(
  identifier: string,
  type: IdentifierType,
  employer: Employer,
): Promise<ResolveResult> {
  const value = identifier.trim();

  let existing: User | undefined;
  if (type === "spay_id") {
    [existing] = await db.select().from(usersTable).where(eq(usersTable.id, value)).limit(1);
  } else if (type === "email") {
    [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalizeEmail(value))).limit(1);
  } else if (type === "phone") {
    const norm = normalizePhone(value);
    [existing] = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, norm)).limit(1);
    if (!existing && norm.startsWith("+")) {
      // Fallback: some accounts stored the number without the leading "+".
      [existing] = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, norm.slice(1))).limit(1);
    }
  } else if (type === "celo_address") {
    [existing] = await db.select().from(usersTable).where(eq(usersTable.celoWalletAddress, value)).limit(1);
  }

  if (existing) return { user: existing, created: false };

  if (!employer.autoCreateWorkers) {
    return { user: null, created: false, error: "Worker not found and auto-create is disabled for this employer" };
  }
  if (type === "celo_address" || type === "spay_id") {
    // No contactable identifier to invite on — can't onboard them automatically.
    return { user: null, created: false, error: `No S-PAY account for that ${type.replace("_", " ")}` };
  }

  // Auto-create a claimable account. Password is null (social-style) until the
  // worker sets one when they claim — they sign in via the invite link/email.
  const isEmail = type === "email";
  const email = isEmail ? normalizeEmail(value) : `worker_${crypto.randomUUID().slice(0, 12)}@claim.spayewallet.com`;
  const phone = type === "phone" ? normalizePhone(value) : null;

  try {
    const [created] = await db.insert(usersTable).values({
      email,
      passwordHash: null,
      fullName: isEmail ? value.split("@")[0] : "S-PAY Worker",
      phoneNumber: phone,
      accountType: "personal",
      kycStatus: "pending",
      signupSource: `payroll:${employer.id}`,
    }).returning();

    notifyUser(
      created.id,
      "You've been paid 🎉",
      `${employer.companyName} sent you money through S-PAY. Finish setting up your free account to claim and cash out.`,
      "money",
    );
    return { user: created, created: true };
  } catch (err) {
    // Most likely a unique-constraint race (the worker just signed up). Re-read.
    if (isEmail) {
      const [retry] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (retry) return { user: retry, created: false };
    }
    return { user: null, created: false, error: "Could not create a worker account" };
  }
}

// ── Fees ────────────────────────────────────────────────────────────────────────
// Payroll fee = flat per-payment + percent of amount, drawn from the employer's
// balance on top of the payout. Tiered: high-volume employers pay less. These
// are the platform defaults; a future admin setting can override them.

export interface PayrollFeeConfig {
  percent: number; // % of each payment
  flat: number;    // flat USDC per payment
}

export const DEFAULT_PAYROLL_FEE: PayrollFeeConfig = { percent: 1.0, flat: 0 };

/** Round to USDC's 6 decimal places. */
export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Fee charged on a single payment of `amount`. */
export function payrollFee(amount: number, cfg: PayrollFeeConfig = DEFAULT_PAYROLL_FEE): number {
  return Math.max(0, round6(cfg.flat + amount * (cfg.percent / 100)));
}
