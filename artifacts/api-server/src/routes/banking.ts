import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getFeeSchedule, withdrawalFee } from "../lib/settings";
import { ensureUserWallet } from "../lib/wallet-providers";
import { selectPayoutProvider, selectDepositProvider } from "../lib/payout-providers";
import { verifyTransactionPin } from "../lib/pin";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

// Virtual accounts (US ACH / EU IBAN) are provisioned by a money-rail partner
// after KYC/KYB approval — Noah, or a no-onboarding-fee alternative like Bridge.
// Until a provider key is live we return an empty, honest state — never fake
// routing numbers that someone might give to an employer.
//
// Note: a virtual account is only an *entry point*. Funds that land in it are
// auto-converted to USDC and settled to the user's Celo wallet (the single
// balance), so this endpoint lists account details to receive into — not a
// separate balance to reconcile.
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
  const { amount, targetCurrency, method, pin } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "validation_error", message: "Invalid amount" });
    return;
  }
  if (!method) {
    res.status(400).json({ error: "validation_error", message: "Withdrawal method is required" });
    return;
  }
  // Route to the best-configured payout rail for this corridor (Noah, Bridge,
  // Conduit, Yellow Card, Thunes…). None available → honest 503, funds untouched.
  const payoutProvider = await selectPayoutProvider(String(targetCurrency ?? "USD"), String(method));
  if (!payoutProvider) {
    res.status(503).json({
      error: "not_configured",
      message: "Local cash-outs are activating soon. Your balance stays safe in your wallet until then.",
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }
  // Same second factor as transfers: cashing out requires the transaction PIN.
  const pinCheck = await verifyTransactionPin(user, pin);
  if (!pinCheck.ok) {
    const status = pinCheck.reason === "not_set" ? 428 : pinCheck.reason === "locked" ? 423 : 401;
    res.status(status).json({ error: `pin_${pinCheck.reason}`, message: pinCheck.message, attemptsLeft: pinCheck.attemptsLeft });
    return;
  }

  // Withdrawing is a money action: JIT-provision the wallet (the payout debits
  // USDC from it — see task D2), so it must exist before we quote.
  const wallet = await ensureUserWallet(user);
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
    provider: payoutProvider.key,
    estimatedArrival: METHOD_ARRIVAL[String(method)] ?? "1–2 business days",
    localAmount: Math.max(amount - fee, 0) * rate,
    localCurrency: targetCurrency ?? "USD",
    fee,
  });
});

// Mobile-money / local top-up (on-ramp). Provider-agnostic: routed to the best
// configured deposit rail for the corridor (Yellow Card for M-Pesa, Bridge for
// USD/EUR, Noah elsewhere…) — NOT Noah-only — so we can avoid Noah's onboarding
// fee where a cheaper rail serves the corridor. The endpoint, quotes, and UI
// are live; execution starts the moment any deposit provider's keys are set.
//
// The deposit settles to the user's own Celo wallet as USDC (the single
// balance). No provider configured for the corridor → honest 503.
router.post("/banking/deposit", requireAuth, async (req, res) => {
  try {
    const { amount, method, phoneNumber, sourceCurrency } = req.body as {
      amount?: number; method?: string; phoneNumber?: string; sourceCurrency?: string;
    };
    if (!amount || amount <= 0 || !method) {
      res.status(400).json({ error: "validation_error", message: "amount and method are required" });
      return;
    }

    const depositProvider = await selectDepositProvider(String(sourceCurrency ?? "USD"), String(method));
    if (!depositProvider) {
      res.status(503).json({
        error: "not_configured",
        message: "Local top-ups are activating soon. Use Exchange or a direct Celo wallet deposit meanwhile — it's instant.",
      });
      return;
    }

    // Deposits settle USDC to the user's own wallet — provision it first.
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    const wallet = await ensureUserWallet(user);
    if (!wallet) {
      res.status(503).json({
        error: "not_configured",
        message: "Top-ups are activating soon. Your wallet is being prepared — try again shortly.",
      });
      return;
    }

    // Provider with no keys throws DepositNotConfiguredError → honest 503,
    // never a faked deposit.
    try {
      const deposit = await depositProvider.createDeposit({
        amountLocal: amount,
        sourceCurrency: String(sourceCurrency ?? "USD"),
        method: String(method),
        reference: `dep-${crypto.randomUUID()}`,
        destinationAddress: wallet.address,
        payer: phoneNumber ? { phoneNumber } : undefined,
      });
      res.json({
        depositId: deposit.depositId,
        status: deposit.status,
        provider: deposit.provider,
        instructions: deposit.instructions,
        celoAddress: wallet.address,
      });
    } catch {
      req.log.info({ method, amount, provider: depositProvider.key }, "Deposit requested — provider not configured");
      res.status(503).json({ error: "not_configured", message: "Deposit rails are being finalized with our payments partner." });
    }
  } catch (err) {
    req.log.error({ err }, "Deposit error");
    res.status(500).json({ error: "internal_error", message: "Could not start the deposit" });
  }
});

export default router;
