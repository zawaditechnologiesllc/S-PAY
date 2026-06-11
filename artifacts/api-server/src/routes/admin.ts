import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { isCardProgramEnabled, setCardProgramEnabled } from "../lib/settings";
import { isStripeConfigured } from "../lib/stripe-issuing";
import { db, usersTable, transactionsTable, cardWaitlistTable } from "@workspace/db";
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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ total: activeUsers }] = await db.select({ total: count() }).from(usersTable)
      .where(sql`${usersTable.createdAt} >= ${thirtyDaysAgo}`);

    // Acquisition breakdown: where signups come from (jobs, landing, google, direct…)
    const sourceRows = await db.select({
      source: sql<string>`COALESCE(${usersTable.signupSource}, 'unknown')`,
      total: count(),
    }).from(usersTable).groupBy(sql`COALESCE(${usersTable.signupSource}, 'unknown')`);
    const signupsBySource: Record<string, number> = {};
    for (const row of sourceRows) {
      // Collapse "jobs:rv-123" style sources into their channel for the summary
      const channel = row.source.split(":")[0] || "unknown";
      signupsBySource[channel] = (signupsBySource[channel] ?? 0) + row.total;
    }

    res.json({
      totalUsers,
      activeUsers,
      pendingKyc,
      approvedKyc,
      rejectedKyc,
      transactionsToday,
      totalTransactionVolume: parseFloat(volumeRow?.volume ?? "0"),
      totalWalletBalance: 0,
      signupsBySource,
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
      signupSource: usersTable.signupSource,
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

// ─── Feature flags: the admin master switches ─────────────────────────────────

async function featureFlagsPayload() {
  const [cardProgramEnabled, [{ total: cardWaitlistCount }]] = await Promise.all([
    isCardProgramEnabled(),
    db.select({ total: count() }).from(cardWaitlistTable),
  ]);
  return { cardProgramEnabled, stripeConfigured: isStripeConfigured(), cardWaitlistCount };
}

router.get("/admin/feature-flags", requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await featureFlagsPayload());
  } catch (err) {
    req.log.error({ err }, "Feature flags read error");
    res.status(500).json({ error: "internal_error", message: "Failed to read feature flags" });
  }
});

router.put("/admin/feature-flags", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { cardProgramEnabled } = req.body as { cardProgramEnabled?: unknown };
    if (typeof cardProgramEnabled !== "boolean") {
      res.status(400).json({ error: "validation_error", message: "cardProgramEnabled must be a boolean" });
      return;
    }
    await setCardProgramEnabled(cardProgramEnabled);
    req.log.info({ cardProgramEnabled, admin: req.user!.email }, "Card program switch changed");
    res.json(await featureFlagsPayload());
  } catch (err) {
    req.log.error({ err }, "Feature flags update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update feature flags" });
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
    noah: {
      configured: check("NOAH_API_KEY"),
      webhookConfigured: check("NOAH_WEBHOOK_SECRET"),
    },
    stripe: {
      configured: check("STRIPE_SECRET_KEY"),
      webhookConfigured: check("STRIPE_WEBHOOK_SECRET"),
    },
    cors: {
      origin: process.env.CORS_ORIGIN ?? "(not set)",
    },
    adminEmails: ADMIN_EMAILS,
  });
});

export default router;
