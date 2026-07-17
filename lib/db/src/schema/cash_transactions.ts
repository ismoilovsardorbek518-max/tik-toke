import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Kassa: mijozlar va yetkazib beruvchilar bilan pul operatsiyalari
export const cashTransactionsTable = pgTable("cash_transactions", {
  id: serial("id").primaryKey(),
  // 'customer' | 'supplier'
  partyType: text("party_type").notNull(),
  partyId: integer("party_id").notNull(),
  // 'in' = kassaga keldi (mijozdan to'lov, yetkazuvchiga qaytarish)
  // 'out' = kassadan chiqdi (mijozga qaytarish, yetkazuvchiga to'lov)
  direction: text("direction").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  // 'cash' | 'card' | 'transfer' | 'credit'
  paymentMethod: text("payment_method").notNull().default("cash"),
  note: text("note"),
  date: text("date").notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCashTransactionSchema = createInsertSchema(cashTransactionsTable).omit({ id: true, createdAt: true });
export type InsertCashTransaction = z.infer<typeof insertCashTransactionSchema>;
export type CashTransaction = typeof cashTransactionsTable.$inferSelect;
