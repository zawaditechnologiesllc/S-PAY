ALTER TABLE "score_profiles" ADD COLUMN IF NOT EXISTS "sharing_prompt_last_shown_at" timestamp;--> statement-breakpoint
ALTER TABLE "score_profiles" ADD COLUMN IF NOT EXISTS "sharing_prompt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "score_profiles" ADD COLUMN IF NOT EXISTS "sharing_prompt_opted_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "score_consent_log" ADD COLUMN IF NOT EXISTS "source" text;
