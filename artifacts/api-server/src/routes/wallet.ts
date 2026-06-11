import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getTokenBalances, sendToken, isOnchainSendConfigured, type CeloToken } from "../lib/celo-chain";
import { getFeeSchedule } from "../lib/settings";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

const router = Router();

// Production-honest wallet: balances come from the Celo chain (USDC + USDT),
// history from the transactions table, sends go on-chain via Privy.
// New users see zero — never demo money.

router.get("/wallet/balance", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (user?.celoWalletAddress) {
      const balances = await getTokenBalances(user.celoWalletAddress);
      if (balances) {
        res.json({
          balance: balances.total,
          availableBalance: balances.total,
          currency: "USD",
          celoAddress: user.celoWalletAddress,
          usdcBalance: balances.usdc,
          usdtBalance: balances.usdt,
        });
        return;
      }
    }
    res.json({
      balance: 0,
      availableBalance: 0,
      currency: "USD",
      celoAddress: user?.celoWalletAddress ?? undefined,
      usdcBalance: 0,
      usdtBalance: 0,
    });
  } catch (err) {
    req.log.error({ err }, "Wallet balance error");
    res.status(500).json({ error: "internal_error", message: "Failed to load balance" });
  }
});

router.get("/wallet/transactions", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const userId = req.user!.userId;

    const rows = await db.select().from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(transactionsTable)
      .where(eq(transactionsTable.userId, userId));

    res.json({
      transactions: rows.map((t) => ({
        ...t,
        amount: parseFloat(String(t.amount)),
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    req.log.error({ err }, "Wallet transactions error");
    res.status(500).json({ error: "internal_error", message: "Failed to load transactions" });
  }
});

router.post("/wallet/send", requireAuth, async (req, res) => {
  try {
    const { amount, currency, recipientPhone, recipientAddress, note } = req.body as {
      amount?: number; currency?: string; recipientPhone?: string; recipientAddress?: string; note?: string;
    };
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid amount" });
      return;
    }
    if (!recipientPhone && !recipientAddress) {
      res.status(400).json({ error: "validation_error", message: "Provide a recipient phone number or wallet address" });
      return;
    }
    const token: CeloToken = currency?.toUpperCase() === "USDT" ? "USDT" : "USDC";

    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!sender?.celoWalletAddress || !sender.privyWalletId) {
      res.status(503).json({ error: "wallet_pending", message: "Your wallet is still being set up. Try again shortly." });
      return;
    }
    if (!isOnchainSendConfigured()) {
      res.status(503).json({ error: "not_configured", message: "Transfers are activating soon — your balance is safe and ready." });
      return;
    }

    // Resolve recipient: S-PAY phone number (P2P) or a raw Celo address
    let toAddress = recipientAddress?.trim() ?? "";
    let recipientUser: typeof sender | undefined;
    if (recipientPhone) {
      [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, recipientPhone.trim())).limit(1);
      if (!recipientUser?.celoWalletAddress) {
        res.status(404).json({ error: "recipient_not_found", message: "No S-PAY member with that phone number. Ask them to join — it's free!" });
        return;
      }
      toAddress = recipientUser.celoWalletAddress;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
      res.status(400).json({ error: "validation_error", message: "Invalid recipient wallet address" });
      return;
    }

    const balances = await getTokenBalances(sender.celoWalletAddress);
    const available = token === "USDT" ? balances?.usdt ?? 0 : balances?.usdc ?? 0;
    const fees = await getFeeSchedule();
    const fee = amount * (fees.p2pFeePercent / 100);
    if (available < amount + fee) {
      res.status(400).json({ error: "insufficient_balance", message: `Insufficient ${token} balance` });
      return;
    }

    const txHash = await sendToken(sender.privyWalletId, toAddress, token, amount);

    const description = note?.trim() || `Sent to ${recipientPhone ?? `${toAddress.slice(0, 6)}…${toAddress.slice(-4)}`}`;
    const [tx] = await db.insert(transactionsTable).values({
      userId: sender.id,
      type: "send",
      amount: String(amount),
      currency: token,
      description,
      counterparty: recipientPhone ?? toAddress,
      status: "completed",
      txHash,
    }).returning();

    // P2P inside S-PAY: give the recipient their matching history entry
    if (recipientUser) {
      await db.insert(transactionsTable).values({
        userId: recipientUser.id,
        type: "receive",
        amount: String(amount),
        currency: token,
        description: `Received from ${sender.fullName}`,
        counterparty: sender.phoneNumber ?? sender.celoWalletAddress,
        status: "completed",
        txHash,
      });
    }

    res.json({
      id: tx.id,
      type: "send",
      amount,
      currency: token,
      description,
      counterparty: tx.counterparty,
      status: "completed",
      txHash,
      createdAt: tx.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Wallet send error");
    res.status(500).json({ error: "send_failed", message: "Transfer failed. Your funds were not moved — please try again." });
  }
});

router.post("/wallet/add-funds", requireAuth, async (req, res) => {
  try {
    const { amount, currency } = req.body as { amount?: number; currency?: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);

    if (user?.celoWalletAddress) {
      // Real deposits work today: any USDC/USDT sent on Celo to this address lands in the balance
      res.json({
        depositId: `dep-${crypto.randomUUID()}`,
        instructions: `Send USDC or USDT on the Celo network to your S-PAY address below. Funds appear in your balance within seconds. You can also withdraw to it from any exchange that supports Celo (Binance, Coinbase…).`,
        celoAddress: user.celoWalletAddress,
        network: "Celo",
        amount: amount ?? 0,
        currency: currency ?? "USDC",
      });
      return;
    }
    res.status(503).json({ error: "wallet_pending", message: "Your wallet is still being set up. Try again shortly." });
  } catch (err) {
    req.log.error({ err }, "Add funds error");
    res.status(500).json({ error: "internal_error", message: "Failed to create deposit instructions" });
  }
});

export default router;
