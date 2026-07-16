import { Router } from "express";
import { db } from "@workspace/db";
import {
  stockAdjustmentsTable,
  productsTable,
  rawMaterialsTable,
  unitsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// List all adjustments with item names
router.get("/adjustments", requireAuth, async (req, res): Promise<void> => {
  const { type } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: stockAdjustmentsTable.id,
      type: stockAdjustmentsTable.type,
      itemId: stockAdjustmentsTable.itemId,
      quantity: stockAdjustmentsTable.quantity,
      reason: stockAdjustmentsTable.reason,
      date: stockAdjustmentsTable.date,
      createdAt: stockAdjustmentsTable.createdAt,
    })
    .from(stockAdjustmentsTable)
    .orderBy(desc(stockAdjustmentsTable.date), desc(stockAdjustmentsTable.id));

  // Attach item names
  const products = await db
    .select({ id: productsTable.id, name: productsTable.name, unitShort: unitsTable.shortName })
    .from(productsTable)
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id));

  const rms = await db
    .select({ id: rawMaterialsTable.id, name: rawMaterialsTable.name, unitShort: unitsTable.shortName })
    .from(rawMaterialsTable)
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id));

  const productMap = new Map(products.map((p) => [p.id, p]));
  const rmMap = new Map(rms.map((r) => [r.id, r]));

  const enriched = rows.map((row) => {
    const item =
      row.type === "product"
        ? productMap.get(row.itemId)
        : rmMap.get(row.itemId);
    return {
      ...row,
      itemName: item?.name ?? "—",
      unitShort: item?.unitShort ?? "",
    };
  });

  const filtered = type ? enriched.filter((r) => r.type === type) : enriched;
  res.json(filtered);
});

// Create adjustment
router.post("/adjustments", requireAuth, async (req, res): Promise<void> => {
  const { type, itemId, quantity, reason, date } = req.body;
  if (!type || !itemId || !quantity || !date) {
    res.status(400).json({ error: "type, itemId, quantity, date kerak" });
    return;
  }
  if (!["product", "raw_material"].includes(type)) {
    res.status(400).json({ error: "type 'product' yoki 'raw_material' bo'lishi kerak" });
    return;
  }
  const [row] = await db
    .insert(stockAdjustmentsTable)
    .values({
      type,
      itemId: parseInt(itemId),
      quantity: parseFloat(quantity).toFixed(3),
      reason: reason || null,
      date,
    })
    .returning();
  res.status(201).json(row);
});

// Delete adjustment
router.delete("/adjustments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(stockAdjustmentsTable).where(eq(stockAdjustmentsTable.id, id));
  res.json({ ok: true });
});

export default router;
