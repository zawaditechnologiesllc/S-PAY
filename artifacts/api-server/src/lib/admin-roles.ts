import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Admin roles, resolved fresh from the DB on every admin request (so a
 * revoked admin loses access immediately — JWTs live 30 days).
 *
 *   superadmin — everything, incl. appointing/removing admins and the
 *                critical switches (wallet providers, fees, site content,
 *                maintenance, card program)
 *   manager    — day-to-day operations: users/KYC, transactions, job
 *                listings, enquiries, sending notifications
 *   support    — read users/transactions/stats, work the enquiries inbox
 *
 * ADMIN_EMAILS (env) accounts are permanent superadmins — the bootstrap and
 * the recovery path. They cannot be demoted from the UI.
 */

export type AdminRole = "superadmin" | "manager" | "support";
export const ADMIN_ROLES: readonly AdminRole[] = ["superadmin", "manager", "support"] as const;

export const ENV_ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "admin@spayewallet.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isEnvAdmin(email: string): boolean {
  return ENV_ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Effective role: env owners are always superadmin; otherwise the DB role. */
export function effectiveRole(user: { email: string; adminRole: string | null }): AdminRole | null {
  if (isEnvAdmin(user.email)) return "superadmin";
  return ADMIN_ROLES.includes(user.adminRole as AdminRole) ? (user.adminRole as AdminRole) : null;
}

export async function resolveAdminRole(userId: string): Promise<AdminRole | null> {
  const [user] = await db.select({ email: usersTable.email, adminRole: usersTable.adminRole })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ? effectiveRole(user) : null;
}

declare global {
  namespace Express {
    interface Request {
      adminRole?: AdminRole;
    }
  }
}

/** Gate a route to the given roles. Use after requireAuth. */
export function requireRole(...roles: AdminRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: "unauthorized" }); return; }
    try {
      const role = await resolveAdminRole(req.user.userId);
      if (!role) {
        res.status(403).json({ error: "forbidden", message: "Admin access required" });
        return;
      }
      if (!roles.includes(role)) {
        res.status(403).json({ error: "forbidden", message: `This action needs ${roles.join(" or ")} access (you are ${role})` });
        return;
      }
      req.adminRole = role;
      next();
    } catch {
      res.status(500).json({ error: "internal_error", message: "Role check failed" });
    }
  };
}

/** Any admin tier. */
export const requireAnyAdmin = requireRole("superadmin", "manager", "support");
/** Manager and above. */
export const requireManager = requireRole("superadmin", "manager");
/** Critical switches + team management. */
export const requireSuperadmin = requireRole("superadmin");
