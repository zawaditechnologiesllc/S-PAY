CREATE TYPE "public"."virtual_account_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."blog_post_source" AS ENUM('gsc', 'manual', 'reddit');--> statement-breakpoint
CREATE TYPE "public"."blog_post_status" AS ENUM('draft', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "virtual_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"currency" text NOT NULL,
	"account_type" text NOT NULL,
	"country" text,
	"holder_name" text NOT NULL,
	"bank_name" text,
	"account_number_masked" text,
	"routing_number" text,
	"iban_masked" text,
	"status" "virtual_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "virtual_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"meta_description" text,
	"keyword" text,
	"excerpt" text,
	"body_markdown" text NOT NULL,
	"status" "blog_post_status" DEFAULT 'draft' NOT NULL,
	"source" "blog_post_source" DEFAULT 'gsc' NOT NULL,
	"model" text,
	"reviewed_by_admin_id" text,
	"gsc_impressions" integer,
	"gsc_clicks" integer,
	"gsc_position" numeric(6, 2),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- These two columns already exist on any DB that ran 0016; IF NOT EXISTS makes
-- this a safe no-op there (drizzle's snapshot was behind, so generate re-emitted
-- them here). Matches 0016's pattern.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_verification_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_verification_expires" timestamp;--> statement-breakpoint
CREATE INDEX "idx_virtual_accounts_user" ON "virtual_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_virtual_accounts_user_currency" ON "virtual_accounts" USING btree ("user_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blog_posts_slug" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_status_published" ON "blog_posts" USING btree ("status","published_at" DESC NULLS LAST);