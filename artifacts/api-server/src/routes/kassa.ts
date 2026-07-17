import { Router } from "express";
import { db } from "@workspace/db";
import {
  cashTransactionsTable,
  customersTable,
  suppliersTable,
  deliveriesTable,
  rmReceiptsTable,
} from "@workspace/db/schema";
import { eq, desc, asc, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// List transactions
router.get("/kassa", requireAuth, async (req, res): Promise<void> => {
  const { partyType, partyId, startDate, endDate } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (partyType) conditions.push(eq(cashTransactionsTable.partyType, partyType));
  if (partyId)   conditions.push(eq(cashTransactionsTable.partyId, parseInt(partyId)));
  if (startDate) conditions.push(gte(cashTransactionsTable.date, startDate));
  if (endDate)   conditions.push(lte(cashTransactionsTable.date, endDate));

  const rows = await db
    .select()
    .from(cashTransactionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(cashTransactionsTable.date), desc(cashTransactionsTable.id));

  // Enrich party names
  const enriched = await Promise.all(rows.map(async (t) => {
    let partyName = "";
    if (t.partyType === "customer") {
      const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, t.partyId));
      partyName = c?.name ?? "";
    } else {
      const [s] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, t.partyId));
      partyName = s?.name ?? "";
    }
    return { ...t, partyName };
  }));

  res.json(enriched);
});

// Create transaction + update party balance
router.post("/kassa", requireAuth, async (req, res): Promise<void> => {
  const { partyType, partyId, direction, amount, paymentMethod, note, date } = req.body;
  const user = (req as any).user;
  if (!partyType || !partyId || !direction || !amount || !date) {
    res.status(400).json({ error: "partyType, partyId, direction, amount, date kerak" }); return;
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) { res.status(400).json({ error: "amount musbat bo'lishi kerak" }); return; }

  const [tx] = await db.insert(cashTransactionsTable).values({
    partyType, partyId: parseInt(partyId), direction, amount: amt.toFixed(2),
    paymentMethod: paymentMethod || "cash", note: note || null, date,
    createdBy: user.userId,
  }).returning();

  // Balansni yangilash:
  // Customer: 'in' (to'lov keldi) => balance kamayadi (qarz kamayadi)
  //           'out' (qaytarish)  => balance ko'payadi
  // Supplier: 'out' (to'lov qildik) => balance kamayadi
  //           'in' (qaytarish)   => balance ko'payadi
  if (partyType === "customer") {
    const delta = direction === "in" ? -amt : amt;
    await db.execute(
      sql`UPDATE customers SET balance = balance + ${delta} WHERE id = ${parseInt(partyId)}`
    );
  } else if (partyType === "supplier") {
    const delta = direction === "out" ? -amt : amt;
    await db.execute(
      sql`UPDATE suppliers SET balance = balance + ${delta} WHERE id = ${parseInt(partyId)}`
    );
  }

  res.status(201).json(tx);
});

// Delete transaction (va balansni qaytarish)
router.delete("/kassa/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const [tx] = await db.select().from(cashTransactionsTable).where(eq(cashTransactionsTable.id, id));
  if (!tx) { res.status(404).json({ error: "Topilmadi" }); return; }

  const amt = parseFloat(tx.amount);
  if (tx.partyType === "customer") {
    const delta = tx.direction === "in" ? amt : -amt;
    await db.execute(sql`UPDATE customers SET balance = balance + ${delta} WHERE id = ${tx.partyId}`);
  } else if (tx.partyType === "supplier") {
    const delta = tx.direction === "out" ? amt : -amt;
    await db.execute(sql`UPDATE suppliers SET balance = balance + ${delta} WHERE id = ${tx.partyId}`);
  }

  await db.delete(cashTransactionsTable).where(eq(cashTransactionsTable.id, id));
  res.json({ ok: true });
});

// Balanslar xulasasi (akt sverka uchun)
router.get("/kassa/balances", requireAuth, async (req, res): Promise<void> => {
  const customers = await db
    .select({ id: customersTable.id, name: customersTable.name, balance: customersTable.balance, phone: customersTable.phone })
    .from(customersTable)
    .orderBy(customersTable.name);

  const suppliers = await db
    .select({ id: suppliersTable.id, name: suppliersTable.name, balance: suppliersTable.balance, phone: suppliersTable.phone })
    .from(suppliersTable)
    .orderBy(suppliersTable.name);

  res.json({
    customers: customers.map((c) => ({ ...c, balance: Number(c.balance) })),
    suppliers: suppliers.map((s) => ({ ...s, balance: Number(s.balance) })),
  });
});

// Akt sverka: bitta mijoz/yetkazuvchi bo'yicha yuk chiqarish + to'lovlar
router.get("/kassa/sverka/:partyType/:partyId", requireAuth, async (req, res): Promise<void> => {
  const { partyType, partyId } = req.params as Record<string, string>;
  const pid = parseInt(partyId);

  // Kassa tranzaksiyalari
  const txs = await db
    .select()
    .from(cashTransactionsTable)
    .where(and(
      eq(cashTransactionsTable.partyType, partyType),
      eq(cashTransactionsTable.partyId, pid)
    ));

  // Yuk chiqarish yoki xom ashyo kirim yozuvlari
  type SverkaRow = {
    id: number; date: string; kind: "delivery" | "receipt" | "payment";
    description: string; debit: number; credit: number;
  };

  const rows: SverkaRow[] = [];

  if (partyType === "customer") {
    // Yuk chiqarish — qarz (debit)
    const deliveries = await db
      .select({ id: deliveriesTable.id, date: deliveriesTable.date, deliveryNumber: deliveriesTable.deliveryNumber, totalAmount: deliveriesTable.totalAmount })
      .from(deliveriesTable)
      .where(eq(deliveriesTable.customerId, pid));

    for (const d of deliveries) {
      rows.push({ id: d.id, date: d.date, kind: "delivery", description: `Yuk chiqarish ${d.deliveryNumber}`, debit: parseFloat(d.totalAmount), credit: 0 });
    }

    // Kassa to'lovlari
    for (const t of txs) {
      const amt = parseFloat(t.amount);
      // "in" = mijoz to'lov qildi (kredit — qarzni kamaytiradi)
      // "out" = qaytarish (debit — qarzni oshiradi)
      rows.push({ id: t.id + 100000, date: t.date, kind: "payment", description: `To'lov (${t.paymentMethod ?? "naqd"})${t.note ? ": " + t.note : ""}`, debit: t.direction === "out" ? amt : 0, credit: t.direction === "in" ? amt : 0 });
    }
  } else {
    // Xom ashyo kirim — biz qarzkor (debit)
    const receipts = await db
      .select({ id: rmReceiptsTable.id, date: rmReceiptsTable.date, receiptNumber: rmReceiptsTable.receiptNumber, totalAmount: rmReceiptsTable.totalAmount })
      .from(rmReceiptsTable)
      .where(eq(rmReceiptsTable.supplierId, pid));

    for (const r of receipts) {
      rows.push({ id: r.id, date: r.date, kind: "receipt", description: `Hom ashyo kirim ${r.receiptNumber}`, debit: parseFloat(r.totalAmount), credit: 0 });
    }

    // Kassa to'lovlari
    for (const t of txs) {
      const amt = parseFloat(t.amount);
      // "out" = biz to'ladik (kredit — qarzni kamaytiradi)
      // "in" = qaytarish (debit)
      rows.push({ id: t.id + 100000, date: t.date, kind: "payment", description: `To'lov (${t.paymentMethod ?? "naqd"})${t.note ? ": " + t.note : ""}`, debit: t.direction === "in" ? amt : 0, credit: t.direction === "out" ? amt : 0 });
    }
  }

  // Sana bo'yicha tartiblash
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

  // Running balance: debit = qarz oshadi, credit = qarz kamayadi
  let running = 0;
  const withRunning = rows.map((r) => {
    running += r.debit - r.credit;
    return { ...r, runningBalance: running.toFixed(2) };
  });

  let partyName = "";
  let currentBalance = 0;
  if (partyType === "customer") {
    const [c] = await db.select().from(customersTable).where(eq(customersTable.id, pid));
    partyName = c?.name ?? ""; currentBalance = Number(c?.balance ?? 0);
  } else {
    const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, pid));
    partyName = s?.name ?? ""; currentBalance = Number(s?.balance ?? 0);
  }

  res.json({ partyName, partyType, currentBalance, transactions: withRunning });
});

export default router;
