ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_noah_customer" ON "users" USING btree ("noah_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_created" ON "users" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_kyc_status" ON "users" USING btree ("kyc_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_user_created" ON "transactions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_created" ON "transactions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_type_created" ON "transactions" USING btree ("type","created_at" DESC NULLS LAST);