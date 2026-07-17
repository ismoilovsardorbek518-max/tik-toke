import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  rawMaterialsTable,
  unitsTable,
  productRecipesTable,
  productionOutputsTable,
  deliveryItemsTable,
  stockAdjustmentsTable,
  rmReceiptItemsTable,
  productionInputsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/forecast", requireAuth, async (req, res): Promise<void> => {
  // 1. Hom ashyo qoldiqlari
  const rms = await db
    .select({
      id: rawMaterialsTable.id,
      name: rawMaterialsTable.name,
      code: rawMaterialsTable.code,
      unitShort: unitsTable.shortName,
      received: sql<string>`coalesce((select sum(r.quantity::numeric) from rm_receipt_items r where r.raw_material_id = ${rawMaterialsTable.id}),0)`,
      used:     sql<string>`coalesce((select sum(p.quantity::numeric) from production_inputs p where p.raw_material_id = ${rawMaterialsTable.id}),0)`,
      adjusted: sql<string>`coalesce((select sum(a.quantity::numeric) from stock_adjustments a where a.type='raw_material' and a.item_id = ${rawMaterialsTable.id}),0)`,
    })
    .from(rawMaterialsTable)
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id));

  const rmStock = new Map<number, number>();
  const rmInfo = new Map<number, { name: string; code: string | null; unitShort: string | null; stock: number }>();
  for (const r of rms) {
    const stock = parseFloat(r.received) - parseFloat(r.used) + parseFloat(r.adjusted);
    rmStock.set(r.id, stock);
    rmInfo.set(r.id, { name: r.name, code: r.code, unitShort: r.unitShort, stock });
  }

  // 2. Mahsulotlar va ularning receptlari
  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      code: productsTable.code,
      unitShort: unitsTable.shortName,
    })
    .from(productsTable)
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id));

  const allRecipes = await db
    .select({
      productId: productRecipesTable.productId,
      rawMaterialId: productRecipesTable.rawMaterialId,
      quantityPerUnit: productRecipesTable.quantityPerUnit,
      rawMaterialName: rawMaterialsTable.name,
      rawMaterialCode: rawMaterialsTable.code,
      unitShort: unitsTable.shortName,
    })
    .from(productRecipesTable)
    .leftJoin(rawMaterialsTable, eq(productRecipesTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id));

  // 3. Har mahsulot uchun max ishlab chiqarish imkoniyati
  const result = products.map((p) => {
    const recipe = allRecipes.filter((r) => r.productId === p.id);
    let maxPossible: number | null = null;

    if (recipe.length > 0) {
      for (const r of recipe) {
        const stock = rmStock.get(r.rawMaterialId) ?? 0;
        const qpu = parseFloat(r.quantityPerUnit);
        const possible = qpu > 0 ? Math.floor(stock / qpu * 1000) / 1000 : Infinity;
        if (maxPossible === null || possible < maxPossible) {
          maxPossible = possible;
        }
      }
    }

    return {
      productId: p.id,
      productName: p.name,
      productCode: p.code,
      unitShort: p.unitShort,
      recipe: recipe.map((r) => ({
        rawMaterialId: r.rawMaterialId,
        rawMaterialName: r.rawMaterialName,
        rawMaterialCode: r.rawMaterialCode,
        unitShort: r.unitShort,
        quantityPerUnit: r.quantityPerUnit,
        currentStock: (rmStock.get(r.rawMaterialId) ?? 0).toFixed(3),
      })),
      maxPossibleUnits: maxPossible !== null ? Math.floor(maxPossible) : null,
      hasRecipe: recipe.length > 0,
    };
  });

  // 4. Xom ashyo qoldiqlari ro'yxati
  const rmList = Array.from(rmInfo.values()).map((r) => ({
    ...r,
    stock: r.stock.toFixed(3),
  }));

  res.json({ products: result, rawMaterials: rmList });
});

export default router;
