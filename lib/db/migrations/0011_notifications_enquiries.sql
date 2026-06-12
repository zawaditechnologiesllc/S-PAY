CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "category" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("user_id","created_at" DESC);--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enquiries" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "name" text,
  "email" text NOT NULL,
  "subject" text,
  "message" text NOT NULL,
  "source" text,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enquiries_created" ON "enquiries" ("created_at" DESC);--> statement-breakpoint
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifications_read_at" timestamp;
