import { Router } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  CreateCustomerBody, UpdateCustomerBody, GetCustomerParams, UpdateCustomerParams, DeleteCustomerParams,
  GetCustomersQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

function fmt(c: typeof customersTable.$inferSelect) {
  return { ...c, balance: Number(c.balance) };
}

router.get("/customers", async (req, res): Promise<void> => {
  const params = GetCustomersQueryParams.safeParse(req.query);
  const where = params.success && params.data.search ? ilike(customersTable.name, `%${params.data.search}%`) : undefined;
  const rows = await db.select().from(customersTable).where(where).orderBy(customersTable.name);
  res.json(rows.map(fmt));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(fmt(row));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(fmt(row));
});

router.put("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(customersTable).set(parsed.data).where(eq(customersTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(fmt(row));
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(customersTable).where(eq(customersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
