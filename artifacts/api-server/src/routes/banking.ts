import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { DEMO_BANK_ACCOUNTS, DEMO_INCOMING_PAYMENTS } from "../lib/mock-data";

const router = Router();

// Indicative FX rates for every advertised payout corridor (stablecoin base).
// Replaced by live Noah quotes once NOAH_API_KEY is configured.
const PAYOUT_RATES: Record<string, number> = {
  KES: 131.5,   // Kenya, Tanzania — M-Pesa
  NGN: 1610.0,  // Nigeria — bank transfer
  GHS: 15.4,    // Ghana — MTN MoMo
  UGX: 3720.0,  // Uganda — Mobile Money
  TZS: 2660.0,  // Tanzania — M-Pesa
  RWF: 1380.0,  // Rwanda — MoMo
  XAF: 600.0,   // Cameroon — MTN MoMo
  ZAR: 18.2,    // South Africa — bank transfer
  PHP: 58.5,    // Philippines — GCash
  IDR: 16200.0, // Indonesia — GoPay
  BRL: 5.1,     // Brazil — PIX
  COP: 4150.0,  // Colombia — Nequi
  MXN: 18.6,    // Mexico — SPEI
  EUR: 0.92,    // EU/EEA — SEPA
  GBP: 0.79,    // UK — Faster Payments
  USD: 1.0,     // USA / international — ACH & wire
};

const METHOD_ARRIVAL: Record<string, string> = {
  mpesa: "Within 1 minute",
  mtn_momo: "Within 1 minute",
  momo: "Within 1 minute",
  gcash: "Within 1 minute",
  gopay: "Within 1 minute",
  nequi: "Within 5 minutes",
  pix: "Within 1 minute",
  spei: "Same day",
  faster_payments: "Within 2 hours",
  sepa: "Same day – next business day",
  bank_transfer: "1–2 business days",
  ach: "1–2 business days",
  wire: "1–2 business days",
};

// USDC/USDT/USD are all 1:1 USD-equivalents before local FX conversion
function lookupRate(target: string | undefined): number {
  if (!target) return 1.0;
  return PAYOUT_RATES[target.toUpperCase()] ?? 1.0;
}

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
  const { source, target, method } = req.query as { source: string; target: string; method?: string };
  if (!source || !target) {
    res.status(400).json({ error: "validation_error", message: "source and target currency are required" });
    return;
  }
  res.json({
    source,
    target,
    rate: lookupRate(target),
    fee: 0.005,
    estimatedArrival: METHOD_ARRIVAL[method ?? ""] ?? "Within 2 hours",
  });
});

router.post("/banking/withdraw", requireAuth, (req, res) => {
  const { amount, targetCurrency, method } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "Invalid amount" });
    return;
  }
  if (!method) {
    res.status(400).json({ error: "validation_error", message: "Withdrawal method is required" });
    return;
  }

  const rate = lookupRate(targetCurrency);
  const fee = amount * 0.005;

  res.json({
    withdrawalId: `wdw-${crypto.randomUUID()}`,
    status: "pending",
    estimatedArrival: METHOD_ARRIVAL[String(method)] ?? "1–2 business days",
    localAmount: (amount - fee) * rate,
    localCurrency: targetCurrency ?? "USD",
    fee,
  });
});

export default router;
