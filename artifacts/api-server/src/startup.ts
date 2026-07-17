/**
 * Server ishga tushishidan oldin:
 *  1. Baza ulanishini tekshiradi
 *  2. admin foydalanuvchini yaratadi (agar yo'q bo'lsa)
 */
import pg from "pg";
import bcrypt from "bcryptjs";
import { logger } from "./lib/logger";

const { Pool } = pg;

export async function runStartupTasks(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    logger.warn("DATABASE_URL yo'q — startup seed o'tkazib yuborildi");
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    // 1. Ulanishni tekshir
    await pool.query("SELECT 1");
    logger.info("Baza ulanishi muvaffaqiyatli");

    // 2. users jadvali bormi?
    const tableRes = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'users'
      ) AS exists
    `);

    if (!tableRes.rows[0]?.exists) {
      logger.warn(
        "users jadvali topilmadi — avval 'pnpm --filter @workspace/db run push' ishlatilishi kerak"
      );
      return;
    }

    // 3. admin bormi?
    const adminRes = await pool.query<{ id: number }>(
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      ["admin"]
    );

    if (adminRes.rows.length > 0) {
      logger.info("admin foydalanuvchi allaqachon mavjud");
      return;
    }

    // 4. admin yo'q — yaratamiz
    const hash = await bcrypt.hash("admin123", 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)`,
      ["admin", hash, "Administrator", "admin"]
    );
    logger.info("admin foydalanuvchi yaratildi (admin / admin123)");
  } catch (err) {
    logger.error({ err }, "Startup seed xatoligi — server baribir ishga tushadi");
  } finally {
    await pool.end();
  }
}
