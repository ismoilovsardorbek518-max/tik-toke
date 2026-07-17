import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  unitsTable,
  productionOutputsTable,
  deliveryItemsTable,
  stockAdjustmentsTable,
  productRecipesTable,
  rawMaterialsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Auto-code generator: PRD-00001
async function nextProductCode(): Promise<string> {
  const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(productsTable);
  return `PRD-${(Number(c) + 1).toString().padStart(5, "0")}`;
}

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
      weight: productsTable.weight,
      description: productsTable.description,
      createdAt: productsTable.createdAt,
      produced: sql<string>`coalesce((
        select sum(po.quantity::numeric) from production_outputs po where po.product_id = ${productsTable.id}
      ), 0)`,
      delivered: sql<string>`coalesce((
        select sum(di.quantity::numeric) from delivery_items di where di.product_id = ${productsTable.id}
      ), 0)`,
      adjusted: sql<string>`coalesce((
        select sum(sa.quantity::numeric) from stock_adjustments sa where sa.type = 'product' and sa.item_id = ${productsTable.id}
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
      stock: (parseFloat(r.produced) - parseFloat(r.delivered) + parseFloat(r.adjusted)).toFixed(3),
    }))
  );
});

// Create product
router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const { code, name, unitId, sellingPrice, weight, description } = req.body;
  if (!name) { res.status(400).json({ error: "name kerak" }); return; }
  const autoCode = code || await nextProductCode();
  const [row] = await db.insert(productsTable).values({
    code: autoCode, name, unitId, sellingPrice, weight: weight || null, description
  }).returning();
  res.status(201).json(row);
});

// Update product
router.put("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { code, name, unitId, sellingPrice, weight, description } = req.body;
  const [row] = await db.update(productsTable).set({
    code, name, unitId, sellingPrice, weight: weight || null, description
  }).where(eq(productsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Topilmadi" }); return; }
  res.json(row);
});

// Delete product
router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

// --- Recipe (formula) endpoints ---

// Get recipe for a product
router.get("/products/:id/recipe", requireAuth, async (req, res): Promise<void> => {
  const productId = parseInt(req.params.id as string);
  const rows = await db
    .select({
      id: productRecipesTable.id,
      productId: productRecipesTable.productId,
      rawMaterialId: productRecipesTable.rawMaterialId,
      rawMaterialName: rawMaterialsTable.name,
      rawMaterialCode: rawMaterialsTable.code,
      unitShort: unitsTable.shortName,
      quantityPerUnit: productRecipesTable.quantityPerUnit,
    })
    .from(productRecipesTable)
    .leftJoin(rawMaterialsTable, eq(productRecipesTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
    .where(eq(productRecipesTable.productId, productId));
  res.json(rows);
});

// Save (replace) recipe for a product
router.put("/products/:id/recipe", requireAuth, async (req, res): Promise<void> => {
  const productId = parseInt(req.params.id as string);
  const { items } = req.body as { items: Array<{ rawMaterialId: number; quantityPerUnit: string }> };
  if (!Array.isArray(items)) { res.status(400).json({ error: "items[] kerak" }); return; }

  // Replace existing recipe
  await db.delete(productRecipesTable).where(eq(productRecipesTable.productId, productId));
  if (items.length > 0) {
    await db.insert(productRecipesTable).values(
      items.map((i) => ({
        productId,
        rawMaterialId: i.rawMaterialId,
        quantityPerUnit: parseFloat(i.quantityPerUnit).toFixed(4),
      }))
    );
  }
  const saved = await db
    .select({
      id: productRecipesTable.id,
      rawMaterialId: productRecipesTable.rawMaterialId,
      rawMaterialName: rawMaterialsTable.name,
      unitShort: unitsTable.shortName,
      quantityPerUnit: productRecipesTable.quantityPerUnit,
    })
    .from(productRecipesTable)
    .leftJoin(rawMaterialsTable, eq(productRecipesTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
    .where(eq(productRecipesTable.productId, productId));
  res.json(saved);
});

export default router;
