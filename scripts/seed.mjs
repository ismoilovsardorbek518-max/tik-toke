/**
 * Render Shell'da ishga tushirish:
 *   node scripts/seed.mjs
 *
 * Bu script:
 *   1. DATABASE_URL borligini tekshiradi
 *   2. bcryptjs bilan parolni hash qiladi
 *   3. admin foydalanuvchini bazaga qo'shadi (avval bor bo'lsa o'tkazib yuboradi)
 */

import pg from "pg";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL o'rnatilmagan! Render → Environment bo'limini tekshiring.");
  process.exit(1);
}

// bcryptjs ni dynamic import qilamiz (ESM + CJS compat)
let bcrypt;
try {
  bcrypt = (await import("bcryptjs")).default;
} catch {
  console.error("❌  bcryptjs topilmadi. `pnpm add bcryptjs` buyrug'ini ishga tushiring.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("✅  Bazaga ulanildi:", DATABASE_URL.split("@")[1] ?? "...");

    // Jadval borligini tekshir
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      ) AS exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.error("❌  'users' jadvali topilmadi.");
      console.error("    Avval sxemani push qiling:");
      console.error("    pnpm --filter @workspace/db run push");
      process.exit(1);
    }

    // Admin allaqachon bormi?
    const existing = await client.query(
      "SELECT id FROM users WHERE username = $1",
      ["admin"]
    );

    if (existing.rows.length > 0) {
      console.log("ℹ️   'admin' foydalanuvchi allaqachon mavjud — parolni yangilaymiz.");
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE username = $2",
        [hash, "admin"]
      );
      console.log("✅  Parol yangilandi: admin / admin123");
    } else {
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        `INSERT INTO users (username, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4)`,
        ["admin", hash, "Administrator", "admin"]
      );
      console.log("✅  Admin yaratildi: admin / admin123");
    }

    console.log("\n🎉  Tayyor! https://tiktoke-erp.onrender.com/login ga kiring.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌  Xatolik:", err.message);
  process.exit(1);
});
