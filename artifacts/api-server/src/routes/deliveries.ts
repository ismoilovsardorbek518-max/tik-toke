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

const router = Router();

// List deliveries with filters
router.get("/deliveries", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, customerId } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (startDate) conditions.push(gte(deliveriesTable.date, startDate));
  if (endDate)   conditions.push(lte(deliveriesTable.date, endDate));
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

// Create delivery — atomik transaksiya
router.post("/deliveries", requireAuth, async (req, res): Promise<void> => {
  const { date, customerId, paymentMethod, note, items } = req.body;
  const user = (req as any).user;

  if (!date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "date va items[] kerak" }); return;
  }
  if (!customerId) {
    res.status(400).json({ error: "Klient tanlanishi shart" }); return;
  }

  const totalAmount = items.reduce((s: number, it: any) => {
    const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
    return s + base - base * (parseFloat(it.discountPercent || "0") / 100);
  }, 0);

  const result = await db.transaction(async (trx) => {
    const count = await trx.select({ c: sql<number>`count(*)` }).from(deliveriesTable);
    const deliveryNumber = `YCH-${(Number(count[0].c) + 1).toString().padStart(5, "0")}`;

    const [delivery] = await trx.insert(deliveriesTable).values({
      deliveryNumber, date,
      customerId: parseInt(customerId),
      paymentMethod: paymentMethod || "cash",
      note: note || null,
      totalAmount: totalAmount.toFixed(2),
      createdBy: user.userId,
    }).returning();

    const itemRows = items.map((it: any) => {
      const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
      const disc = parseFloat(it.discountPercent || "0");
      return {
        deliveryId: delivery.id,
        productId: it.productId,
        quantity: parseFloat(it.quantity).toFixed(3),
        unitPrice: parseFloat(it.unitPrice).toFixed(2),
        discountPercent: disc.toFixed(2),
        totalPrice: (base - base * (disc / 100)).toFixed(2),
      };
    });
    await trx.insert(deliveryItemsTable).values(itemRows);

    // Mijoz balansini oshir (qarz ko'paydi)
    await trx.update(customersTable)
      .set({ balance: sql`${customersTable.balance} + ${totalAmount.toFixed(2)}` })
      .where(eq(customersTable.id, parseInt(customerId)));

    return { ...delivery, items: itemRows };
  });

  res.status(201).json(result);
});

// Update delivery — atomik transaksiya
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

  const newTotal = items.reduce((s: number, it: any) => {
    const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
    return s + base - base * (parseFloat(it.discountPercent || "0") / 100);
  }, 0);

  const result = await db.transaction(async (trx) => {
    // Eski balansni qaytarib ol
    if (existing.customerId) {
      await trx.update(customersTable)
        .set({ balance: sql`${customersTable.balance} - ${parseFloat(existing.totalAmount).toFixed(2)}` })
        .where(eq(customersTable.id, existing.customerId));
    }

    const [delivery] = await trx.update(deliveriesTable).set({
      date, customerId: parseInt(customerId),
      paymentMethod: paymentMethod || "cash",
      note: note || null,
      totalAmount: newTotal.toFixed(2),
    }).where(eq(deliveriesTable.id, id)).returning();

    await trx.delete(deliveryItemsTable).where(eq(deliveryItemsTable.deliveryId, id));

    const itemRows = items.map((it: any) => {
      const base = parseFloat(it.quantity) * parseFloat(it.unitPrice);
      const disc = parseFloat(it.discountPercent || "0");
      return {
        deliveryId: id,
        productId: it.productId,
        quantity: parseFloat(it.quantity).toFixed(3),
        unitPrice: parseFloat(it.unitPrice).toFixed(2),
        discountPercent: disc.toFixed(2),
        totalPrice: (base - base * (disc / 100)).toFixed(2),
      };
    });
    await trx.insert(deliveryItemsTable).values(itemRows);

    // Yangi balansni qo'sh
    await trx.update(customersTable)
      .set({ balance: sql`${customersTable.balance} + ${newTotal.toFixed(2)}` })
      .where(eq(customersTable.id, parseInt(customerId)));

    return { ...delivery, items: itemRows };
  });

  res.json(result);
});

// Delete delivery — atomik transaksiya
router.delete("/deliveries/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const [existing] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Topilmadi" }); return; }

  await db.transaction(async (trx) => {
    if (existing.customerId) {
      await trx.update(customersTable)
        .set({ balance: sql`${customersTable.balance} - ${parseFloat(existing.totalAmount).toFixed(2)}` })
        .where(eq(customersTable.id, existing.customerId));
    }
    await trx.delete(deliveriesTable).where(eq(deliveriesTable.id, id));
  });

  res.json({ ok: true });
});

export default router;
