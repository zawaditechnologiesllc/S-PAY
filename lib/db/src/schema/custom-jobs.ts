import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

// S-PAY's own job listings, managed from the admin panel. Injected at the
// top of the aggregated feed (source "SPAY") — also the SEO content engine.
export const customJobsTable = pgTable("custom_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  company: text("company").notNull(),
  category: text("category").default("Engineering").notNull(),
  location: text("location").default("Worldwide").notNull(),
  salary: text("salary").default("Competitive").notNull(),
  applyUrl: text("apply_url").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS();

export type CustomJob = typeof customJobsTable.$inferSelect;
