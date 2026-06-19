-- Add spay_id safely on a table that already has rows:
-- 1) add nullable, 2) backfill existing users with a unique generated id,
-- 3) enforce NOT NULL, 4) add the unique constraint + index.
ALTER TABLE "users" ADD COLUMN "spay_id" text;--> statement-breakpoint
UPDATE "users" SET "spay_id" = 'spay_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) WHERE "spay_id" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "spay_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_users_spay_id" ON "users" USING btree ("spay_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_spay_id_unique" UNIQUE("spay_id");
