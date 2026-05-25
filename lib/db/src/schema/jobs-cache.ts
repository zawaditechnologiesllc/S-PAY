import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const jobsCacheTable = pgTable("jobs_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export type JobsCache = typeof jobsCacheTable.$inferSelect;
