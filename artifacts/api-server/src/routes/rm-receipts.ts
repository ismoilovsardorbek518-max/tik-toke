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
  if (startDate)  conditions.push(gte(rmReceiptsTable.date, startDate));
  if (endDate)    conditions.push(lte(rmReceiptsTable.date, endDate));
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

// Create receipt — atomik transaksiya
router.post("/rm-receipts", requireAuth, async (req, res): Promise<void> => {
  const { date, supplierId, note, items } = req.body;
  const user = (req as any).user;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }
  if (!supplierId) {
    res.status(400).json({ error: "Yetkazib beruvchi tanlanishi shart" }); return;
  }

  const totalAmount = items.reduce((s: number, it: any) =>
    s + parseFloat(it.quantity) * parseFloat(it.unitPrice), 0);

  const result = await db.transaction(async (trx) => {
    const count = await trx.select({ c: sql<number>`count(*)` }).from(rmReceiptsTable);
    const receiptNumber = `KRM-${(Number(count[0].c) + 1).toString().padStart(5, "0")}`;

    const [receipt] = await trx.insert(rmReceiptsTable).values({
      receiptNumber, date,
      supplierId: parseInt(supplierId),
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
    await trx.insert(rmReceiptItemsTable).values(itemRows);

    // Yetkazuvchi balansini oshir (biz qarzkor bo'ldik)
    await trx.update(suppliersTable)
      .set({ balance: sql`${suppliersTable.balance} + ${totalAmount.toFixed(2)}` })
      .where(eq(suppliersTable.id, parseInt(supplierId)));

    return { ...receipt, items: itemRows };
  });

  res.status(201).json(result);
});

// Update receipt — atomik transaksiya
router.put("/rm-receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { date, supplierId, note, items } = req.body;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }
  if (!supplierId) {
    res.status(400).json({ error: "Yetkazib beruvchi tanlanishi shart" }); return;
  }

  const [existing] = await db.select().from(rmReceiptsTable).where(eq(rmReceiptsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Topilmadi" }); return; }

  const newTotal = items.reduce((s: number, it: any) =>
    s + parseFloat(it.quantity) * parseFloat(it.unitPrice), 0);

  const result = await db.transaction(async (trx) => {
    // Eski balansni qaytarib ol
    if (existing.supplierId) {
      await trx.update(suppliersTable)
        .set({ balance: sql`${suppliersTable.balance} - ${parseFloat(existing.totalAmount).toFixed(2)}` })
        .where(eq(suppliersTable.id, existing.supplierId));
    }

    const [receipt] = await trx.update(rmReceiptsTable).set({
      date, supplierId: parseInt(supplierId),
      note: note || null,
      totalAmount: newTotal.toFixed(2),
    }).where(eq(rmReceiptsTable.id, id)).returning();

    await trx.delete(rmReceiptItemsTable).where(eq(rmReceiptItemsTable.receiptId, id));

    const itemRows = items.map((it: any) => ({
      receiptId: id,
      rawMaterialId: it.rawMaterialId,
      quantity: parseFloat(it.quantity).toFixed(3),
      unitPrice: parseFloat(it.unitPrice).toFixed(2),
      totalPrice: (parseFloat(it.quantity) * parseFloat(it.unitPrice)).toFixed(2),
    }));
    await trx.insert(rmReceiptItemsTable).values(itemRows);

    // Yangi balansni qo'sh
    await trx.update(suppliersTable)
      .set({ balance: sql`${suppliersTable.balance} + ${newTotal.toFixed(2)}` })
      .where(eq(suppliersTable.id, parseInt(supplierId)));

    return { ...receipt, items: itemRows };
  });

  res.json(result);
});

// Delete receipt — atomik transaksiya
router.delete("/rm-receipts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(rmReceiptsTable).where(eq(rmReceiptsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Topilmadi" }); return; }

  await db.transaction(async (trx) => {
    if (existing.supplierId) {
      await trx.update(suppliersTable)
        .set({ balance: sql`${suppliersTable.balance} - ${parseFloat(existing.totalAmount).toFixed(2)}` })
        .where(eq(suppliersTable.id, existing.supplierId));
    }
    await trx.delete(rmReceiptItemsTable).where(eq(rmReceiptItemsTable.receiptId, id));
    await trx.delete(rmReceiptsTable).where(eq(rmReceiptsTable.id, id));
  });

  res.json({ ok: true });
});

export default router;
