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
// External URL: *.render.com or localhost — SSL needed (or none)
const dbUrl = process.env.DATABASE_URL!;
const isInternalRender = /postgresql:\/\/[^@]+@dpg-[^./]+\//.test(dbUrl);
export const pool = new Pool({
  connectionString: dbUrl,
  ssl: isInternalRender || dbUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
