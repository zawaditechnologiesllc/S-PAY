ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id");
EXCEPTION
 WHEN duplicate_table THEN null;
 WHEN duplicate_object THEN null;
END $$;
