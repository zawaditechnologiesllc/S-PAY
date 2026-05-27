import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { ADMIN_STATS, MOCK_USERS, MOCK_ALL_TRANSACTIONS } from "../lib/mock-data";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "unauthorized" }); return; }
  const adminEmails = ["admin@spayewallet.com", "demo@spayewallet.com"];
  if (!adminEmails.includes(req.user.email)) {
    res.status(403).json({ error: "forbidden", message: "Admin access required" });
    return;
  }
  next();
}

const kycOverrides = new Map<string, string>();

router.get("/admin/stats", requireAuth, requireAdmin, (req, res) => {
  res.json(ADMIN_STATS);
});

router.get("/admin/users", requireAuth, requireAdmin, (req, res) => {
  const kycStatus = typeof req.query["kycStatus"] === "string" ? req.query["kycStatus"] : undefined;
  let users = MOCK_USERS.map((u) => ({
    ...u,
    kycStatus: kycOverrides.get(u.id) ?? u.kycStatus,
    createdAt: u.createdAt.toISOString(),
  }));
  if (kycStatus) {
    users = users.filter((u) => u.kycStatus === kycStatus);
  }
  res.json({ users, total: MOCK_USERS.length });
});

router.patch("/admin/users/:userId/kyc", requireAuth, requireAdmin, (req, res) => {
  const userId = String(req.params["userId"]);
  const kycStatus = String((req.body as { kycStatus: string }).kycStatus);
  if (!["approved", "rejected", "pending"].includes(kycStatus)) {
    res.status(400).json({ error: "validation_error", message: "Invalid kycStatus" });
    return;
  }
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) { res.status(404).json({ error: "not_found" }); return; }
  kycOverrides.set(userId, kycStatus);
  res.json({ success: true, userId, kycStatus });
});

router.get("/admin/transactions", requireAuth, requireAdmin, (req, res) => {
  const type = typeof req.query["type"] === "string" ? req.query["type"] : undefined;
  let txs = MOCK_ALL_TRANSACTIONS.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));
  if (type) txs = txs.filter((t) => t.type === type);
  res.json({ transactions: txs, total: MOCK_ALL_TRANSACTIONS.length });
});

export default router;
