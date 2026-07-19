import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// DB ga ham ping — Neon bepul tier compute uxlamasligi uchun
router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
  } catch {
    // DB ping muvaffaqiyatsiz bo'lsa ham server "ok" qaytaradi
  }
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
