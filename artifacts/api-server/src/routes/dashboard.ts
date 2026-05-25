import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { DEMO_BALANCE, DEMO_TRANSACTIONS } from "../lib/mock-data";

const router = Router();

router.get("/dashboard/summary", requireAuth, (req, res) => {
  const recentTransactions = DEMO_TRANSACTIONS.slice(0, 5).map((t) => ({
    ...t,
    amount: t.type === "receive" ? t.amount : -t.amount,
    createdAt: t.createdAt.toISOString(),
  }));

  const totalIncoming = DEMO_TRANSACTIONS.filter((t) => t.type === "receive").reduce((sum, t) => sum + t.amount, 0);
  const totalOutgoing = DEMO_TRANSACTIONS.filter((t) => t.type !== "receive").reduce((sum, t) => sum + t.amount, 0);

  res.json({
    walletBalance: DEMO_BALANCE.balance,
    availableBalance: DEMO_BALANCE.availableBalance,
    currency: "USD",
    totalIncoming,
    totalOutgoing,
    recentTransactions,
    quickStats: {
      transactionsThisMonth: DEMO_TRANSACTIONS.length,
      totalSent: totalOutgoing,
      totalReceived: totalIncoming,
    },
  });
});

export default router;
