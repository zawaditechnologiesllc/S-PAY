import { logger } from "./logger";

/**
 * In-app notifications. Rows with user_id are personal; user_id NULL is a
 * broadcast every user sees. Per-user read state = users.notifications_read_at
 * (no fan-out). Fire-and-forget — notifying must never fail a money flow.
 */
export function notifyUser(userId: string, title: string, body: string, category = "money"): void {
  void insert(userId, title, body, category);
}

export function notifyAll(title: string, body: string, category = "announcement"): void {
  void insert(null, title, body, category);
}

async function insert(userId: string | null, title: string, body: string, category: string): Promise<void> {
  try {
    const { db, notificationsTable } = await import("@workspace/db");
    await db.insert(notificationsTable).values({
      userId,
      title: title.slice(0, 140),
      body: body.slice(0, 500),
      category,
    });
  } catch (err) {
    logger.warn({ err, userId, title }, "Notification insert failed");
  }
}
