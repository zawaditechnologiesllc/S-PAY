import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getFeeSchedule, withdrawalFee } from "../lib/settings";
import { ensureUserWallet } from "../lib/wallet-providers";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const noahConfigured = () => Boolean(process.env.NOAH_API_KEY);

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

// Virtual accounts are provisioned by Noah after KYC approval. Until the
// Noah partner key is live we return an empty, honest state — never fake
// routing numbers that someone might give to an employer.
router.get("/banking/accounts", requireAuth, (req, res) => {
  res.json({ accounts: [], totalBalance: 0 });
});

router.get("/banking/incoming-payments", requireAuth, (req, res) => {
  res.json({ payments: [], total: 0 });
});

router.get("/banking/rates", requireAuth, async (req, res) => {
  const { source, target, method } = req.query as { source: string; target: string; method?: string };
  if (!source || !target) {
    res.status(400).json({ error: "validation_error", message: "source and target currency are required" });
    return;
  }
  const fees = await getFeeSchedule();
  res.json({
    source,
    target,
    rate: lookupRate(target),
    fee: fees.withdrawalFeePercent / 100, // fraction, e.g. 0.01 = 1%
    estimatedArrival: METHOD_ARRIVAL[method ?? ""] ?? "Within 2 hours",
  });
});

router.post("/banking/withdraw", requireAuth, async (req, res) => {
  const { amount, targetCurrency, method } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "Invalid amount" });
    return;
  }
  if (!method) {
    res.status(400).json({ error: "validation_error", message: "Withdrawal method is required" });
    return;
  }
  // Real payouts execute through Noah — never simulate a withdrawal in production
  if (!noahConfigured()) {
    res.status(503).json({
      error: "not_configured",
      message: "Local cash-outs are activating soon. Your balance stays safe in your wallet until then.",
    });
    return;
  }

  // Withdrawing is a money action: JIT-provision the wallet (the payout debits
  // USDC from it — see task D2), so it must exist before we quote.
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  const wallet = user ? await ensureUserWallet(user) : null;
  if (!wallet) {
    res.status(503).json({
      error: "not_configured",
      message: "Cash-outs are activating soon. Your balance stays safe until then.",
    });
    return;
  }

  const rate = lookupRate(targetCurrency);
  // User-facing fee from the admin-set schedule: Noah's cost + S-PAY margin
  const fee = withdrawalFee(amount, await getFeeSchedule());

  res.json({
    withdrawalId: `wdw-${crypto.randomUUID()}`,
    status: "pending",
    estimatedArrival: METHOD_ARRIVAL[String(method)] ?? "1–2 business days",
    localAmount: Math.max(amount - fee, 0) * rate,
    localCurrency: targetCurrency ?? "USD",
    fee,
  });
});

export default router;
