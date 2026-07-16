import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    // Healthz ping logda ko'rinmasin
    autoLogging: {
      ignore: (req) => req.url?.includes("/healthz") ?? false,
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Production'da React statik fayllarini serve qilish
if (process.env.NODE_ENV === "production") {
  const staticDir = path.join(process.cwd(), "artifacts/tiktoke-erp/dist/public");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback — barcha notopilgan route'lar uchun index.html
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}

export default app;
