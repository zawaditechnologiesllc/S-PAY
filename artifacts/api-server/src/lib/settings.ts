import { logger } from "./logger";

/**
 * Runtime feature flags stored in the app_settings table and toggled from
 * the admin panel — no redeploy needed. Values are cached briefly so hot
 * paths (e.g. GET /card/details) don't hit Postgres on every request.
 */

const CACHE_TTL_MS = 15 * 1000;
const cache = new Map<string, { value: unknown; cachedAt: number }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit.value as T;
  try {
    const { db, appSettingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
    const value = row ? (row.value as T) : fallback;
    cache.set(key, { value, cachedAt: Date.now() });
    return value;
  } catch (err) {
    logger.warn({ err, key }, "Failed to read app setting — using fallback");
    return fallback;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const { db, appSettingsTable } = await import("@workspace/db");
  await db
    .insert(appSettingsTable)
    .values({ key, value: value as object, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: value as object, updatedAt: new Date() } });
  cache.set(key, { value, cachedAt: Date.now() });
}

// ── Card program master switch ────────────────────────────────────────────────

const CARD_PROGRAM_KEY = "card_program_enabled";

export async function isCardProgramEnabled(): Promise<boolean> {
  const v = await getSetting<{ enabled: boolean }>(CARD_PROGRAM_KEY, { enabled: false });
  return v?.enabled === true;
}

export async function setCardProgramEnabled(enabled: boolean): Promise<void> {
  await setSetting(CARD_PROGRAM_KEY, { enabled });
}
