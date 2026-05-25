import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardWaitlistTable = pgTable("card_waitlist", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  email: text("email").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertCardWaitlistSchema = createInsertSchema(cardWaitlistTable).omit({
  id: true,
  joinedAt: true,
});

export type InsertCardWaitlist = z.infer<typeof insertCardWaitlistSchema>;
export type CardWaitlist = typeof cardWaitlistTable.$inferSelect;
