import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { warmJobsCache, startJobsRefreshLoop } from "./lib/jobs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Post-boot tasks: apply DB migrations, then keep the jobs feed warm so
  // 3,000–5,000 listings are available immediately and refreshed hourly.
  void (async () => {
    try {
      await runMigrations();
    } catch (err) {
      logger.error({ err }, "Database migration failed — apply schema manually if this persists");
    }
    try {
      await warmJobsCache();
    } catch (err) {
      logger.warn({ err }, "Jobs cache warm-up failed — will retry on next request");
    }
    startJobsRefreshLoop();
  })();
});
