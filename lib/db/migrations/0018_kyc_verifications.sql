CREATE TYPE "public"."kyc_verification_status" AS ENUM('started', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"status" "kyc_verification_status" DEFAULT 'started' NOT NULL,
	"verification_url" text,
	"account_type" text,
	"payload" jsonb,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_kyc_verifications_user" ON "kyc_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_verifications_external" ON "kyc_verifications" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_verifications_created" ON "kyc_verifications" USING btree ("created_at" DESC NULLS LAST);
