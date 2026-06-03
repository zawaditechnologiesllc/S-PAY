import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { DEMO_BALANCE, DEMO_TRANSACTIONS } from "../lib/mock-data";

const router = Router();

router.get("/wallet/balance", requireAuth, (req, res) => {
  res.json(DEMO_BALANCE);
});

router.get("/wallet/transactions", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const transactions = DEMO_TRANSACTIONS.slice(offset, offset + limit).map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));
  res.json({
    transactions,
    total: DEMO_TRANSACTIONS.length,
    limit,
    offset,
  });
});

router.post("/wallet/send", requireAuth, (req, res) => {
  const { amount, currency, recipientPhone, recipientAddress, note } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "Invalid amount" });
    return;
  }
  if (amount > DEMO_BALANCE.balance) {
    res.status(400).json({ error: "insufficient_balance", message: "Insufficient wallet balance" });
    return;
  }
  const tx = {
    id: `tx-${crypto.randomUUID()}`,
    type: "send" as const,
    amount,
    currency: currency ?? "USD",
    description: note ?? `Sent to ${recipientPhone ?? recipientAddress ?? "recipient"}`,
    counterparty: recipientPhone ?? recipientAddress ?? "Unknown",
    status: "completed" as const,
    createdAt: new Date().toISOString(),
  };
  res.json(tx);
});

router.post("/wallet/add-funds", requireAuth, (req, res) => {
  const { amount, currency, method } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "Invalid amount" });
    return;
  }
  res.json({
    depositId: `dep-${crypto.randomUUID()}`,
    instructions: `Transfer $${amount} ${currency ?? "USD"} via ${method === "bank_transfer" ? "ACH bank transfer" : "card"} to fund your S-PAY wallet.`,
    accountNumber: "123456789",
    routingNumber: "021000021",
    amount,
    currency: currency ?? "USD",
  });
});

export default router;
