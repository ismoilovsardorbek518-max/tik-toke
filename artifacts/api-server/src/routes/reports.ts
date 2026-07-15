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
