CREATE TYPE "public"."employer_status" AS ENUM('pending', 'verified', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."payroll_batch_status" AS ENUM('draft', 'processing', 'completed', 'partially_completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payroll_payment_status" AS ENUM('pending', 'resolved', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."worker_identifier_type" AS ENUM('email', 'phone', 'spay_id', 'celo_address');--> statement-breakpoint
CREATE TABLE "employer_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"employer_id" text NOT NULL,
	"name" text,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"sandbox" boolean DEFAULT false NOT NULL,
	"scopes" jsonb DEFAULT '["payroll:read","payroll:write"]'::jsonb NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employer_api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employers" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text NOT NULL,
	"website_url" text,
	"country" text,
	"status" "employer_status" DEFAULT 'pending' NOT NULL,
	"balance_usdc" numeric(18, 6) DEFAULT '0' NOT NULL,
	"funding_address" text,
	"webhook_url" text,
	"webhook_secret" text,
	"auto_create_workers" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"employer_id" text NOT NULL,
	"reference" text,
	"description" text,
	"sandbox" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"status" "payroll_batch_status" DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"fee_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"payment_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"webhook_url" text,
	"idempotency_key" text,
	"metadata" jsonb,
	"submitted_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"employer_id" text NOT NULL,
	"worker_identifier" text NOT NULL,
	"identifier_type" "worker_identifier_type" NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"reason" text,
	"status" "payroll_payment_status" DEFAULT 'pending' NOT NULL,
	"resolved_user_id" text,
	"worker_created" boolean DEFAULT false NOT NULL,
	"transaction_id" text,
	"error_message" text,
	"resolved_at" timestamp,
	"paid_at" timestamp,
	"external_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"employer_id" text NOT NULL,
	"event_type" text NOT NULL,
	"url" text NOT NULL,
	"batch_id" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_webhook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "idx_notifications_user_created";--> statement-breakpoint
DROP INDEX "idx_enquiries_created";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employer_api_keys_hash" ON "employer_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_employer_api_keys_employer" ON "employer_api_keys" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_employers_owner" ON "employers" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_employers_status" ON "employers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_batches_employer_created" ON "payroll_batches" USING btree ("employer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_payroll_batches_status" ON "payroll_batches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_batches_idem" ON "payroll_batches" USING btree ("employer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_payroll_payments_batch" ON "payroll_payments" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_payments_employer_created" ON "payroll_payments" USING btree ("employer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_payroll_payments_resolved_user" ON "payroll_payments" USING btree ("resolved_user_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_webhooks_employer_created" ON "payroll_webhook_deliveries" USING btree ("employer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_enquiries_created" ON "enquiries" USING btree ("created_at" DESC NULLS LAST);