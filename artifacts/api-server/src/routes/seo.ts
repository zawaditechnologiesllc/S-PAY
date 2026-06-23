import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAnyAdmin, requireManager } from "../lib/admin-roles";
import {
  fetchSearchAnalytics, isGscConfigured, rankOpportunities,
  generateBlogDraft, isDraftConfigured, DraftNotConfiguredError,
  slugify, articleJsonLd,
} from "../lib/seo";
import { db, blogPostsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

const SITE_URL = (process.env.SITE_URL ?? "https://spayewallet.com").replace(/\/+$/, "");

// ═══════════════════════════════════════════════════════════════════════════════
// SEO content engine — admin (review/approve/publish; nothing auto-publishes)
// ═══════════════════════════════════════════════════════════════════════════════

// Ranked keyword opportunities from Google Search Console. Honest empty +
// configured:false until GSC creds are set — never invented query data.
router.get("/admin/seo/opportunities", requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const rows = await fetchSearchAnalytics(Number(req.query.days) || 28);
    if (rows === null) {
      res.json({
        configured: false,
        opportunities: [],
        message: "Connect Google Search Console (set GSC_SERVICE_ACCOUNT_JSON + GSC_SITE_URL) to surface keyword opportunities.",
      });
      return;
    }
    res.json({ configured: true, opportunities: rankOpportunities(rows, Number(req.query.limit) || 20) });
  } catch (err) {
    req.log.error({ err }, "SEO opportunities error");
    res.status(500).json({ error: "internal_error", message: "Failed to load SEO opportunities" });
  }
});

// Status of the engine's integrations, for the admin panel.
router.get("/admin/seo/status", requireAuth, requireAnyAdmin, (_req, res) => {
  res.json({ gscConfigured: isGscConfigured(), draftConfigured: isDraftConfigured() });
});

// Generate an AI draft (Claude Haiku) for a keyword, grounded in product facts,
// and store it as a DRAFT for review. Honest 503 until ANTHROPIC_API_KEY is set.
router.post("/admin/seo/drafts", requireAuth, requireManager, async (req, res) => {
  try {
    const { keyword, audienceHint } = req.body as { keyword?: string; audienceHint?: string };
    if (!keyword?.trim()) {
      res.status(400).json({ error: "validation_error", message: "keyword is required" });
      return;
    }
    let draft;
    try {
      draft = await generateBlogDraft(keyword.trim(), audienceHint?.trim());
    } catch (err) {
      if (err instanceof DraftNotConfiguredError) {
        res.status(503).json({ error: "not_configured", message: "AI drafting is activating soon (set ANTHROPIC_API_KEY)." });
        return;
      }
      throw err;
    }

    // Unique slug (append a short suffix on collision).
    let slug = slugify(draft.title || keyword);
    const [clash] = await db.select({ id: blogPostsTable.id }).from(blogPostsTable).where(eq(blogPostsTable.slug, slug)).limit(1);
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const [post] = await db.insert(blogPostsTable).values({
      slug,
      title: draft.title,
      metaDescription: draft.metaDescription || null,
      excerpt: draft.excerpt || null,
      keyword: keyword.trim(),
      bodyMarkdown: draft.bodyMarkdown,
      status: "draft",
      source: "gsc",
      model: draft.model,
    }).returning();

    res.status(201).json({ post: serializePost(post) });
  } catch (err) {
    req.log.error({ err }, "SEO draft generation error");
    res.status(500).json({ error: "internal_error", message: "Could not generate the draft" });
  }
});

// List posts (any status) for the admin review queue.
router.get("/admin/seo/posts", requireAuth, requireAnyAdmin, async (req, res) => {
  const statusFilter = typeof req.query.status === "string" ? req.query.status : null;
  const where = statusFilter ? eq(blogPostsTable.status, statusFilter as never) : undefined;
  const rows = await db.select().from(blogPostsTable).where(where).orderBy(desc(blogPostsTable.createdAt)).limit(200);
  res.json({ posts: rows.map((p) => serializePost(p)) });
});

router.get("/admin/seo/posts/:id", requireAuth, requireAnyAdmin, async (req, res) => {
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, req.params.id as string)).limit(1);
  if (!post) { res.status(404).json({ error: "not_found", message: "Post not found" }); return; }
  res.json({ post: serializePost(post, true) });
});

// Edit a draft before publishing (human-in-the-loop).
router.patch("/admin/seo/posts/:id", requireAuth, requireManager, async (req, res) => {
  const { title, metaDescription, excerpt, bodyMarkdown, keyword, slug } = req.body as Record<string, unknown>;
  const [existing] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, req.params.id as string)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found", message: "Post not found" }); return; }

  const [updated] = await db.update(blogPostsTable).set({
    title: typeof title === "string" && title.trim() ? title.trim() : existing.title,
    metaDescription: typeof metaDescription === "string" ? metaDescription.trim() || null : existing.metaDescription,
    excerpt: typeof excerpt === "string" ? excerpt.trim() || null : existing.excerpt,
    bodyMarkdown: typeof bodyMarkdown === "string" && bodyMarkdown.trim() ? bodyMarkdown : existing.bodyMarkdown,
    keyword: typeof keyword === "string" ? keyword.trim() || null : existing.keyword,
    slug: typeof slug === "string" && slug.trim() ? slugify(slug) : existing.slug,
    updatedAt: new Date(),
  }).where(eq(blogPostsTable.id, existing.id)).returning();
  res.json({ post: serializePost(updated, true) });
});

// Approve + publish. The human approval gate — only published posts are public.
router.post("/admin/seo/posts/:id/publish", requireAuth, requireManager, async (req, res) => {
  const [existing] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, req.params.id as string)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found", message: "Post not found" }); return; }
  const [updated] = await db.update(blogPostsTable).set({
    status: "published",
    reviewedByAdminId: req.user!.userId,
    publishedAt: existing.publishedAt ?? new Date(),
    updatedAt: new Date(),
  }).where(eq(blogPostsTable.id, existing.id)).returning();
  res.json({ post: serializePost(updated, true) });
});

router.post("/admin/seo/posts/:id/unpublish", requireAuth, requireManager, async (req, res) => {
  const [updated] = await db.update(blogPostsTable).set({ status: "archived", updatedAt: new Date() })
    .where(eq(blogPostsTable.id, req.params.id as string)).returning();
  if (!updated) { res.status(404).json({ error: "not_found", message: "Post not found" }); return; }
  res.json({ post: serializePost(updated, true) });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Public blog (published only) — the SEO surface
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/blog", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const rows = await db.select().from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(desc(blogPostsTable.publishedAt)).limit(limit).offset(offset);
  res.json({ posts: rows.map((p) => serializePost(p)) });
});

router.get("/blog/:slug", async (req, res) => {
  const [post] = await db.select().from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, req.params.slug as string), eq(blogPostsTable.status, "published")))
    .limit(1);
  if (!post) { res.status(404).json({ error: "not_found", message: "Post not found" }); return; }
  res.json({ post: serializePost(post, true), jsonLd: articleJsonLd(post, SITE_URL) });
});

// ── serializer ───────────────────────────────────────────────────────────────────

function serializePost(p: typeof blogPostsTable.$inferSelect, withBody = false) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    metaDescription: p.metaDescription,
    excerpt: p.excerpt,
    keyword: p.keyword,
    status: p.status,
    source: p.source,
    model: p.model,
    gsc: { impressions: p.gscImpressions, clicks: p.gscClicks, position: p.gscPosition ? Number(p.gscPosition) : null },
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    ...(withBody ? { bodyMarkdown: p.bodyMarkdown } : {}),
  };
}

export default router;
