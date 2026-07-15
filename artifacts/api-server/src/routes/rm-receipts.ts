import { Router } from "express";
import { db } from "@workspace/db";
import {
  rmReceiptsTable,
  rmReceiptItemsTable,
  rawMaterialsTable,
  suppliersTable,
  unitsTable,
} from "@workspace/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// List receipts with filters
router.get("/rm-receipts", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, supplierId } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof and>[] = [];
  if (startDate) conditions.push(gte(rmReceiptsTable.date, startDate));
  if (endDate) conditions.push(lte(rmReceiptsTable.date, endDate));
  if (supplierId) conditions.push(eq(rmReceiptsTable.supplierId, parseInt(supplierId)));

  const receipts = await db
    .select({
      id: rmReceiptsTable.id,
      receiptNumber: rmReceiptsTable.receiptNumber,
      date: rmReceiptsTable.date,
      supplierId: rmReceiptsTable.supplierId,
      supplierName: suppliersTable.name,
      note: rmReceiptsTable.note,
      totalAmount: rmReceiptsTable.totalAmount,
      createdAt: rmReceiptsTable.createdAt,
    })
    .from(rmReceiptsTable)
    .leftJoin(suppliersTable, eq(rmReceiptsTable.supplierId, suppliersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(rmReceiptsTable.date), desc(rmReceiptsTable.id));

  res.json(receipts);
});

// Get single receipt with items
router.get("/rm-receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);

  const [receipt] = await db
    .select({
      id: rmReceiptsTable.id,
      receiptNumber: rmReceiptsTable.receiptNumber,
      date: rmReceiptsTable.date,
      supplierId: rmReceiptsTable.supplierId,
      supplierName: suppliersTable.name,
      note: rmReceiptsTable.note,
      totalAmount: rmReceiptsTable.totalAmount,
      createdAt: rmReceiptsTable.createdAt,
    })
    .from(rmReceiptsTable)
    .leftJoin(suppliersTable, eq(rmReceiptsTable.supplierId, suppliersTable.id))
    .where(eq(rmReceiptsTable.id, id));

  if (!receipt) { res.status(404).json({ error: "Topilmadi" }); return; }

  const items = await db
    .select({
      id: rmReceiptItemsTable.id,
      rawMaterialId: rmReceiptItemsTable.rawMaterialId,
      rawMaterialName: rawMaterialsTable.name,
      rawMaterialCode: rawMaterialsTable.code,
      unitName: unitsTable.name,
      unitShort: unitsTable.shortName,
      quantity: rmReceiptItemsTable.quantity,
      unitPrice: rmReceiptItemsTable.unitPrice,
      totalPrice: rmReceiptItemsTable.totalPrice,
    })
    .from(rmReceiptItemsTable)
    .leftJoin(rawMaterialsTable, eq(rmReceiptItemsTable.rawMaterialId, rawMaterialsTable.id))
    .leftJoin(unitsTable, eq(rawMaterialsTable.unitId, unitsTable.id))
    .where(eq(rmReceiptItemsTable.receiptId, id));

  res.json({ ...receipt, items });
});

// Create receipt with items
router.post("/rm-receipts", requireAuth, async (req, res): Promise<void> => {
  const { date, supplierId, note, items } = req.body;
  const user = (req as any).user;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }

  // Generate receipt number
  const count = await db.select({ c: sql<number>`count(*)` }).from(rmReceiptsTable);
  const num = (Number(count[0].c) + 1).toString().padStart(5, "0");
  const receiptNumber = `KRM-${num}`;

  const totalAmount = items.reduce((s: number, it: any) =>
    s + parseFloat(it.quantity) * parseFloat(it.unitPrice), 0);

  const [receipt] = await db.insert(rmReceiptsTable).values({
    receiptNumber,
    date,
    supplierId: supplierId || null,
    note: note || null,
    totalAmount: totalAmount.toFixed(2),
    createdBy: user.userId,
  }).returning();

  const itemRows = items.map((it: any) => ({
    receiptId: receipt.id,
    rawMaterialId: it.rawMaterialId,
    quantity: parseFloat(it.quantity).toFixed(3),
    unitPrice: parseFloat(it.unitPrice).toFixed(2),
    totalPrice: (parseFloat(it.quantity) * parseFloat(it.unitPrice)).toFixed(2),
  }));

  await db.insert(rmReceiptItemsTable).values(itemRows);

  res.status(201).json({ ...receipt, items: itemRows });
});

// Update receipt with items (edit a completed operation)
router.put("/rm-receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { date, supplierId, note, items } = req.body;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }

  const [existing] = await db.select().from(rmReceiptsTable).where(eq(rmReceiptsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Topilmadi" }); return; }

  const totalAmount = items.reduce((s: number, it: any) =>
    s + parseFloat(it.quantity) * parseFloat(it.unitPrice), 0);

  const [receipt] = await db.update(rmReceiptsTable).set({
    date,
    supplierId: supplierId || null,
    note: note || null,
    totalAmount: totalAmount.toFixed(2),
  }).where(eq(rmReceiptsTable.id, id)).returning();

  await db.delete(rmReceiptItemsTable).where(eq(rmReceiptItemsTable.receiptId, id));

  const itemRows = items.map((it: any) => ({
    receiptId: id,
    rawMaterialId: it.rawMaterialId,
    quantity: parseFloat(it.quantity).toFixed(3),
    unitPrice: parseFloat(it.unitPrice).toFixed(2),
    totalPrice: (parseFloat(it.quantity) * parseFloat(it.unitPrice)).toFixed(2),
  }));

  await db.insert(rmReceiptItemsTable).values(itemRows);

  res.json({ ...receipt, items: itemRows });
});

// Delete receipt
router.delete("/rm-receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await db.delete(rmReceiptsTable).where(eq(rmReceiptsTable.id, id));
  res.json({ ok: true });
});

export default router;
