import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, count, desc, sql } from "drizzle-orm";

const router = Router();

// Comma-separated admin emails configured via env var
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "admin@spayewallet.com")
  .split(",").map((e) => e.trim().toLowerCase());

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "unauthorized" }); return; }
  if (!ADMIN_EMAILS.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ error: "forbidden", message: "Admin access required" });
    return;
  }
  next();
}

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [{ total: totalUsers }] = await db.select({ total: count() }).from(usersTable);
    const [{ total: pendingKyc }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.kycStatus, "pending"));
    const [{ total: approvedKyc }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.kycStatus, "approved"));
    const [{ total: rejectedKyc }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.kycStatus, "rejected"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [{ total: transactionsToday }] = await db.select({ total: count() }).from(transactionsTable)
      .where(sql`${transactionsTable.createdAt} >= ${today}`);

    const [volumeRow] = await db.select({
      volume: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
    }).from(transactionsTable);

    res.json({
      totalUsers,
      pendingKyc,
      approvedKyc,
      rejectedKyc,
      transactionsToday,
      totalTransactionVolume: parseFloat(volumeRow?.volume ?? "0"),
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch stats" });
  }
});

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const kycStatus = typeof req.query["kycStatus"] === "string" ? req.query["kycStatus"] : undefined;

    const baseQuery = db.select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      phoneNumber: usersTable.phoneNumber,
      kycStatus: usersTable.kycStatus,
      avatarUrl: usersTable.avatarUrl,
      createdAt: usersTable.createdAt,
    }).from(usersTable);

    const rows = await (
      kycStatus && ["pending", "approved", "rejected"].includes(kycStatus)
        ? baseQuery.where(eq(usersTable.kycStatus, kycStatus as "pending" | "approved" | "rejected"))
        : baseQuery
    ).orderBy(desc(usersTable.createdAt)).limit(200);

    const [{ total }] = await db.select({ total: count() }).from(usersTable);

    res.json({
      users: rows.map((u) => ({
        ...u,
        walletBalance: 0,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Admin users error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch users" });
  }
});

router.patch("/admin/users/:userId/kyc", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params["userId"]);
    const kycStatus = String((req.body as { kycStatus: string }).kycStatus);
    if (!["approved", "rejected", "pending"].includes(kycStatus)) {
      res.status(400).json({ error: "validation_error", message: "Invalid kycStatus" });
      return;
    }
    const [updated] = await db.update(usersTable)
      .set({ kycStatus: kycStatus as "pending" | "approved" | "rejected", updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, kycStatus: usersTable.kycStatus });
    if (!updated) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ success: true, userId: updated.id, kycStatus: updated.kycStatus });
  } catch (err) {
    req.log.error({ err }, "Admin KYC update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update KYC" });
  }
});

router.get("/admin/transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const type = typeof req.query["type"] === "string" ? req.query["type"] : undefined;

    const rows = await (
      type && ["send", "receive", "withdraw", "recharge", "payment"].includes(type)
        ? db.select().from(transactionsTable).where(eq(transactionsTable.type, type as any))
        : db.select().from(transactionsTable)
    ).orderBy(desc(transactionsTable.createdAt)).limit(200);

    const [{ total }] = await db.select({ total: count() }).from(transactionsTable);

    res.json({
      transactions: rows.map((t) => ({
        ...t,
        amount: parseFloat(String(t.amount)),
        createdAt: t.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Admin transactions error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch transactions" });
  }
});

// Returns which env vars are configured (not their values)
router.get("/admin/settings", requireAuth, requireAdmin, (req, res) => {
  const check = (key: string) => !!process.env[key];
  res.json({
    database: { configured: check("DATABASE_URL") },
    auth: {
      jwtConfigured: check("JWT_SECRET"),
      googleConfigured: check("GOOGLE_CLIENT_ID") && check("GOOGLE_CLIENT_SECRET"),
    },
    payments: {
      stripeConfigured: check("STRIPE_SECRET_KEY"),
      noahConfigured: check("NOAH_API_KEY"),
    },
    kyc: {
      smileIdConfigured: check("SMILE_ID_PARTNER_ID") && check("SMILE_ID_API_KEY"),
    },
    cors: {
      origin: process.env.CORS_ORIGIN ?? "(not set)",
    },
    adminEmails: ADMIN_EMAILS,
  });
});

export default router;
