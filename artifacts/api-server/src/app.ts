import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url?.includes("/healthz") ?? false,
    },
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// CORS — faqat bir xil origin yoki Replit dev domain
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin, server-to-server, yoki Replit preview
    if (!origin || origin.includes("replit") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
      cb(null, true);
    } else {
      cb(new Error("CORS: ruxsat etilmagan origin"));
    }
  },
  credentials: true,
}));

// Rate limit — login uchun: 15 daqiqada max 20 urinish
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining." },
}));

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

// Global error handler — stack trace mijozga chiqmaydi
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err as Record<string, unknown>;
  logger.error({ err }, "Unhandled error");
  const status = typeof e.status === "number" ? e.status : typeof e.statusCode === "number" ? e.statusCode : 500;
  // Foydalanuvchiga faqat xato xabari — hech qanday stack/internal info
  res.status(status).json({
    error: status < 500
      ? (e as Error).message
      : "Server xatosi yuz berdi. Iltimos, qayta urinib ko'ring.",
  });
});

export default app;
