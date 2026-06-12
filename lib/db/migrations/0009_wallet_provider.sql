ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wallet_provider" text;--> statement-breakpoint
UPDATE "users" SET "wallet_provider" = 'privy' WHERE "privy_wallet_id" IS NOT NULL AND "wallet_provider" IS NULL;
