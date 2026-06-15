import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/**
 * Transaction PIN — a second factor on money actions, independent of the
 * 30-day login JWT. Stored only as a bcrypt hash; never logged or returned.
 * Brute-force defense: after MAX_ATTEMPTS wrong tries the PIN locks for
 * LOCK_MINUTES. A correct PIN (or a successful set) clears the counter.
 */

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const PIN_RE = /^\d{4,6}$/; // 4–6 digits, like a bank card

export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && PIN_RE.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export type PinCheck =
  | { ok: true }
  | { ok: false; reason: "not_set" | "locked" | "wrong"; message: string; attemptsLeft?: number };

/**
 * Verify a PIN for a money action. Enforces lockout, increments/clears the
 * attempt counter atomically-enough for our single-writer flows.
 */
export async function verifyTransactionPin(
  user: { id: string; transactionPinHash: string | null; pinAttempts: number; pinLockedUntil: Date | null },
  pin: unknown,
): Promise<PinCheck> {
  if (!user.transactionPinHash) {
    return { ok: false, reason: "not_set", message: "Set a transaction PIN first to send or withdraw money." };
  }
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    const mins = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, reason: "locked", message: `Too many wrong PIN attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  if (!isValidPinFormat(pin)) {
    return { ok: false, reason: "wrong", message: "Enter your 4–6 digit PIN." };
  }
  const match = await bcrypt.compare(pin, user.transactionPinHash);
  if (match) {
    if (user.pinAttempts > 0 || user.pinLockedUntil) {
      await db.update(usersTable).set({ pinAttempts: 0, pinLockedUntil: null }).where(eq(usersTable.id, user.id));
    }
    return { ok: true };
  }
  // Wrong PIN — increment ATOMICALLY (so concurrent attempts can't undercount
  // the counter and slip past the lockout), then lock once over the threshold.
  const [row] = await db.update(usersTable)
    .set({ pinAttempts: sql`${usersTable.pinAttempts} + 1` })
    .where(eq(usersTable.id, user.id))
    .returning({ attempts: usersTable.pinAttempts });
  const attempts = row?.attempts ?? user.pinAttempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await db.update(usersTable).set({
      pinAttempts: 0,
      pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000),
    }).where(eq(usersTable.id, user.id));
    return { ok: false, reason: "locked", message: `Too many wrong PIN attempts. Locked for ${LOCK_MINUTES} minutes.` };
  }
  return { ok: false, reason: "wrong", message: "Incorrect PIN.", attemptsLeft: MAX_ATTEMPTS - attempts };
}
