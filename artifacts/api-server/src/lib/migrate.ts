import path from "node:path";
import fs from "node:fs";
import { logger } from "./logger";

/**
 * Applies pending SQL migrations from lib/db/migrations on boot, so the
 * database schema is always in sync without anyone running a terminal command.
 * Safe to run on every deploy — applied migrations are tracked by Drizzle.
 */
export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    logger.warn("DATABASE_URL not set — skipping database migrations");
    return;
  }

  const candidates = [
    process.env.MIGRATIONS_DIR, // explicit override
    path.resolve(process.cwd(), "migrations"), // Docker image: /app/migrations
    path.resolve(process.cwd(), "../../lib/db/migrations"), // local dev from artifacts/api-server
    path.resolve(process.cwd(), "lib/db/migrations"), // local dev from repo root
  ].filter((p): p is string => !!p);

  const migrationsFolder = candidates.find((p) => fs.existsSync(p));
  if (!migrationsFolder) {
    logger.warn({ candidates }, "No migrations folder found — skipping database migrations");
    return;
  }

  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("@workspace/db");
  await migrate(db, { migrationsFolder });
  logger.info({ migrationsFolder }, "Database migrations applied");
}
