import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// Runtime-tunable settings managed from the admin panel (e.g. feature flags).
// Key examples: "card_program_enabled" → { enabled: boolean }
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

export type AppSetting = typeof appSettingsTable.$inferSelect;
