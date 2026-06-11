import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Hosted Postgres outside Render's private network (Supabase, Neon, external
// Render URLs…) requires TLS. Auto-detect, with DATABASE_SSL=true|false override.
const sslOverride = process.env.DATABASE_SSL;
const needsSsl =
  sslOverride === "true" ||
  (sslOverride !== "false" && /supabase\.(co|com)|neon\.tech|sslmode=require/i.test(connectionString));

export const pool = new Pool({
  connectionString,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
