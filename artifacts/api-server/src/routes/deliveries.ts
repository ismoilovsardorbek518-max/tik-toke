import { Router } from "express";
import { db } from "@workspace/db";
import {
  deliveriesTable,
  deliveryItemsTable,
  productsTable,
  customersTable,
  unitsTable,
} from "@workspace/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const addCustomerDebt = (customerId: number, amount: number) =>
  db.execute(sql`UPDATE customers SET balance = balance + ${amount} WHERE id = ${customerId}`);

const router = Router();

// List deliveries with filters
router.get("/deliveries", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, customerId } = req.query as Record<string, string>;

  const conditions: any[] = [];
  if (startDate) conditions.push(gte(deliveriesTable.date, startDate));
  if (endDate) conditions.push(lte(deliveriesTable.date, endDate));
  if (customerId) conditions.push(eq(deliveriesTable.customerId, parseInt(customerId)));

  const rows = await db
    .select({
      id: deliveriesTable.id,
      deliveryNumber: deliveriesTable.deliveryNumber,
      date: deliveriesTable.date,
      customerId: deliveriesTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      paymentMethod: deliveriesTable.paymentMethod,
      note: deliveriesTable.note,
      totalAmount: deliveriesTable.totalAmount,
      createdAt: deliveriesTable.createdAt,
    })
    .from(deliveriesTable)
    .leftJoin(customersTable, eq(deliveriesTable.customerId, customersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(deliveriesTable.date), desc(deliveriesTable.id));

  res.json(rows);
});

// Get single delivery with items
router.get("/deliveries/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);

  const [delivery] = await db
    .select({
      id: deliveriesTable.id,
      deliveryNumber: deliveriesTable.deliveryNumber,
      date: deliveriesTable.date,
      customerId: deliveriesTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      customerAddress: customersTable.address,
      paymentMethod: deliveriesTable.paymentMethod,
      note: deliveriesTable.note,
      totalAmount: deliveriesTable.totalAmount,
      createdAt: deliveriesTable.createdAt,
    })
    .from(deliveriesTable)
    .leftJoin(customersTable, eq(deliveriesTable.customerId, customersTable.id))
    .where(eq(deliveriesTable.id, id));

  if (!delivery) { res.status(404).json({ error: "Topilmadi" }); return; }

  const items = await db
    .select({
      id: deliveryItemsTable.id,
      productId: deliveryItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      unitName: unitsTable.name,
      unitShort: unitsTable.shortName,
      quantity: deliveryItemsTable.quantity,
      unitPrice: deliveryItemsTable.unitPrice,
      discountPercent: deliveryItemsTable.discountPercent,
      totalPrice: deliveryItemsTable.totalPrice,
    })
    .from(deliveryItemsTable)
    .leftJoin(productsTable, eq(deliveryItemsTable.productId, productsTable.id))
    .leftJoin(unitsTable, eq(productsTable.unitId, unitsTable.id))
    .where(eq(deliveryItemsTable.deliveryId, id));

  res.json({ ...delivery, items });
});

// Create delivery
router.post("/deliveries", requireAuth, async (req, res): Promise<void> => {
  const { date, customerId, paymentMethod, note, items } = req.body;
  const user = (req as any).user;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }
  if (!customerId) {
    res.status(400).json({ error: "Klient tanlanishi shart" }); return;
  }

  const count = await db.select({ c: sql<number>`count(*)` }).from(deliveriesTable);
  const num = (Number(count[0].c) + 1).toString().padStart(5, "0");
  const deliveryNumber = `YCH-${num}`;

  const totalAmount = items.reduce((s: number, it: any) => {
    const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
    const discount = base * (parseFloat(it.discountPercent || "0") / 100);
    return s + base - discount;
  }, 0);

  const [delivery] = await db.insert(deliveriesTable).values({
    deliveryNumber,
    date,
    customerId: customerId || null,
    paymentMethod: paymentMethod || "cash",
    note: note || null,
    totalAmount: totalAmount.toFixed(2),
    createdBy: user.userId,
  }).returning();

  const itemRows = items.map((it: any) => {
    const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
    const disc = parseFloat(it.discountPercent || "0");
    const total = base - base * (disc / 100);
    return {
      deliveryId: delivery.id,
      productId: it.productId,
      quantity: parseFloat(it.quantity).toFixed(3),
      unitPrice: parseFloat(it.unitPrice).toFixed(2),
      discountPercent: disc.toFixed(2),
      totalPrice: total.toFixed(2),
    };
  });

  await db.insert(deliveryItemsTable).values(itemRows);
  // Mijoz balansini oshir (qarz ko'paydi)
  await addCustomerDebt(parseInt(customerId), totalAmount);
  res.status(201).json({ ...delivery, items: itemRows });
});

// Update delivery with items (edit a completed operation)
router.put("/deliveries/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { date, customerId, paymentMethod, note, items } = req.body;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }
  if (!customerId) {
    res.status(400).json({ error: "Klient tanlanishi shart" }); return;
  }

  const [existing] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Topilmadi" }); return; }

  // Eski balansni qaytarib ol
  if (existing.customerId) {
    await addCustomerDebt(existing.customerId, -parseFloat(existing.totalAmount));
  }

  const totalAmount = items.reduce((s: number, it: any) => {
    const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
    const discount = base * (parseFloat(it.discountPercent || "0") / 100);
    return s + base - discount;
  }, 0);

  const [delivery] = await db.update(deliveriesTable).set({
    date,
    customerId: parseInt(customerId),
    paymentMethod: paymentMethod || "cash",
    note: note || null,
    totalAmount: totalAmount.toFixed(2),
  }).where(eq(deliveriesTable.id, id)).returning();

  await db.delete(deliveryItemsTable).where(eq(deliveryItemsTable.deliveryId, id));

  const itemRows = items.map((it: any) => {
    const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
    const disc = parseFloat(it.discountPercent || "0");
    const total = base - base * (disc / 100);
    return {
      deliveryId: id,
      productId: it.productId,
      quantity: parseFloat(it.quantity).toFixed(3),
      unitPrice: parseFloat(it.unitPrice).toFixed(2),
      discountPercent: disc.toFixed(2),
      totalPrice: total.toFixed(2),
    };
  });

  await db.insert(deliveryItemsTable).values(itemRows);
  // Yangi balansni qo'sh
  await addCustomerDebt(parseInt(customerId), totalAmount);
  res.json({ ...delivery, items: itemRows });
});

// Delete delivery
router.delete("/deliveries/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id));
  if (existing?.customerId) {
    await addCustomerDebt(existing.customerId, -parseFloat(existing.totalAmount));
  }
  await db.delete(deliveriesTable).where(eq(deliveriesTable.id, id));
  res.json({ ok: true });
});

export default router;
