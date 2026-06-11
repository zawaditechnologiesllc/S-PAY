DO $$ BEGIN
 CREATE TYPE "public"."account_type" AS ENUM('personal', 'business');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "account_type" DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_name" text;
