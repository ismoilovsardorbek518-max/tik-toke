import { Router } from "express";
import { db } from "@workspace/db";
import {
  productionsTable,
  productionOutputsTable,
  productionInputsTable,
  productsTable,
  rawMaterialsTable,
  unitsTable,
  productRecipesTable,
} from "@workspace/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// List productions with filters
router.get("/productions", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (startDate) conditions.push(gte(productionsTable.date, startDate));
  if (endDate) conditions.push(lte(productionsTable.date, endDate));

  const prods = await db
    .select()
    .from(productionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(productionsTable.date), desc(productionsTable.id));

  const result = await Promise.all(
    prods.map(async (p) => {
      const outputs = await db
        .select({
          productName: productsTable.name,
          quantity: productionOutputsTable.quantity,
          unitCost: productionOutputsTable.unitCost,
          totalCost: productionOutputsTable.totalCost,
          unitShort: unitsTable.shortName,
        })
        .from(productionOutputsTable)
        .leftJoin(productsTable, eq(productionOutputsTable.productId, productsTable.id))
        .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
        .where(eq(productionOutputsTable.productionId, p.id));
      return { ...p, outputs };
    })
  );

  res.json(result);
});

// Get single production with full detail
router.get("/productions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const [prod] = await db.select().from(productionsTable).where(eq(productionsTable.id, id));
  if (!prod) { res.status(404).json({ error: "Topilmadi" }); return; }

  const outputs = await db
    .select({
      id: productionOutputsTable.id,
      productId: productionOutputsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      unitName: unitsTable.name,
      unitShort: unitsTable.shortName,
      quantity: productionOutputsTable.quantity,
      unitCost: productionOutputsTable.unitCost,
      totalCost: productionOutputsTable.totalCost,
    })
    .from(productionOutputsTable)
    .leftJoin(productsTable, eq(productionOutputsTable.productId, productsTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(eq(productionOutputsTable.productionId, id));

  const inputs = await db
    .select({
      id: productionInputsTable.id,
      rawMaterialId: productionInputsTable.rawMaterialId,
      rawMaterialName: rawMaterialsTable.name,
      rawMaterialCode: rawMaterialsTable.code,
      unitName: unitsTable.name,
      unitShort: unitsTable.shortName,
      quantity: productionInputsTable.quantity,
    })
    .from(productionInputsTable)
    .leftJoin(rawMaterialsTable, eq(productionInputsTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
    .where(eq(productionInputsTable.productionId, id));

  res.json({ ...prod, outputs, inputs });
});

/**
 * Recipe asosida inputs avtomatik hisoblab qaytaradi.
 * Har bir output mahsuloti uchun: quantityPerUnit * producedQty = totalRmQty
 */
async function autoCalcInputs(
  outputs: Array<{ productId: number; quantity: string }>
): Promise<Array<{ rawMaterialId: number; quantity: string }>> {
  const rmMap = new Map<number, number>();

  for (const out of outputs) {
    const qty = parseFloat(out.quantity);
    if (!qty) continue;
    const recipe = await db
      .select()
      .from(productRecipesTable)
      .where(eq(productRecipesTable.productId, out.productId));

    for (const r of recipe) {
      const needed = qty * parseFloat(r.quantityPerUnit);
      rmMap.set(r.rawMaterialId, (rmMap.get(r.rawMaterialId) ?? 0) + needed);
    }
  }

  return Array.from(rmMap.entries()).map(([rawMaterialId, total]) => ({
    rawMaterialId,
    quantity: total.toFixed(3),
  }));
}

// Create production
router.post("/productions", requireAuth, async (req, res): Promise<void> => {
  const { date, note, outputs, inputs, autoFillInputs } = req.body;
  const user = (req as any).user;

  if (!date || !outputs || !Array.isArray(outputs) || outputs.length === 0) {
    res.status(400).json({ error: "date va outputs[] kerak" }); return;
  }

  const count = await db.select({ c: sql<number>`count(*)` }).from(productionsTable);
  const num = (Number(count[0].c) + 1).toString().padStart(5, "0");
  const productionNumber = `IQ-${num}`;

  const [prod] = await db.insert(productionsTable).values({
    productionNumber,
    date,
    note: note || null,
    createdBy: user.userId,
  }).returning();

  const outputRows = outputs.map((o: any) => {
    const qty = parseFloat(o.quantity);
    const unitCost = parseFloat(o.unitCost || "0");
    return {
      productionId: prod.id,
      productId: o.productId,
      quantity: qty.toFixed(3),
      unitCost: unitCost.toFixed(2),
      totalCost: (qty * unitCost).toFixed(2),
    };
  });
  await db.insert(productionOutputsTable).values(outputRows);

  // Agar inputs berilmagan bo'lsa yoki autoFillInputs=true bo'lsa — recipe'dan hisoblash
  let finalInputs = inputs && inputs.length > 0 ? inputs : null;
  if (!finalInputs || autoFillInputs) {
    finalInputs = await autoCalcInputs(outputs.map((o: any) => ({
      productId: o.productId,
      quantity: o.quantity,
    })));
  }

  if (finalInputs && finalInputs.length > 0) {
    await db.insert(productionInputsTable).values(
      finalInputs.map((i: any) => ({
        productionId: prod.id,
        rawMaterialId: i.rawMaterialId,
        quantity: parseFloat(i.quantity).toFixed(3),
      }))
    );
  }

  res.status(201).json({ ...prod, outputs: outputRows, inputs: finalInputs });
});

// Update production
router.put("/productions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { date, note, outputs, inputs, autoFillInputs } = req.body;

  if (!date || !outputs || !Array.isArray(outputs) || outputs.length === 0) {
    res.status(400).json({ error: "date va outputs[] kerak" }); return;
  }

  const [existing] = await db.select().from(productionsTable).where(eq(productionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Topilmadi" }); return; }

  const [prod] = await db.update(productionsTable).set({
    date,
    note: note || null,
  }).where(eq(productionsTable.id, id)).returning();

  await db.delete(productionOutputsTable).where(eq(productionOutputsTable.productionId, id));
  await db.delete(productionInputsTable).where(eq(productionInputsTable.productionId, id));

  const outputRows = outputs.map((o: any) => {
    const qty = parseFloat(o.quantity);
    const unitCost = parseFloat(o.unitCost || "0");
    return {
      productionId: id,
      productId: o.productId,
      quantity: qty.toFixed(3),
      unitCost: unitCost.toFixed(2),
      totalCost: (qty * unitCost).toFixed(2),
    };
  });
  await db.insert(productionOutputsTable).values(outputRows);

  let finalInputs = inputs && inputs.length > 0 ? inputs : null;
  if (!finalInputs || autoFillInputs) {
    finalInputs = await autoCalcInputs(outputs.map((o: any) => ({
      productId: o.productId,
      quantity: o.quantity,
    })));
  }

  if (finalInputs && finalInputs.length > 0) {
    await db.insert(productionInputsTable).values(
      finalInputs.map((i: any) => ({
        productionId: id,
        rawMaterialId: i.rawMaterialId,
        quantity: parseFloat(i.quantity).toFixed(3),
      }))
    );
  }

  res.json({ ...prod, outputs: outputRows, inputs: finalInputs || [] });
});

// Delete production
router.delete("/productions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(productionsTable).where(eq(productionsTable.id, id));
  res.json({ ok: true });
});

// Get recipe-based inputs preview for given outputs (before saving)
router.post("/productions/preview-inputs", requireAuth, async (req, res): Promise<void> => {
  const { outputs } = req.body;
  if (!Array.isArray(outputs)) { res.status(400).json({ error: "outputs[] kerak" }); return; }
  const inputs = await autoCalcInputs(outputs);
  // Enrich with names
  const enriched = await Promise.all(inputs.map(async (i) => {
    const [rm] = await db
      .select({ name: rawMaterialsTable.name, code: rawMaterialsTable.code, unitShort: unitsTable.shortName })
      .from(rawMaterialsTable)
      .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
      .where(eq(rawMaterialsTable.id, i.rawMaterialId));
    return { ...i, rawMaterialName: rm?.name, rawMaterialCode: rm?.code, unitShort: rm?.unitShort };
  }));
  res.json(enriched);
});

export default router;
