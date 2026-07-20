import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Internal Render URL: dpg-xxx (no dot in hostname) — no SSL needed
// External URL (Neon, etc.) — SSL needed
const dbUrl = process.env.DATABASE_URL!;
const isInternalRender = /postgresql:\/\/[^@]+@dpg-[^./]+\//.test(dbUrl);

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: isInternalRender || dbUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
  // Neon.tech bepul tier uchun muhim sozlamalar:
  // Neon compute 5 daqiqada uxlaydi — Pool'dagi eski connection'lar buziladi.
  // idleTimeoutMillis=4min → Pool eski connection'larni o'z vaqtida yopadi.
  // connectionTimeoutMillis=15s  → Neon uyg'onishiga vaqt beradi.
  max: 5,
  idleTimeoutMillis: 4 * 60 * 1000,   // 4 daqiqa (Neon 5 daqiqada uxlaydi)
  connectionTimeoutMillis: 15_000,      // 15 sekund (Neon cold-start ~3-5s)
});

// Pool xatoliklarini tutib olish — "terminated unexpectedly" xatosini suppress qilish
pool.on("error", (err) => {
  // Neon compute restart qilganda connection'lar buziladi — bu normal
  if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
    console.error("[DB Pool error]", err.message);
  }
});

export const db = drizzle(pool, { schema });

export * from "./schema";
