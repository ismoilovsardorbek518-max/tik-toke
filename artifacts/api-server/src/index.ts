import app from "./app";
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

  // Render.com bepul tier'da server 15 daqiqa so'rovsiz "uxlaydi".
  // Har 5 daqiqada o'ziga so'rov yuborib uxlamasligini ta'minlaymiz.
  const selfUrl = process.env["RENDER_EXTERNAL_URL"];
  if (selfUrl) {
    const pingUrl = `${selfUrl}/api/healthz`;
    setInterval(() => {
      fetch(pingUrl).catch(() => {
        // Jimgina o'tib ketadi — admin interfeysiga ta'sir qilmaydi
      });
    }, 5 * 60 * 1000); // 5 daqiqa
    logger.info({ pingUrl }, "Self-ping started (every 5 min)");
  }
});
