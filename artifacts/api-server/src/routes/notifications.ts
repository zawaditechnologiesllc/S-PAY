import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, usersTable, notificationsTable } from "@workspace/db";
import { eq, desc, or, isNull, gt, and, count } from "drizzle-orm";

const router = Router();

// Personal + broadcast notifications, newest first, with the unread count
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select({ readAt: usersTable.notificationsReadAt })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const mine = or(eq(notificationsTable.userId, userId), isNull(notificationsTable.userId));

    const rows = await db.select().from(notificationsTable)
      .where(mine).orderBy(desc(notificationsTable.createdAt)).limit(50);
    const [{ total: unreadCount }] = await db.select({ total: count() }).from(notificationsTable)
      .where(user?.readAt ? and(mine, gt(notificationsTable.createdAt, user.readAt)) : mine);

    res.json({
      notifications: rows.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        unread: !user?.readAt || n.createdAt > user.readAt,
      })),
      unreadCount,
    });
  } catch (err) {
    req.log.error({ err }, "Notifications read error");
    res.status(500).json({ error: "internal_error", message: "Failed to load notifications" });
  }
});

router.post("/notifications/mark-read", requireAuth, async (req, res) => {
  try {
    await db.update(usersTable)
      .set({ notificationsReadAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.userId));
    res.json({ message: "All caught up." });
  } catch (err) {
    req.log.error({ err }, "Notifications mark-read error");
    res.status(500).json({ error: "internal_error", message: "Failed to update notifications" });
  }
});

export default router;
