import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getFeeSchedule, withdrawalFee } from "../lib/settings";
import { ensureUserWallet } from "../lib/wallet-providers";
import { getTokenBalances } from "../lib/celo-chain";
import {
  selectPayoutProvider, selectDepositProvider, selectVirtualAccountIssuer,
  accountTypeForCurrency,
} from "../lib/payout-providers";
import { verifyTransactionPin } from "../lib/pin";
import { notifyUser } from "../lib/notify";
import { db, usersTable, virtualAccountsTable, transactionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

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

// Virtual accounts (US ACH / EU IBAN). A virtual account is an *entry point*,
// not a balance: fiat that lands in it is auto-converted to USDC and settled to
// the user's own Celo wallet (the single balance). So this lists account details
// to receive into and always reports totalBalance 0 — the spendable balance is
// the on-chain USDC, surfaced by /wallet/balance.
//
// Sticky single issuer, presented generically: an account is issued once by the
// admin-designated provider and never re-branded. Until that provider's key is
// live, provisioning returns an honest 503 and this list stays empty — never a
// fake routing number someone might hand to an employer.
function serializeAccount(a: typeof virtualAccountsTable.$inferSelect) {
  return {
    id: a.id,
    currency: a.currency,
    accountType: a.accountType,
    country: a.country,
    holderName: a.holderName,
    bankName: a.bankName,
    accountNumberMasked: a.accountNumberMasked,
    routingNumber: a.routingNumber,
    ibanMasked: a.ibanMasked,
    status: a.status,
    // label is generic on purpose — never "Noah account" / "Bridge account"
    label: `Your ${a.currency} account`,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/banking/accounts", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(virtualAccountsTable)
      .where(and(eq(virtualAccountsTable.userId, req.user!.userId), eq(virtualAccountsTable.status, "active")));
    res.json({ accounts: rows.map(serializeAccount), totalBalance: 0 });
  } catch (err) {
    req.log.error({ err }, "List virtual accounts error");
    res.status(500).json({ error: "internal_error", message: "Failed to load your accounts" });
  }
});

// Provision (or return the existing) virtual account for a currency. KYC/KYB-gated
// and sticky: one active account per user+currency, issued by the designated
// provider. Honest 503 until that provider's key is configured.
router.post("/banking/accounts", requireAuth, async (req, res) => {
  try {
    const currency = String((req.body as { currency?: string }).currency ?? "USD").toUpperCase();
    if (!["USD", "EUR"].includes(currency)) {
      res.status(400).json({ error: "validation_error", message: "currency must be USD or EUR" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    if (user.kycStatus !== "approved") {
      res.status(403).json({ error: "kyc_required", message: "Complete identity verification (KYC/KYB) before opening a bank account." });
      return;
    }

    // Sticky: return the existing account instead of issuing a second one.
    const [existing] = await db.select().from(virtualAccountsTable)
      .where(and(eq(virtualAccountsTable.userId, user.id), eq(virtualAccountsTable.currency, currency), eq(virtualAccountsTable.status, "active")))
      .limit(1);
    if (existing) {
      res.json({ account: serializeAccount(existing), created: false });
      return;
    }

    const issuer = await selectVirtualAccountIssuer(currency);
    if (!issuer) {
      res.status(503).json({
        error: "not_configured",
        message: "Bank accounts are activating soon. We'll open yours the moment our banking partner is live.",
      });
      return;
    }

    // Business accounts present the company name on the account.
    const holderName = user.accountType === "business" && user.businessName ? user.businessName : user.fullName;

    let details;
    try {
      details = await issuer.createVirtualAccount({ userId: user.id, currency, holderName, country: user.country ?? undefined });
    } catch {
      req.log.info({ issuer: issuer.key, currency }, "Virtual account requested — issuer not configured");
      res.status(503).json({ error: "not_configured", message: "Bank accounts are being finalized with our banking partner." });
      return;
    }

    const [created] = await db.insert(virtualAccountsTable).values({
      userId: user.id,
      provider: details.provider,
      externalId: details.externalId ?? null,
      currency: details.currency.toUpperCase(),
      accountType: details.accountType ?? accountTypeForCurrency(currency),
      country: details.country ?? null,
      holderName: details.holderName,
      bankName: details.bankName ?? null,
      accountNumberMasked: details.accountNumberMasked ?? null,
      routingNumber: details.routingNumber ?? null,
      ibanMasked: details.ibanMasked ?? null,
    }).returning();

    req.log.info({ issuer: issuer.key, currency, userId: user.id }, "Virtual account provisioned");
    res.status(201).json({ account: serializeAccount(created), created: true });
  } catch (err) {
    req.log.error({ err }, "Provision virtual account error");
    res.status(500).json({ error: "internal_error", message: "Could not open your account" });
  }
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
  try {
    const { amount, targetCurrency, method, pin, recipientPhone, recipientIban, recipientTaxId, recipientAccount } = req.body as {
      amount?: number; targetCurrency?: string; method?: string; pin?: string;
      recipientPhone?: string; recipientIban?: string; recipientTaxId?: string; recipientAccount?: string;
    };
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid amount" });
      return;
    }
    if (!method) {
      res.status(400).json({ error: "validation_error", message: "Withdrawal method is required" });
      return;
    }
    const recipient = (recipientPhone ?? recipientIban ?? recipientTaxId ?? recipientAccount ?? "").trim();
    if (!recipient) {
      res.status(400).json({ error: "validation_error", message: "Recipient details are required" });
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
    // User-facing fee from the admin-set schedule (provider cost + S-PAY margin).
    const fee = withdrawalFee(amount, await getFeeSchedule());
    if (amount <= fee) {
      res.status(400).json({ error: "validation_error", message: `Amount must be above the ${fee.toFixed(2)} USDC fee.` });
      return;
    }

    // The cash-out debits the user's on-chain balance — verify it covers the amount.
    const balances = await getTokenBalances(wallet.address);
    if ((balances?.usdc ?? 0) < amount) {
      res.status(400).json({ error: "insufficient_balance", message: `Insufficient USDC balance (${(balances?.usdc ?? 0).toFixed(2)} available).` });
      return;
    }

    // Execute on the routed rail. A provider whose keys aren't live throws its
    // NotConfiguredError → the same honest 503; no record is written and no
    // funds move. When the rail IS live, createPayout returns the provider's
    // payout id and settlement instructions handle the on-chain debit.
    const reference = `wdw-${crypto.randomUUID()}`;
    let payout;
    try {
      payout = await payoutProvider.createPayout({
        amountUsd: amount - fee,
        targetCurrency: String(targetCurrency ?? "USD"),
        method: String(method),
        destination: {
          ...(recipientPhone ? { phoneNumber: recipientPhone.trim() } : {}),
          ...(recipientIban ? { iban: recipientIban.trim() } : {}),
          ...(recipientTaxId ? { taxId: recipientTaxId.trim() } : {}),
          ...(recipientAccount ? { accountNumber: recipientAccount.trim() } : {}),
        },
        reference,
      });
    } catch {
      req.log.info({ provider: payoutProvider.key, targetCurrency, method }, "Withdrawal requested — provider not configured");
      res.status(503).json({
        error: "not_configured",
        message: "Local cash-outs are activating soon. Your balance stays safe in your wallet until then.",
      });
      return;
    }

    // The chosen rail is an internal routing decision — log it for reconciliation,
    // but never surface it to the user (they just get the best rate).
    req.log.info({ provider: payoutProvider.key, targetCurrency, method, payoutId: payout.payoutId }, "Withdrawal routed");

    const localAmount = Math.max(amount - fee, 0) * rate;
    const [tx] = await db.insert(transactionsTable).values({
      userId: user.id,
      type: "withdraw",
      amount: String(amount),
      currency: "USDC",
      description: `Withdrawal to ${String(method)} — ${localAmount.toFixed(2)} ${String(targetCurrency ?? "USD")}`,
      counterparty: recipient,
      status: payout.status === "completed" ? "completed" : payout.status === "failed" ? "failed" : "pending",
    }).returning();

    notifyUser(user.id, "Withdrawal started 🏦", `${amount.toFixed(2)} USDC is on its way to ${recipient}. ${METHOD_ARRIVAL[String(method)] ?? "Arriving in 1–2 business days"}.`);

    res.json({
      withdrawalId: payout.payoutId,
      transactionId: tx.id,
      status: payout.status,
      estimatedArrival: METHOD_ARRIVAL[String(method)] ?? "1–2 business days",
      localAmount,
      localCurrency: targetCurrency ?? "USD",
      fee,
    });
  } catch (err) {
    req.log.error({ err }, "Withdrawal error");
    res.status(500).json({ error: "internal_error", message: "Could not start the withdrawal. Your funds were not moved." });
  }
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
      // The chosen rail is internal — log it, don't surface it to the user.
      req.log.info({ provider: deposit.provider, method, sourceCurrency }, "Deposit routed");
      res.json({
        depositId: deposit.depositId,
        status: deposit.status,
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
