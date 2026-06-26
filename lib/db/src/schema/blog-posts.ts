import { pgTable, text, integer, numeric, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── SEO blog posts ──────────────────────────────────────────────────────────────
// The publishable artifact of the SEO content engine. A post starts as an
// AI-generated DRAFT for a target keyword (an opportunity surfaced from Google
// Search Console), is reviewed/edited by an admin, then APPROVED → PUBLISHED.
// Nothing auto-publishes — Google penalizes unreviewed AI content, and grounding
// + human approval keep posts truthful. Each post records the GSC metrics
// snapshot it was generated from so the feedback loop can re-prioritize.

export const blogPostStatusEnum = pgEnum("blog_post_status", ["draft", "approved", "published", "archived"]);
export const blogPostSourceEnum = pgEnum("blog_post_source", ["gsc", "manual", "reddit"]);

export const blogPostsTable = pgTable("blog_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  metaDescription: text("meta_description"),
  keyword: text("keyword"),                    // the target query/opportunity
  excerpt: text("excerpt"),
  bodyMarkdown: text("body_markdown").notNull(),
  status: blogPostStatusEnum("status").default("draft").notNull(),
  source: blogPostSourceEnum("source").default("gsc").notNull(),
  model: text("model"),                        // which AI model drafted it (e.g. gemini-2.5-flash)
  reviewedByAdminId: text("reviewed_by_admin_id"), // admin who approved/published
  // GSC snapshot at generation time — drives the feedback loop.
  gscImpressions: integer("gsc_impressions"),
  gscClicks: integer("gsc_clicks"),
  gscPosition: numeric("gsc_position", { precision: 6, scale: 2 }),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_blog_posts_slug").on(t.slug),
  index("idx_blog_posts_status_published").on(t.status, t.publishedAt.desc()),
]).enableRLS();

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPostsTable.$inferSelect;
