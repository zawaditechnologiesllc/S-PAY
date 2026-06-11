CREATE TABLE IF NOT EXISTS "custom_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"category" text DEFAULT 'Engineering' NOT NULL,
	"location" text DEFAULT 'Worldwide' NOT NULL,
	"salary" text DEFAULT 'Competitive' NOT NULL,
	"apply_url" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
