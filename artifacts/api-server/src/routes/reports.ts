import { Router } from "express";
import { db } from "@workspace/db";
import {
  rmReceiptsTable,
  rmReceiptItemsTable,
  rawMaterialsTable,
  productionsTable,
  productionOutputsTable,
  productionInputsTable,
  deliveriesTable,
  deliveryItemsTable,
  productsTable,
  customersTable,
  suppliersTable,
  unitsTable,
  stockAdjustmentsTable,
} from "@workspace/db/schema";
import { eq, desc, gte, lte, and, sum, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── Raw Material Receipts Report ──────────────────────────────────────────────
router.get("/reports/rm-receipts", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, rawMaterialId, supplierId } = req.query as Record<string, string>;

  const cond: any[] = [];
  if (startDate) cond.push(gte(rmReceiptsTable.date, startDate));
  if (endDate) cond.push(lte(rmReceiptsTable.date, endDate));
  if (supplierId) cond.push(eq(rmReceiptsTable.supplierId, parseInt(supplierId)));

  const rows = await db
    .select({
      receiptId: rmReceiptsTable.id,
      receiptNumber: rmReceiptsTable.receiptNumber,
      date: rmReceiptsTable.date,
      supplierName: suppliersTable.name,
      rawMaterialId: rmReceiptItemsTable.rawMaterialId,
      rawMaterialName: rawMaterialsTable.name,
      rawMaterialCode: rawMaterialsTable.code,
      unitShort: unitsTable.shortName,
      quantity: rmReceiptItemsTable.quantity,
      unitPrice: rmReceiptItemsTable.unitPrice,
      totalPrice: rmReceiptItemsTable.totalPrice,
    })
    .from(rmReceiptsTable)
    .innerJoin(rmReceiptItemsTable, eq(rmReceiptItemsTable.receiptId, rmReceiptsTable.id))
    .leftJoin(rawMaterialsTable, eq(rmReceiptItemsTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(suppliersTable, eq(rmReceiptsTable.supplierId, suppliersTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(rmReceiptsTable.date));

  const filtered = rawMaterialId
    ? rows.filter((r) => r.rawMaterialId === parseInt(rawMaterialId))
    : rows;

  res.json(filtered);
});

// ── Production Report ─────────────────────────────────────────────────────────
router.get("/reports/productions", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, productId } = req.query as Record<string, string>;

  const cond: any[] = [];
  if (startDate) cond.push(gte(productionsTable.date, startDate));
  if (endDate) cond.push(lte(productionsTable.date, endDate));

  const outputs = await db
    .select({
      productionId: productionsTable.id,
      productionNumber: productionsTable.productionNumber,
      date: productionsTable.date,
      note: productionsTable.note,
      productId: productionOutputsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      unitShort: unitsTable.shortName,
      quantity: productionOutputsTable.quantity,
      unitCost: productionOutputsTable.unitCost,
      totalCost: productionOutputsTable.totalCost,
    })
    .from(productionsTable)
    .innerJoin(productionOutputsTable, eq(productionOutputsTable.productionId, productionsTable.id))
    .leftJoin(productsTable, eq(productionOutputsTable.productId, productsTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(productionsTable.date));

  const filtered = productId
    ? outputs.filter((r) => r.productId === parseInt(productId))
    : outputs;

  res.json(filtered);
});

// ── Deliveries Report ─────────────────────────────────────────────────────────
router.get("/reports/deliveries", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, customerId, productId } = req.query as Record<string, string>;

  const cond: any[] = [];
  if (startDate) cond.push(gte(deliveriesTable.date, startDate));
  if (endDate) cond.push(lte(deliveriesTable.date, endDate));
  if (customerId) cond.push(eq(deliveriesTable.customerId, parseInt(customerId)));

  const rows = await db
    .select({
      deliveryId: deliveriesTable.id,
      deliveryNumber: deliveriesTable.deliveryNumber,
      date: deliveriesTable.date,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      paymentMethod: deliveriesTable.paymentMethod,
      productId: deliveryItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      unitShort: unitsTable.shortName,
      quantity: deliveryItemsTable.quantity,
      unitPrice: deliveryItemsTable.unitPrice,
      discountPercent: deliveryItemsTable.discountPercent,
      totalPrice: deliveryItemsTable.totalPrice,
    })
    .from(deliveriesTable)
    .innerJoin(deliveryItemsTable, eq(deliveryItemsTable.deliveryId, deliveriesTable.id))
    .leftJoin(productsTable, eq(deliveryItemsTable.productId, productsTable.id))
    .leftJoin(customersTable, eq(deliveriesTable.customerId, customersTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(deliveriesTable.date));

  const filtered = productId
    ? rows.filter((r) => r.productId === parseInt(productId))
    : rows;

  res.json(filtered);
});

// ── Profit Report ──────────────────────────────────────────────────────────────
// Foyda = davr ichidagi yuk chiqarish (sotuv) summasi - shu davrda ishlab chiqarilgan
// mahsulotlarning tannarxi (kirim narxi asosida).
router.get("/reports/profit", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as Record<string, string>;

  const delivCond: any[] = [];
  if (startDate) delivCond.push(gte(deliveriesTable.date, startDate));
  if (endDate) delivCond.push(lte(deliveriesTable.date, endDate));

  const prodCond: any[] = [];
  if (startDate) prodCond.push(gte(productionsTable.date, startDate));
  if (endDate) prodCond.push(lte(productionsTable.date, endDate));

  // Revenue by product (from deliveries)
  const revenueRows = await db
    .select({
      productId: deliveryItemsTable.productId,
      productName: productsTable.name,
      unitShort: unitsTable.shortName,
      quantity: sum(deliveryItemsTable.quantity).as("quantity"),
      revenue: sql<string>`coalesce(sum(${deliveryItemsTable.totalPrice}), 0)`,
    })
    .from(deliveryItemsTable)
    .innerJoin(deliveriesTable, eq(deliveryItemsTable.deliveryId, deliveriesTable.id))
    .leftJoin(productsTable, eq(deliveryItemsTable.productId, productsTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(delivCond.length ? and(...delivCond) : undefined)
    .groupBy(deliveryItemsTable.productId, productsTable.name, unitsTable.shortName);

  // Production cost by product (from production outputs)
  const costRows = await db
    .select({
      productId: productionOutputsTable.productId,
      quantity: sum(productionOutputsTable.quantity).as("quantity"),
      cost: sql<string>`coalesce(sum(${productionOutputsTable.totalCost}), 0)`,
    })
    .from(productionOutputsTable)
    .innerJoin(productionsTable, eq(productionOutputsTable.productionId, productionsTable.id))
    .where(prodCond.length ? and(...prodCond) : undefined)
    .groupBy(productionOutputsTable.productId);

  const costByProduct = new Map<number, { quantity: string; cost: string }>();
  costRows.forEach((r) => costByProduct.set(r.productId as number, { quantity: r.quantity ?? "0", cost: r.cost }));

  const rows = revenueRows.map((r) => {
    const c = costByProduct.get(r.productId as number);
    const revenue = parseFloat(r.revenue);
    const producedQty = parseFloat(c?.quantity || "0");
    const cost = parseFloat(c?.cost || "0");
    // Average tannarx per unit produced this period, applied to delivered quantity
    const avgUnitCost = producedQty > 0 ? cost / producedQty : 0;
    const deliveredQty = parseFloat((r.quantity as string) || "0");
    const estimatedCost = avgUnitCost * deliveredQty;
    return {
      productId: r.productId,
      productName: r.productName,
      unitShort: r.unitShort,
      quantitySold: r.quantity,
      revenue: revenue.toFixed(2),
      cost: estimatedCost.toFixed(2),
      profit: (revenue - estimatedCost).toFixed(2),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + parseFloat(r.revenue),
      cost: acc.cost + parseFloat(r.cost),
      profit: acc.profit + parseFloat(r.profit),
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );

  res.json({
    rows,
    totals: {
      revenue: totals.revenue.toFixed(2),
      cost: totals.cost.toFixed(2),
      profit: totals.profit.toFixed(2),
    },
  });
});

// ── Production Plan (next-week forecast based on past N weeks of deliveries) ──
router.get("/reports/production-plan", requireAuth, async (req, res): Promise<void> => {
  const weeks = Math.max(1, parseInt((req.query.weeks as string) || "4"));
  const endDate = new Date().toISOString().split("T")[0];
  const startMs = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
  const startDate = new Date(startMs).toISOString().split("T")[0];

  // 1. Total delivered qty per product in the period
  const delivRows = await db
    .select({
      productId: deliveryItemsTable.productId,
      productName: productsTable.name,
      unitShort: unitsTable.shortName,
      totalQty: sum(deliveryItemsTable.quantity).as("totalQty"),
    })
    .from(deliveryItemsTable)
    .innerJoin(deliveriesTable, eq(deliveryItemsTable.deliveryId, deliveriesTable.id))
    .leftJoin(productsTable, eq(deliveryItemsTable.productId, productsTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(and(gte(deliveriesTable.date, startDate), lte(deliveriesTable.date, endDate)))
    .groupBy(deliveryItemsTable.productId, productsTable.name, unitsTable.shortName);

  // 2. Current stock per product
  const allProducts = await db
    .select({
      id: productsTable.id,
      produced: sql<string>`coalesce((select sum(po.quantity::numeric) from production_outputs po where po.product_id = ${productsTable.id}), 0)`,
      delivered: sql<string>`coalesce((select sum(di.quantity::numeric) from delivery_items di where di.product_id = ${productsTable.id}), 0)`,
      adjusted: sql<string>`coalesce((select sum(sa.quantity::numeric) from stock_adjustments sa where sa.type = 'product' and sa.item_id = ${productsTable.id}), 0)`,
    })
    .from(productsTable);

  const stockMap = new Map<number, number>();
  allProducts.forEach((r) => {
    stockMap.set(r.id, parseFloat(r.produced) - parseFloat(r.delivered) + parseFloat(r.adjusted));
  });

  // 3. Historical input/output ratios: for each product, how much raw material per unit produced
  //    Group: productionId -> outputs / inputs
  const allOutputs = await db
    .select({
      productionId: productionOutputsTable.productionId,
      productId: productionOutputsTable.productId,
      quantity: productionOutputsTable.quantity,
    })
    .from(productionOutputsTable);

  const allInputs = await db
    .select({
      productionId: productionInputsTable.productionId,
      rawMaterialId: productionInputsTable.rawMaterialId,
      rmName: rawMaterialsTable.name,
      rmUnitShort: unitsTable.shortName,
      quantity: productionInputsTable.quantity,
    })
    .from(productionInputsTable)
    .leftJoin(rawMaterialsTable, eq(productionInputsTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id));

  // inputs indexed by productionId
  const inputsByProd = new Map<number, typeof allInputs>();
  allInputs.forEach((inp) => {
    if (!inputsByProd.has(inp.productionId)) inputsByProd.set(inp.productionId, []);
    inputsByProd.get(inp.productionId)!.push(inp);
  });

  // ratioAccum[productId][rmId] = { totalRmQty, totalProductQty, rmName, rmUnitShort }
  const ratioAccum = new Map<number, Map<number, { totalRmQty: number; totalProdQty: number; rmName: string; rmUnitShort: string }>>();

  allOutputs.forEach((out) => {
    const outQty = parseFloat(out.quantity);
    if (outQty <= 0) return;
    const inputs = inputsByProd.get(out.productionId) || [];
    if (!ratioAccum.has(out.productId)) ratioAccum.set(out.productId, new Map());
    const rmMap = ratioAccum.get(out.productId)!;
    inputs.forEach((inp) => {
      const inpQty = parseFloat(inp.quantity);
      const existing = rmMap.get(inp.rawMaterialId);
      if (existing) {
        existing.totalRmQty += inpQty;
        existing.totalProdQty += outQty;
      } else {
        rmMap.set(inp.rawMaterialId, {
          totalRmQty: inpQty,
          totalProdQty: outQty,
          rmName: inp.rmName || "",
          rmUnitShort: inp.rmUnitShort || "",
        });
      }
    });
  });

  // 4. Build plan rows
  const planRows = delivRows.map((d) => {
    const avgWeekly = parseFloat((d.totalQty as string) || "0") / weeks;
    const currentStock = stockMap.get(d.productId as number) || 0;
    const needed = Math.max(0, avgWeekly - currentStock);
    return {
      productId: d.productId,
      productName: d.productName,
      unitShort: d.unitShort,
      avgWeeklySales: avgWeekly.toFixed(3),
      currentStock: currentStock.toFixed(3),
      recommendedProduction: needed.toFixed(3),
    };
  });

  // 5. Aggregate raw material needs from recommended production quantities
  const rmNeedsMap = new Map<number, { rmName: string; rmUnitShort: string; needed: number }>();
  planRows.forEach((row) => {
    const prodNeeded = parseFloat(row.recommendedProduction);
    if (prodNeeded <= 0) return;
    const rmMap = ratioAccum.get(row.productId as number);
    if (!rmMap) return;
    rmMap.forEach((val, rmId) => {
      const ratio = val.totalProdQty > 0 ? val.totalRmQty / val.totalProdQty : 0;
      const needed = prodNeeded * ratio;
      const existing = rmNeedsMap.get(rmId);
      if (existing) {
        existing.needed += needed;
      } else {
        rmNeedsMap.set(rmId, { rmName: val.rmName, rmUnitShort: val.rmUnitShort, needed });
      }
    });
  });

  res.json({
    weeks,
    startDate,
    endDate,
    planRows,
    rmNeeds: Array.from(rmNeedsMap.entries()).map(([id, v]) => ({
      rawMaterialId: id,
      rawMaterialName: v.rmName,
      unitShort: v.rmUnitShort,
      neededQty: v.needed.toFixed(3),
    })),
  });
});

// ── Dashboard Summary ─────────────────────────────────────────────────────────
router.get("/reports/summary", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [delivTotal] = await db
    .select({ total: sql<string>`coalesce(sum(total_amount::numeric), 0)` })
    .from(deliveriesTable)
    .where(gte(deliveriesTable.date, monthStart));

  const [delivCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deliveriesTable)
    .where(gte(deliveriesTable.date, monthStart));

  const [prodCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productionsTable)
    .where(gte(productionsTable.date, monthStart));

  const [rmTotal] = await db
    .select({ total: sql<string>`coalesce(sum(total_amount::numeric), 0)` })
    .from(rmReceiptsTable)
    .where(gte(rmReceiptsTable.date, monthStart));

  res.json({
    monthlyRevenue: parseFloat(delivTotal.total),
    monthlyDeliveries: Number(delivCount.count),
    monthlyProductions: Number(prodCount.count),
    monthlyRmCost: parseFloat(rmTotal.total),
  });
});

export default router;
