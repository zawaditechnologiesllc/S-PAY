ALTER TABLE "users" ADD COLUMN "login_verification_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Normalize emails to lowercase so login, MFA, password reset and P2P
-- send-by-email all find the same row regardless of how the address was typed
-- at signup. Skips any row whose lowercase form would collide with another
-- account (those are resolved manually) so the unique index can never fail
-- the migration.
UPDATE "users" u SET "email" = lower("email")
WHERE "email" <> lower("email")
  AND NOT EXISTS (
    SELECT 1 FROM "users" v WHERE v."email" = lower(u."email") AND v."id" <> u."id"
  );
