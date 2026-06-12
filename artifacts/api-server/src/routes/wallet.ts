import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { getTokenBalances, type CeloToken } from "../lib/celo-chain";
import { ensureUserWallet, getSendableProvider } from "../lib/wallet-providers";
import { getFeeSchedule } from "../lib/settings";
import { notifyUser } from "../lib/notify";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

const router = Router();

// Production-honest wallet: balances come from the Celo chain (USDC + USDT),
// history from the transactions table, sends are signed by the user's wallet
// provider (Privy / Coinbase CDP / Turnkey). New users see zero — never demo money.
//
// Cost rule: READ endpoints (balance, transactions, dashboard) never call the
// wallet provider — balances are keyless RPC reads, so browsing the app costs
// zero WaaS MAUs. Wallets are provisioned just-in-time by MONEY actions only
// (send, deposit-address request, withdrawal).

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
    if (!sender) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    // Money action → JIT-provision the sender's wallet if they don't have one yet
    const senderWallet = await ensureUserWallet(sender);
    if (!senderWallet) {
      res.status(503).json({ error: "not_configured", message: "Transfers are activating soon — your balance is safe and ready." });
      return;
    }
    const signer = await getSendableProvider(senderWallet.provider);
    if (!signer) {
      res.status(503).json({ error: "provider_disabled", message: "Transfers are briefly paused for maintenance. Your funds are safe — try again soon." });
      return;
    }

    // Resolve recipient: S-PAY phone number (P2P) or a raw Celo address
    let toAddress = recipientAddress?.trim() ?? "";
    let recipientUser: typeof sender | undefined;
    if (recipientPhone) {
      [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, recipientPhone.trim())).limit(1);
      if (!recipientUser) {
        res.status(404).json({ error: "recipient_not_found", message: "No S-PAY member with that phone number. Ask them to join — it's free!" });
        return;
      }
      // Receiving money is a money action too — JIT-provision the recipient
      const recipientWallet = await ensureUserWallet(recipientUser);
      if (!recipientWallet) {
        res.status(503).json({ error: "recipient_wallet_unavailable", message: "The recipient's wallet couldn't be prepared. Try again shortly." });
        return;
      }
      toAddress = recipientWallet.address;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
      res.status(400).json({ error: "validation_error", message: "Invalid recipient wallet address" });
      return;
    }

    const balances = await getTokenBalances(senderWallet.address);
    const available = token === "USDT" ? balances?.usdt ?? 0 : balances?.usdc ?? 0;
    const fees = await getFeeSchedule();
    const fee = amount * (fees.p2pFeePercent / 100);
    if (available < amount + fee) {
      res.status(400).json({ error: "insufficient_balance", message: `Insufficient ${token} balance` });
      return;
    }

    const txHash = await signer.sendToken(senderWallet, toAddress, token, amount);

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
        counterparty: sender.phoneNumber ?? senderWallet.address,
        status: "completed",
        txHash,
      });
      notifyUser(recipientUser.id, "Money received 💸", `${sender.fullName} sent you ${amount} ${token}. It's already in your balance.`);
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
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    // Asking for a deposit address is a money action — JIT-provision the wallet
    const wallet = await ensureUserWallet(user);
    if (wallet) {
      // Real deposits work today: any USDC/USDT sent on Celo to this address lands in the balance
      res.json({
        depositId: `dep-${crypto.randomUUID()}`,
        instructions: `Send USDC or USDT on the Celo network to your S-PAY address below. Funds appear in your balance within seconds. You can also withdraw to it from any exchange that supports Celo (Binance, Coinbase…).`,
        celoAddress: wallet.address,
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
