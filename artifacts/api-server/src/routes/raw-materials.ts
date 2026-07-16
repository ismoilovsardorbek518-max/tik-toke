import { Router } from "express";
import { db } from "@workspace/db";
import {
  rawMaterialsTable,
  unitsTable,
  rmReceiptItemsTable,
  productionInputsTable,
  stockAdjustmentsTable,
} from "@workspace/db/schema";
import { eq, sql, ilike, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Get all raw materials with stock levels
router.get("/raw-materials", requireAuth, async (req, res): Promise<void> => {
  const { search } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: rawMaterialsTable.id,
      code: rawMaterialsTable.code,
      name: rawMaterialsTable.name,
      unitId: rawMaterialsTable.unitId,
      unitName: unitsTable.name,
      unitShort: unitsTable.shortName,
      description: rawMaterialsTable.description,
      createdAt: rawMaterialsTable.createdAt,
      received: sql<string>`coalesce((
        select sum(qty.quantity::numeric) from rm_receipt_items qty where qty.raw_material_id = ${rawMaterialsTable.id}
      ), 0)`,
      used: sql<string>`coalesce((
        select sum(pi.quantity::numeric) from production_inputs pi where pi.raw_material_id = ${rawMaterialsTable.id}
      ), 0)`,
      adjusted: sql<string>`coalesce((
        select sum(sa.quantity::numeric) from stock_adjustments sa where sa.type = 'raw_material' and sa.item_id = ${rawMaterialsTable.id}
      ), 0)`,
    })
    .from(rawMaterialsTable)
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
    .orderBy(rawMaterialsTable.name);

  const filtered = search
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          (r.code ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  res.json(
    filtered.map((r) => ({
      ...r,
      stock: (parseFloat(r.received) - parseFloat(r.used) + parseFloat(r.adjusted)).toFixed(3),
    }))
  );
});

// Create raw material
router.post("/raw-materials", requireAuth, async (req, res): Promise<void> => {
  const { code, name, unitId, description } = req.body;
  if (!name) { res.status(400).json({ error: "name kerak" }); return; }
  const [row] = await db.insert(rawMaterialsTable).values({ code, name, unitId, description }).returning();
  res.status(201).json(row);
});

// Update raw material
router.put("/raw-materials/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { code, name, unitId, description } = req.body;
  const [row] = await db.update(rawMaterialsTable).set({ code, name, unitId, description }).where(eq(rawMaterialsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Topilmadi" }); return; }
  res.json(row);
});

// Delete raw material
router.delete("/raw-materials/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(rawMaterialsTable).where(eq(rawMaterialsTable.id, id));
  res.json({ ok: true });
});

export default router;
