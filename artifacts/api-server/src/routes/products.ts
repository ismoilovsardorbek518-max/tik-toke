import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  unitsTable,
  productionOutputsTable,
  deliveryItemsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Get all products with stock levels
router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const { search } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: productsTable.id,
      code: productsTable.code,
      name: productsTable.name,
      unitId: productsTable.unitId,
      unitName: unitsTable.name,
      unitShort: unitsTable.shortName,
      sellingPrice: productsTable.sellingPrice,
      description: productsTable.description,
      createdAt: productsTable.createdAt,
      produced: sql<string>`coalesce((
        select sum(po.quantity::numeric) from production_outputs po where po.product_id = ${productsTable.id}
      ), 0)`,
      delivered: sql<string>`coalesce((
        select sum(di.quantity::numeric) from delivery_items di where di.product_id = ${productsTable.id}
      ), 0)`,
    })
    .from(productsTable)
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .orderBy(productsTable.name);

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
      stock: (parseFloat(r.produced) - parseFloat(r.delivered)).toFixed(3),
    }))
  );
});

// Create product
router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const { code, name, unitId, sellingPrice, description } = req.body;
  if (!name) { res.status(400).json({ error: "name kerak" }); return; }
  const [row] = await db.insert(productsTable).values({ code, name, unitId, sellingPrice, description }).returning();
  res.status(201).json(row);
});

// Update product
router.put("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { code, name, unitId, sellingPrice, description } = req.body;
  const [row] = await db.update(productsTable).set({ code, name, unitId, sellingPrice, description }).where(eq(productsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Topilmadi" }); return; }
  res.json(row);
});

// Delete product
router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

export default router;
