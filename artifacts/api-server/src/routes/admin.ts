import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  isCardProgramEnabled, setCardProgramEnabled,
  getMaintenance, setMaintenance,
  getSiteContent, setSiteContent, type SiteContent,
  getFeeSchedule, setFeeSchedule, type FeeSchedule,
  getWalletProviderConfig, setWalletProviderConfig,
  WALLET_PROVIDER_KEYS, type WalletProviderKey,
  getPayoutProviderConfig, setPayoutProviderConfig,
  PAYOUT_PROVIDER_KEYS, type PayoutProviderKey,
  getSocialConnect, setSocialConnectEnabled,
} from "../lib/settings";
import { walletProviderCatalog } from "../lib/wallet-providers";
import { payoutProviderCatalog } from "../lib/payout-providers";
import { isSocialConnectConfigured } from "../lib/socialconnect";
import {
  requireAnyAdmin, requireManager, requireSuperadmin,
  effectiveRole, isEnvAdmin, ENV_ADMIN_EMAILS, ADMIN_ROLES, type AdminRole,
} from "../lib/admin-roles";
import { isStripeConfigured } from "../lib/stripe-issuing";
import { invalidateCustomJobs, CATEGORY_LABELS } from "../lib/jobs";
import { db, usersTable, transactionsTable, cardWaitlistTable, customJobsTable, enquiriesTable, notificationsTable } from "@workspace/db";
import { notifyAll, notifyUser } from "../lib/notify";
import { eq, count, desc, sql, isNotNull, or, isNull } from "drizzle-orm";

const router = Router();

// Role tiers (superadmin / manager / support) live in lib/admin-roles.ts.
// ADMIN_EMAILS env accounts are permanent superadmins; further admins are
// appointed from Admin → Settings → Team & Roles.

router.get("/admin/stats", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const [{ total: totalUsers }] = await db.select({ total: count() }).from(usersTable);
    const [{ total: pendingKyc }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.kycStatus, "pending"));
    const [{ total: approvedKyc }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.kycStatus, "approved"));
    const [{ total: rejectedKyc }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.kycStatus, "rejected"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [{ total: transactionsToday }] = await db.select({ total: count() }).from(transactionsTable)
      .where(sql`${transactionsTable.createdAt} >= ${today}`);

    const [volumeRow] = await db.select({
      volume: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)`,
    }).from(transactionsTable);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ total: activeUsers }] = await db.select({ total: count() }).from(usersTable)
      .where(sql`${usersTable.createdAt} >= ${thirtyDaysAgo}`);

    const [{ total: businessUsers }] = await db.select({ total: count() }).from(usersTable)
      .where(eq(usersTable.accountType, "business"));

    // Acquisition breakdown: where signups come from (jobs, landing, google, direct…)
    const sourceRows = await db.select({
      source: sql<string>`COALESCE(${usersTable.signupSource}, 'unknown')`,
      total: count(),
    }).from(usersTable).groupBy(sql`COALESCE(${usersTable.signupSource}, 'unknown')`);
    const signupsBySource: Record<string, number> = {};
    for (const row of sourceRows) {
      // Collapse "jobs:rv-123" style sources into their channel for the summary
      const channel = row.source.split(":")[0] || "unknown";
      signupsBySource[channel] = (signupsBySource[channel] ?? 0) + row.total;
    }

    res.json({
      totalUsers,
      activeUsers,
      businessUsers,
      pendingKyc,
      approvedKyc,
      rejectedKyc,
      transactionsToday,
      totalTransactionVolume: parseFloat(volumeRow?.volume ?? "0"),
      totalWalletBalance: 0,
      signupsBySource,
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch stats" });
  }
});

router.get("/admin/users", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const kycStatus = typeof req.query["kycStatus"] === "string" ? req.query["kycStatus"] : undefined;

    const baseQuery = db.select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      phoneNumber: usersTable.phoneNumber,
      country: usersTable.country,
      kycStatus: usersTable.kycStatus,
      avatarUrl: usersTable.avatarUrl,
      signupSource: usersTable.signupSource,
      accountType: usersTable.accountType,
      businessName: usersTable.businessName,
      createdAt: usersTable.createdAt,
    }).from(usersTable);

    const rows = await (
      kycStatus && ["pending", "approved", "rejected"].includes(kycStatus)
        ? baseQuery.where(eq(usersTable.kycStatus, kycStatus as "pending" | "approved" | "rejected"))
        : baseQuery
    ).orderBy(desc(usersTable.createdAt)).limit(200);

    const [{ total }] = await db.select({ total: count() }).from(usersTable);

    res.json({
      users: rows.map((u) => ({
        ...u,
        walletBalance: 0,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Admin users error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch users" });
  }
});

router.get("/admin/transactions", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const type = typeof req.query["type"] === "string" ? req.query["type"] : undefined;

    const rows = await (
      type && ["send", "receive", "withdraw", "recharge", "payment"].includes(type)
        ? db.select().from(transactionsTable).where(eq(transactionsTable.type, type as any))
        : db.select().from(transactionsTable)
    ).orderBy(desc(transactionsTable.createdAt)).limit(200);

    const [{ total }] = await db.select({ total: count() }).from(transactionsTable);

    res.json({
      transactions: rows.map((t) => ({
        ...t,
        amount: parseFloat(String(t.amount)),
        createdAt: t.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Admin transactions error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch transactions" });
  }
});

// ─── Feature flags: the admin master switches ─────────────────────────────────

async function featureFlagsPayload() {
  const [cardProgramEnabled, maintenance, socialConnect, [{ total: cardWaitlistCount }]] = await Promise.all([
    isCardProgramEnabled(),
    getMaintenance(),
    getSocialConnect(),
    db.select({ total: count() }).from(cardWaitlistTable),
  ]);
  return {
    cardProgramEnabled,
    stripeConfigured: isStripeConfigured(),
    cardWaitlistCount,
    maintenanceMode: maintenance.enabled,
    maintenanceMessage: maintenance.message,
    socialConnectEnabled: socialConnect.enabled,
    socialConnectConfigured: isSocialConnectConfigured(),
  };
}

router.get("/admin/feature-flags", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await featureFlagsPayload());
  } catch (err) {
    req.log.error({ err }, "Feature flags read error");
    res.status(500).json({ error: "internal_error", message: "Failed to read feature flags" });
  }
});

router.put("/admin/feature-flags", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const { cardProgramEnabled, maintenanceMode, maintenanceMessage, socialConnectEnabled } = req.body as {
      cardProgramEnabled?: unknown; maintenanceMode?: unknown; maintenanceMessage?: unknown; socialConnectEnabled?: unknown;
    };
    if (cardProgramEnabled === undefined && maintenanceMode === undefined && maintenanceMessage === undefined && socialConnectEnabled === undefined) {
      res.status(400).json({ error: "validation_error", message: "Provide at least one flag to update" });
      return;
    }
    if (socialConnectEnabled !== undefined) {
      if (typeof socialConnectEnabled !== "boolean") {
        res.status(400).json({ error: "validation_error", message: "socialConnectEnabled must be a boolean" });
        return;
      }
      await setSocialConnectEnabled(socialConnectEnabled);
      req.log.info({ socialConnectEnabled, admin: req.user!.email }, "SocialConnect switch changed");
    }
    if (cardProgramEnabled !== undefined) {
      if (typeof cardProgramEnabled !== "boolean") {
        res.status(400).json({ error: "validation_error", message: "cardProgramEnabled must be a boolean" });
        return;
      }
      await setCardProgramEnabled(cardProgramEnabled);
      req.log.info({ cardProgramEnabled, admin: req.user!.email }, "Card program switch changed");
    }
    if (maintenanceMode !== undefined || maintenanceMessage !== undefined) {
      if (maintenanceMode !== undefined && typeof maintenanceMode !== "boolean") {
        res.status(400).json({ error: "validation_error", message: "maintenanceMode must be a boolean" });
        return;
      }
      if (maintenanceMessage !== undefined && typeof maintenanceMessage !== "string") {
        res.status(400).json({ error: "validation_error", message: "maintenanceMessage must be a string" });
        return;
      }
      await setMaintenance({
        ...(maintenanceMode !== undefined ? { enabled: maintenanceMode } : {}),
        ...(maintenanceMessage !== undefined ? { message: maintenanceMessage.slice(0, 280) } : {}),
      });
      req.log.warn({ maintenanceMode, admin: req.user!.email }, "Maintenance mode changed");
    }
    res.json(await featureFlagsPayload());
  } catch (err) {
    req.log.error({ err }, "Feature flags update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update feature flags" });
  }
});

// ─── Wallet provider switches (WaaS: Privy / Coinbase CDP / Turnkey) ──────────
// The active provider creates NEW wallets; per-provider toggles are kill
// switches (OFF = no new wallets and no sends signed via it). Existing wallets
// always keep the provider that holds their key — switching never moves funds.

async function walletProvidersPayload() {
  const config = await getWalletProviderConfig();

  // How many user wallets each provider holds keys for (legacy rows = Privy)
  const countRows = await db.select({
    provider: sql<string>`COALESCE(${usersTable.walletProvider}, 'privy')`,
    total: count(),
  }).from(usersTable)
    .where(isNotNull(usersTable.celoWalletAddress))
    .groupBy(sql`COALESCE(${usersTable.walletProvider}, 'privy')`);
  const walletCounts: Record<string, number> = {};
  for (const row of countRows) walletCounts[row.provider] = row.total;

  return {
    activeProvider: config.activeProvider,
    providers: walletProviderCatalog().map((p) => ({
      key: p.key,
      label: p.label,
      configured: p.configured,
      enabled: config.enabled[p.key],
      wallets: walletCounts[p.key] ?? 0,
      envHint: p.envHint,
    })),
  };
}

router.get("/admin/wallet-providers", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await walletProvidersPayload());
  } catch (err) {
    req.log.error({ err }, "Wallet providers read error");
    res.status(500).json({ error: "internal_error", message: "Failed to read wallet provider settings" });
  }
});

router.put("/admin/wallet-providers", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const { activeProvider, enabled } = req.body as { activeProvider?: unknown; enabled?: unknown };
    if (activeProvider === undefined && enabled === undefined) {
      res.status(400).json({ error: "validation_error", message: "Provide activeProvider and/or enabled to update" });
      return;
    }
    if (activeProvider !== undefined && !WALLET_PROVIDER_KEYS.includes(activeProvider as WalletProviderKey)) {
      res.status(400).json({ error: "validation_error", message: `activeProvider must be one of: ${WALLET_PROVIDER_KEYS.join(", ")}` });
      return;
    }
    const enabledUpdate: Partial<Record<WalletProviderKey, boolean>> = {};
    if (enabled !== undefined) {
      if (typeof enabled !== "object" || enabled === null) {
        res.status(400).json({ error: "validation_error", message: "enabled must be an object of provider→boolean" });
        return;
      }
      for (const [key, value] of Object.entries(enabled as Record<string, unknown>)) {
        if (!WALLET_PROVIDER_KEYS.includes(key as WalletProviderKey)) {
          res.status(400).json({ error: "validation_error", message: `Unknown provider "${key}"` });
          return;
        }
        if (typeof value !== "boolean") {
          res.status(400).json({ error: "validation_error", message: `enabled.${key} must be a boolean` });
          return;
        }
        enabledUpdate[key as WalletProviderKey] = value;
      }
    }
    await setWalletProviderConfig({
      ...(activeProvider !== undefined ? { activeProvider: activeProvider as WalletProviderKey } : {}),
      ...(enabled !== undefined ? { enabled: enabledUpdate } : {}),
    });
    req.log.warn({ activeProvider, enabled: enabledUpdate, admin: req.user!.email }, "Wallet provider switches changed");
    res.json(await walletProvidersPayload());
  } catch (err) {
    req.log.error({ err }, "Wallet providers update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update wallet provider settings" });
  }
});

// ── Payout providers (payroll + withdrawal rails) ─────────────────────────────
// The pluggable cash-out layer (Noah, Bridge, Conduit, Yellow Card, Thunes).
// Mirrors the wallet-providers switches: a preferred provider for new payouts
// plus a per-provider on/off kill switch, both live from /admin/settings.
async function payoutProvidersPayload() {
  const config = await getPayoutProviderConfig();
  return {
    preferredProvider: config.preferredProvider,
    virtualAccountIssuer: config.virtualAccountIssuer,
    providers: payoutProviderCatalog().map((p) => ({
      key: p.key,
      label: p.label,
      configured: p.configured,
      enabled: config.enabled[p.key],
      envHint: p.envHint,
      pricingNote: p.pricingNote,
      supportsDeposits: p.supportsDeposits,
      supportsVirtualAccounts: p.supportsVirtualAccounts,
    })),
  };
}

router.get("/admin/payout-providers", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await payoutProvidersPayload());
  } catch (err) {
    req.log.error({ err }, "Payout providers read error");
    res.status(500).json({ error: "internal_error", message: "Failed to read payout provider settings" });
  }
});

router.put("/admin/payout-providers", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const { preferredProvider, enabled, virtualAccountIssuer } = req.body as { preferredProvider?: unknown; enabled?: unknown; virtualAccountIssuer?: unknown };
    if (preferredProvider === undefined && enabled === undefined && virtualAccountIssuer === undefined) {
      res.status(400).json({ error: "validation_error", message: "Provide preferredProvider, enabled and/or virtualAccountIssuer to update" });
      return;
    }
    if (preferredProvider !== undefined && !PAYOUT_PROVIDER_KEYS.includes(preferredProvider as PayoutProviderKey)) {
      res.status(400).json({ error: "validation_error", message: `preferredProvider must be one of: ${PAYOUT_PROVIDER_KEYS.join(", ")}` });
      return;
    }
    if (virtualAccountIssuer !== undefined && !PAYOUT_PROVIDER_KEYS.includes(virtualAccountIssuer as PayoutProviderKey)) {
      res.status(400).json({ error: "validation_error", message: `virtualAccountIssuer must be one of: ${PAYOUT_PROVIDER_KEYS.join(", ")}` });
      return;
    }
    const enabledUpdate: Partial<Record<PayoutProviderKey, boolean>> = {};
    if (enabled !== undefined) {
      if (typeof enabled !== "object" || enabled === null) {
        res.status(400).json({ error: "validation_error", message: "enabled must be an object of provider→boolean" });
        return;
      }
      for (const [key, value] of Object.entries(enabled as Record<string, unknown>)) {
        if (!PAYOUT_PROVIDER_KEYS.includes(key as PayoutProviderKey)) {
          res.status(400).json({ error: "validation_error", message: `Unknown provider "${key}"` });
          return;
        }
        if (typeof value !== "boolean") {
          res.status(400).json({ error: "validation_error", message: `enabled.${key} must be a boolean` });
          return;
        }
        enabledUpdate[key as PayoutProviderKey] = value;
      }
    }
    await setPayoutProviderConfig({
      ...(preferredProvider !== undefined ? { preferredProvider: preferredProvider as PayoutProviderKey } : {}),
      ...(enabled !== undefined ? { enabled: enabledUpdate } : {}),
      ...(virtualAccountIssuer !== undefined ? { virtualAccountIssuer: virtualAccountIssuer as PayoutProviderKey } : {}),
    });
    req.log.warn({ preferredProvider, enabled: enabledUpdate, virtualAccountIssuer, admin: req.user!.email }, "Payout provider switches changed");
    res.json(await payoutProvidersPayload());
  } catch (err) {
    req.log.error({ err }, "Payout providers update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update payout provider settings" });
  }
});

// ─── Fee schedule: provider cost + S-PAY margin = user price ──────────────────

router.get("/admin/fees", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await getFeeSchedule());
  } catch (err) {
    req.log.error({ err }, "Fee schedule read error");
    res.status(500).json({ error: "internal_error", message: "Failed to read fee schedule" });
  }
});

router.put("/admin/fees", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const body = req.body as Partial<FeeSchedule>;
    // transferFeeFlat is a USD amount (not a percent) so it has a higher ceiling
    const fields: { key: keyof FeeSchedule; max: number }[] = [
      { key: "withdrawalFeePercent", max: 100 },
      { key: "withdrawalFeeMin", max: 1000 },
      { key: "cardIssuanceFee", max: 1000 },
      { key: "p2pFeePercent", max: 100 },
      { key: "transferFeeFlat", max: 1000 },
    ];
    for (const { key, max } of fields) {
      const v = body[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) {
        res.status(400).json({ error: "validation_error", message: `${key} must be a number between 0 and ${max}` });
        return;
      }
    }
    const fees: FeeSchedule = {
      withdrawalFeePercent: body.withdrawalFeePercent!,
      withdrawalFeeMin: body.withdrawalFeeMin!,
      cardIssuanceFee: body.cardIssuanceFee!,
      p2pFeePercent: body.p2pFeePercent!,
      transferFeeFlat: body.transferFeeFlat!,
    };
    await setFeeSchedule(fees);
    req.log.info({ fees, admin: req.user!.email }, "Fee schedule updated");
    res.json(fees);
  } catch (err) {
    req.log.error({ err }, "Fee schedule update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update fee schedule" });
  }
});

// ─── S-PAY's own job listings (pinned to the feed top; SEO content) ───────────

router.get("/admin/custom-jobs", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(customJobsTable)
      .where(eq(customJobsTable.active, true))
      .orderBy(desc(customJobsTable.createdAt));
    res.json({ jobs: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    req.log.error({ err }, "Custom jobs list error");
    res.status(500).json({ error: "internal_error", message: "Failed to list custom jobs" });
  }
});

router.post("/admin/custom-jobs", requireAuth, requireManager, async (req, res) => {
  try {
    const { title, company, applyUrl, category, location, salary, description } = req.body as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim() || typeof company !== "string" || !company.trim()) {
      res.status(400).json({ error: "validation_error", message: "title and company are required" });
      return;
    }
    if (typeof applyUrl !== "string" || !/^https?:\/\//.test(applyUrl)) {
      res.status(400).json({ error: "validation_error", message: "applyUrl must be a valid http(s) URL" });
      return;
    }
    const cat = typeof category === "string" && (CATEGORY_LABELS as readonly string[]).includes(category)
      ? category : "Engineering";
    const [row] = await db.insert(customJobsTable).values({
      title: title.trim().slice(0, 160),
      company: company.trim().slice(0, 120),
      applyUrl: applyUrl.trim().slice(0, 500),
      category: cat,
      location: typeof location === "string" && location.trim() ? location.trim().slice(0, 120) : "Worldwide",
      salary: typeof salary === "string" && salary.trim() ? salary.trim().slice(0, 80) : "Competitive",
      description: typeof description === "string" && description.trim() ? description.trim().slice(0, 20000) : null,
    }).returning();
    invalidateCustomJobs();
    req.log.info({ jobId: row.id, admin: req.user!.email }, "Custom job listing created");
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Custom job create error");
    res.status(500).json({ error: "internal_error", message: "Failed to create listing" });
  }
});

router.delete("/admin/custom-jobs/:jobId", requireAuth, requireManager, async (req, res) => {
  try {
    await db.update(customJobsTable)
      .set({ active: false })
      .where(eq(customJobsTable.id, req.params.jobId as string));
    invalidateCustomJobs();
    res.json({ message: "Listing removed from the feed." });
  } catch (err) {
    req.log.error({ err }, "Custom job delete error");
    res.status(500).json({ error: "internal_error", message: "Failed to remove listing" });
  }
});


// ─── Manual notifications: message every user or one user, from the admin ────

router.post("/admin/notifications", requireAuth, requireManager, async (req, res) => {
  try {
    const { title, body, email } = req.body as { title?: unknown; body?: unknown; email?: unknown };
    if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "validation_error", message: "title and body are required" });
      return;
    }
    if (email !== undefined && email !== "") {
      if (typeof email !== "string") {
        res.status(400).json({ error: "validation_error", message: "email must be a string" });
        return;
      }
      const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.trim())).limit(1);
      if (!user) {
        res.status(404).json({ error: "not_found", message: "No user with that email" });
        return;
      }
      notifyUser(user.id, title.trim(), body.trim(), "announcement");
      req.log.info({ admin: req.user!.email, to: email }, "Admin notification sent to one user");
      res.json({ message: `Notification sent to ${email}.` });
      return;
    }
    notifyAll(title.trim(), body.trim());
    req.log.info({ admin: req.user!.email }, "Admin broadcast notification sent");
    res.json({ message: "Notification sent to all users." });
  } catch (err) {
    req.log.error({ err }, "Admin notification error");
    res.status(500).json({ error: "internal_error", message: "Failed to send notification" });
  }
});

// ─── Enquiries inbox: everything from the landing page, contact page & app ───

router.get("/admin/enquiries", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(enquiriesTable).orderBy(desc(enquiriesTable.createdAt)).limit(500);
    const [{ total }] = await db.select({ total: count() }).from(enquiriesTable);
    res.json({ enquiries: rows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })), total });
  } catch (err) {
    req.log.error({ err }, "Admin enquiries error");
    res.status(500).json({ error: "internal_error", message: "Failed to load enquiries" });
  }
});

router.put("/admin/enquiries/:enquiryId", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const status = (req.body as { status?: string }).status === "resolved" ? "resolved" : "new";
    await db.update(enquiriesTable).set({ status }).where(eq(enquiriesTable.id, req.params.enquiryId as string));
    res.json({ message: status === "resolved" ? "Marked resolved." : "Reopened." });
  } catch (err) {
    req.log.error({ err }, "Admin enquiry update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update enquiry" });
  }
});

// ─── Site content: hero, footer, colours — live edits, no deploy ──────────────

router.get("/admin/site-content", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await getSiteContent());
  } catch (err) {
    req.log.error({ err }, "Site content read error");
    res.status(500).json({ error: "internal_error", message: "Failed to read site content" });
  }
});

router.put("/admin/site-content", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const body = req.body as Partial<SiteContent>;
    const update: Partial<SiteContent> = {};
    const fields: (keyof SiteContent)[] = ["heroTitle", "heroSubtitle", "heroCta", "announcement", "footerTagline", "primaryColor", "accentColor"];
    for (const f of fields) {
      const v = body[f];
      if (v === undefined) continue;
      if (typeof v !== "string") {
        res.status(400).json({ error: "validation_error", message: `${f} must be a string` });
        return;
      }
      if ((f === "primaryColor" || f === "accentColor") && !/^#[0-9a-fA-F]{6}$/.test(v)) {
        res.status(400).json({ error: "validation_error", message: `${f} must be a hex colour like #4DC9EE` });
        return;
      }
      update[f] = v.slice(0, f === "heroSubtitle" ? 300 : 160);
    }
    const next = await setSiteContent(update);
    req.log.info({ admin: req.user!.email }, "Site content updated");
    res.json(next);
  } catch (err) {
    req.log.error({ err }, "Site content update error");
    res.status(500).json({ error: "internal_error", message: "Failed to update site content" });
  }
});


// ─── Team & roles: superadmins appoint other admins ───────────────────────────

async function adminsPayload(myRole: AdminRole) {
  const rows = await db.select({
    id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName,
    adminRole: usersTable.adminRole, createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(or(isNotNull(usersTable.adminRole), ...ENV_ADMIN_EMAILS.map((e) => eq(sql`lower(${usersTable.email})`, e))))
    .orderBy(desc(usersTable.createdAt));
  return {
    myRole,
    admins: rows
      .map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: isEnvAdmin(u.email) ? ("superadmin" as const) : (u.adminRole as AdminRole),
        source: isEnvAdmin(u.email) ? ("env" as const) : ("appointed" as const),
      }))
      .filter((u) => u.role),
  };
}

router.get("/admin/admins", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    res.json(await adminsPayload(req.adminRole!));
  } catch (err) {
    req.log.error({ err }, "Admins list error");
    res.status(500).json({ error: "internal_error", message: "Failed to list admins" });
  }
});

router.post("/admin/admins", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const { email, role } = req.body as { email?: unknown; role?: unknown };
    if (typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "validation_error", message: "email is required" });
      return;
    }
    if (!ADMIN_ROLES.includes(role as AdminRole)) {
      res.status(400).json({ error: "validation_error", message: `role must be one of: ${ADMIN_ROLES.join(", ")}` });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim())).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "No account with that email — they must register first, then you can grant a role." });
      return;
    }
    if (isEnvAdmin(user.email)) {
      res.status(400).json({ error: "validation_error", message: "That account is a permanent owner (ADMIN_EMAILS) — its role can't be changed here." });
      return;
    }
    await db.update(usersTable).set({ adminRole: role as AdminRole, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    req.log.warn({ admin: req.user!.email, target: user.email, role }, "Admin role granted/changed");
    res.json(await adminsPayload(req.adminRole!));
  } catch (err) {
    req.log.error({ err }, "Admin grant error");
    res.status(500).json({ error: "internal_error", message: "Failed to update the role" });
  }
});

router.delete("/admin/admins/:userId", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target?.adminRole && !(target && isEnvAdmin(target.email))) {
      res.status(404).json({ error: "not_found", message: "That user has no admin role" });
      return;
    }
    if (target && isEnvAdmin(target.email)) {
      res.status(400).json({ error: "validation_error", message: "Permanent owners (ADMIN_EMAILS) can only be removed by editing the env var on Render." });
      return;
    }
    if (userId === req.user!.userId) {
      res.status(400).json({ error: "validation_error", message: "You can't remove your own access — ask another superadmin." });
      return;
    }
    await db.update(usersTable).set({ adminRole: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    req.log.warn({ admin: req.user!.email, target: target!.email }, "Admin role removed");
    res.json(await adminsPayload(req.adminRole!));
  } catch (err) {
    req.log.error({ err }, "Admin remove error");
    res.status(500).json({ error: "internal_error", message: "Failed to remove the role" });
  }
});

// Returns which env vars are configured (not their values)
router.get("/admin/settings", requireAuth, requireAnyAdmin, (req, res) => {
  const check = (key: string) => !!process.env[key];
  res.json({
    database: { configured: check("DATABASE_URL") },
    auth: {
      jwtConfigured: check("JWT_SECRET"),
      googleConfigured: check("GOOGLE_CLIENT_ID") && check("GOOGLE_CLIENT_SECRET"),
    },
    noah: {
      configured: check("NOAH_API_KEY"),
      webhookConfigured: check("NOAH_WEBHOOK_SECRET"),
    },
    wallet: Object.fromEntries(walletProviderCatalog().map((p) => [p.key, { configured: p.configured }])),
    socialConnect: { configured: isSocialConnectConfigured() },
    stripe: {
      configured: check("STRIPE_SECRET_KEY"),
      webhookConfigured: check("STRIPE_WEBHOOK_SECRET"),
    },
    cors: {
      origin: process.env.CORS_ORIGIN ?? "(not set)",
    },
    adminEmails: ENV_ADMIN_EMAILS,
  });
});

export default router;
