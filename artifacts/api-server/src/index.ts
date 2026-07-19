import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { runStartupTasks } from "./startup";

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

// Baza seed (admin yaratish) → keyin server ishga tushadi
await runStartupTasks();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Render.com bepul tier: har 2 daqiqada o'ziga ping — uxlamaslik uchun
  const selfUrl = process.env["RENDER_EXTERNAL_URL"];
  if (selfUrl) {
    const pingUrl = `${selfUrl}/api/healthz`;
    setInterval(() => {
      fetch(pingUrl).catch(() => {});
    }, 2 * 60 * 1000);
    logger.info({ pingUrl }, "Self-ping started (every 2 min)");
  }

  // Neon DB bepul tier: har 4 daqiqada oddiy query — compute uxlamaslik uchun
  setInterval(async () => {
    try {
      await pool.query("SELECT 1");
    } catch {
      // jimgina o'tib ketadi
    }
  }, 4 * 60 * 1000);
  logger.info("DB keep-alive started (every 4 min)");
});
