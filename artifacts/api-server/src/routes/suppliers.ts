import { Router } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import {
  CreateSupplierBody, UpdateSupplierBody, GetSupplierParams, UpdateSupplierParams, DeleteSupplierParams,
  GetSuppliersQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

function fmt(s: typeof suppliersTable.$inferSelect) {
  return { ...s, balance: Number(s.balance) };
}

router.get("/suppliers", async (req, res): Promise<void> => {
  const params = GetSuppliersQueryParams.safeParse(req.query);
  const where = params.success && params.data.search ? ilike(suppliersTable.name, `%${params.data.search}%`) : undefined;
  const rows = await db.select().from(suppliersTable).where(where).orderBy(suppliersTable.name);
  res.json(rows.map(fmt));
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(suppliersTable).values(parsed.data).returning();
  res.status(201).json(fmt(row));
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const params = GetSupplierParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(fmt(row));
});

router.put("/suppliers/:id", async (req, res): Promise<void> => {
  const params = UpdateSupplierParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(suppliersTable).set(parsed.data).where(eq(suppliersTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(fmt(row));
});

router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const params = DeleteSupplierParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(suppliersTable).where(eq(suppliersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
