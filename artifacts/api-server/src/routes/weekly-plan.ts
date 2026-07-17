import { Router } from "express";
import { db } from "@workspace/db";
import { weeklyPlanTable, productsTable, unitsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Get weekly plan for a given week (weekStart = YYYY-MM-DD)
router.get("/weekly-plan", requireAuth, async (req, res): Promise<void> => {
  const { weekStart } = req.query as Record<string, string>;
  if (!weekStart) { res.status(400).json({ error: "weekStart kerak" }); return; }

  const rows = await db
    .select({
      id: weeklyPlanTable.id,
      weekStart: weeklyPlanTable.weekStart,
      productId: weeklyPlanTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      unitShort: unitsTable.shortName,
      plannedQuantity: weeklyPlanTable.plannedQuantity,
      note: weeklyPlanTable.note,
      updatedAt: weeklyPlanTable.updatedAt,
    })
    .from(weeklyPlanTable)
    .leftJoin(productsTable, eq(weeklyPlanTable.productId, productsTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(eq(weeklyPlanTable.weekStart, weekStart))
    .orderBy(productsTable.name);

  res.json(rows);
});

// Upsert a plan row (add or update)
router.post("/weekly-plan", requireAuth, async (req, res): Promise<void> => {
  const { weekStart, productId, plannedQuantity, note } = req.body;
  if (!weekStart || !productId) { res.status(400).json({ error: "weekStart va productId kerak" }); return; }

  // Check if exists
  const [existing] = await db
    .select()
    .from(weeklyPlanTable)
    .where(and(eq(weeklyPlanTable.weekStart, weekStart), eq(weeklyPlanTable.productId, parseInt(productId))));

  let row;
  if (existing) {
    [row] = await db
      .update(weeklyPlanTable)
      .set({ plannedQuantity: parseFloat(plannedQuantity || "0").toFixed(3), note: note || null, updatedAt: new Date() })
      .where(eq(weeklyPlanTable.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(weeklyPlanTable)
      .values({ weekStart, productId: parseInt(productId), plannedQuantity: parseFloat(plannedQuantity || "0").toFixed(3), note: note || null })
      .returning();
  }
  res.status(201).json(row);
});

// Delete a plan row
router.delete("/weekly-plan/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(weeklyPlanTable).where(eq(weeklyPlanTable.id, id));
  res.json({ ok: true });
});

export default router;
