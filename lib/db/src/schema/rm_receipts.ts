import { pgTable, serial, text, numeric, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { usersTable } from "./users";
import { rawMaterialsTable } from "./raw_materials";

export const rmReceiptsTable = pgTable("rm_receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  date: text("date").notNull(), // ISO date string
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  note: text("note"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).default("0"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rmReceiptItemsTable = pgTable("rm_receipt_items", {
  id: serial("id").primaryKey(),
  receiptId: integer("receipt_id").notNull().references(() => rmReceiptsTable.id, { onDelete: "cascade" }),
  rawMaterialId: integer("raw_material_id").notNull().references(() => rawMaterialsTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
});

export const insertRmReceiptSchema = createInsertSchema(rmReceiptsTable).omit({ id: true, createdAt: true });
export type InsertRmReceipt = z.infer<typeof insertRmReceiptSchema>;
export type RmReceipt = typeof rmReceiptsTable.$inferSelect;

export const insertRmReceiptItemSchema = createInsertSchema(rmReceiptItemsTable).omit({ id: true });
export type InsertRmReceiptItem = z.infer<typeof insertRmReceiptItemSchema>;
export type RmReceiptItem = typeof rmReceiptItemsTable.$inferSelect;
