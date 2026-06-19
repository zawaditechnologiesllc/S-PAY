-- Email MFA on login: a 6-digit code (10-min expiry) is the second factor.
-- IF NOT EXISTS keeps the manual-apply fallback safe to re-run.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_verification_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_verification_expires" timestamp;
