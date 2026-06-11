import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getTokenBalances } from "../lib/celo-chain";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// Production-honest dashboard: live Celo balance + real transaction history.
router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    let walletBalance = 0;
    if (user?.celoWalletAddress) {
      const balances = await getTokenBalances(user.celoWalletAddress);
      if (balances) walletBalance = balances.total;
    }

    const recent = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(5);

    const [sums] = await db.select({
      incoming: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} IN ('receive','recharge') THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)`,
      outgoing: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} NOT IN ('receive','recharge') THEN ${transactionsTable.amount}::numeric ELSE 0 END), 0)`,
      monthCount: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.createdAt} >= date_trunc('month', now()))`,
    }).from(transactionsTable).where(eq(transactionsTable.userId, userId));

    const totalIncoming = parseFloat(sums?.incoming ?? "0");
    const totalOutgoing = parseFloat(sums?.outgoing ?? "0");

    res.json({
      walletBalance,
      availableBalance: walletBalance,
      currency: "USD",
      totalIncoming,
      totalOutgoing,
      recentTransactions: recent.map((t) => ({
        ...t,
        amount: parseFloat(String(t.amount)),
        createdAt: t.createdAt.toISOString(),
      })),
      quickStats: {
        transactionsThisMonth: Number(sums?.monthCount ?? 0),
        totalSent: totalOutgoing,
        totalReceived: totalIncoming,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard summary error");
    res.status(500).json({ error: "internal_error", message: "Failed to load dashboard" });
  }
});

export default router;
