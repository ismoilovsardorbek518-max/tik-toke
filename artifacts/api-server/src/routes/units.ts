import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, unitsTable } from "@workspace/db";
import { CreateUnitBody, UpdateUnitBody, UpdateUnitParams, DeleteUnitParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

router.get("/units", async (_req, res): Promise<void> => {
  const rows = await db.select().from(unitsTable).orderBy(unitsTable.name);
  res.json(rows);
});

router.post("/units", async (req, res): Promise<void> => {
  const parsed = CreateUnitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(unitsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.put("/units/:id", async (req, res): Promise<void> => {
  const params = UpdateUnitParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateUnitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(unitsTable).set(parsed.data).where(eq(unitsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Unit not found" }); return; }
  res.json(row);
});

router.delete("/units/:id", async (req, res): Promise<void> => {
  const params = DeleteUnitParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(unitsTable).where(eq(unitsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
