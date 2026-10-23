CREATE TABLE IF NOT EXISTS "score_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"partner_sharing_consent" boolean DEFAULT false NOT NULL,
	"partner_sharing_consent_at" timestamp,
	"consent_version" text,
	"last_score" integer,
	"last_band" text,
	"account_type" text,
	"model_version" text,
	"last_computed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "score_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"account_type" text NOT NULL,
	"model_version" text NOT NULL,
	"factors" jsonb NOT NULL,
	"signals" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "score_consent_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"consent_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_consent_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "score_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"show_exact_score" boolean DEFAULT false NOT NULL,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"account_type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_profiles_last_score" ON "score_profiles" USING btree ("last_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_profiles_computed" ON "score_profiles" USING btree ("last_computed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_score_snapshots_user_period" ON "score_snapshots" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_snapshots_period" ON "score_snapshots" USING btree ("period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_consent_user_created" ON "score_consent_log" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_consent_created" ON "score_consent_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_score_shares_token" ON "score_shares" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_shares_user" ON "score_shares" USING btree ("user_id");
