import { Router } from "express";
import { db } from "@workspace/db";
import {
  rawMaterialsTable,
  productsTable,
  rmReceiptsTable,
  rmReceiptItemsTable,
  productionInputsTable,
  productionOutputsTable,
  deliveriesTable,
  deliveryItemsTable,
  productionsTable,
  customersTable,
} from "@workspace/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  // Count raw materials and compute low stock
  const rawMaterials = await db.select({
    id: rawMaterialsTable.id,
    name: rawMaterialsTable.name,
    received: sql<string>`coalesce((select sum(q::numeric) from (select quantity as q from rm_receipt_items where raw_material_id = ${rawMaterialsTable.id}) x), 0)`,
    used: sql<string>`coalesce((select sum(q::numeric) from (select quantity as q from production_inputs where raw_material_id = ${rawMaterialsTable.id}) x), 0)`,
  }).from(rawMaterialsTable);

  const rmCount = rawMaterials.length;
  const rmLowStock = rawMaterials.filter(r => (parseFloat(r.received) - parseFloat(r.used)) <= 0).length;

  // Count products and compute low stock
  const products = await db.select({
    id: productsTable.id,
    name: productsTable.name,
    produced: sql<string>`coalesce((select sum(q::numeric) from (select quantity as q from production_outputs where product_id = ${productsTable.id}) x), 0)`,
    delivered: sql<string>`coalesce((select sum(q::numeric) from (select quantity as q from delivery_items where product_id = ${productsTable.id}) x), 0)`,
  }).from(productsTable);

  const productCount = products.length;
  const productLowStock = products.filter(p => (parseFloat(p.produced) - parseFloat(p.delivered)) <= 0).length;

  // This month revenue
  const [revRow] = await db.select({
    total: sql<string>`coalesce(sum(total_amount::numeric), 0)`,
    count: sql<number>`count(*)`,
  }).from(deliveriesTable).where(sql`date >= ${monthStart}`);

  // This month productions
  const [prodRow] = await db.select({ count: sql<number>`count(*)` })
    .from(productionsTable).where(sql`date >= ${monthStart}`);

  // Recent deliveries
  const recentDeliveries = await db.select({
    id: deliveriesTable.id,
    deliveryNumber: deliveriesTable.deliveryNumber,
    date: deliveriesTable.date,
    customerName: customersTable.name,
    totalAmount: deliveriesTable.totalAmount,
    paymentMethod: deliveriesTable.paymentMethod,
  })
    .from(deliveriesTable)
    .leftJoin(customersTable, eq(deliveriesTable.customerId, customersTable.id))
    .orderBy(desc(deliveriesTable.id))
    .limit(5);

  res.json({
    rawMaterialCount: rmCount,
    rawMaterialLowStock: rmLowStock,
    productCount,
    productLowStock,
    monthlyRevenue: parseFloat(revRow.total),
    monthlyDeliveries: Number(revRow.count),
    monthlyProductions: Number(prodRow.count),
    recentDeliveries,
  });
});

export default router;
