import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { DEMO_BANK_ACCOUNTS, DEMO_INCOMING_PAYMENTS } from "../lib/mock-data";

const router = Router();

router.get("/banking/accounts", requireAuth, (req, res) => {
  const totalBalance = DEMO_BANK_ACCOUNTS.reduce((sum, a) => sum + a.availableBalance, 0);
  res.json({ accounts: DEMO_BANK_ACCOUNTS, totalBalance });
});

router.get("/banking/incoming-payments", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const payments = DEMO_INCOMING_PAYMENTS.slice(offset, offset + limit).map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));
  res.json({ payments, total: DEMO_INCOMING_PAYMENTS.length });
});

router.get("/banking/rates", requireAuth, async (req, res) => {
  const { source, target } = req.query as { source: string; target: string };
  if (!source || !target) {
    res.status(400).json({ error: "validation_error", message: "source and target currency are required" });
    return;
  }
  const mockRates: Record<string, number> = {
    "USDC-KES": 131.5,
    "USDC-NGN": 1610.0,
    "USDC-GHS": 15.4,
    "USDC-EUR": 0.92,
    "USDC-GBP": 0.79,
    "USDC-BRL": 5.1,
    "USDC-USD": 1.0,
    "USDT-KES": 131.5,
    "USDT-NGN": 1610.0,
  };
  const rateKey = `${source}-${target}`;
  const rate = mockRates[rateKey] ?? 1.0;
  res.json({
    source,
    target,
    rate,
    fee: 0.005,
    estimatedArrival: "Within 2 hours",
  });
});

router.post("/banking/withdraw", requireAuth, (req, res) => {
  const { amount, sourceCurrency, targetCurrency, method, recipientPhone, recipientIban } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "Invalid amount" });
    return;
  }
  if (!method) {
    res.status(400).json({ error: "validation_error", message: "Withdrawal method is required" });
    return;
  }

  const mockRates: Record<string, number> = {
    "USDC-KES": 131.5, "USDC-NGN": 1610.0, "USDC-EUR": 0.92, "USDC-GBP": 0.79,
  };
  const rateKey = `${sourceCurrency ?? "USDC"}-${targetCurrency}`;
  const rate = mockRates[rateKey] ?? 1.0;
  const fee = amount * 0.005;

  res.json({
    withdrawalId: `wdw-${crypto.randomUUID()}`,
    status: "pending",
    estimatedArrival: method === "mpesa" ? "Within 5 minutes" : method === "sepa" ? "1-2 business days" : "2-3 business days",
    localAmount: (amount - fee) * rate,
    localCurrency: targetCurrency ?? "USD",
    fee,
  });
});

export default router;
