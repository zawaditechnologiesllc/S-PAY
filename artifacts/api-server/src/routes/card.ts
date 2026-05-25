import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { DEMO_CARD, DEMO_CARD_TRANSACTIONS, DEMO_SPENDING_SUMMARY } from "../lib/mock-data";

const router = Router();

const waitlistStore = new Set<string>();

router.get("/card/details", requireAuth, (req, res) => {
  res.json(DEMO_CARD);
});

router.get("/card/transactions", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const transactions = DEMO_CARD_TRANSACTIONS.slice(0, limit).map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));
  res.json({ transactions, total: DEMO_CARD_TRANSACTIONS.length });
});

router.get("/card/spending-summary", requireAuth, (req, res) => {
  res.json(DEMO_SPENDING_SUMMARY);
});

router.post("/card/waitlist", requireAuth, (req, res) => {
  const { userId } = req.user!;
  if (waitlistStore.has(userId)) {
    res.json({ message: "You are already on the waitlist. We will notify you when the card launches." });
    return;
  }
  waitlistStore.add(userId);
  res.json({ message: "You are on the list. We will notify you when the S-PAY virtual card launches." });
});

export default router;
