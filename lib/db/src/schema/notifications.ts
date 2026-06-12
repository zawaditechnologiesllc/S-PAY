import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

// In-app notifications. user_id null = broadcast (visible to every user).
// Read state is per-user via users.notifications_read_at (no per-row fan-out).
export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),                 // null → broadcast
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category"),              // money | account | announcement
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_notifications_user_created").on(t.userId, t.createdAt.desc()),
]).enableRLS();

export type Notification = typeof notificationsTable.$inferSelect;
