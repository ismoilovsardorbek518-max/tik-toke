import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";

// Qoldiqlarni qo'lda tuzatish (korrektirovka)
export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'product' | 'raw_material'
  itemId: integer("item_id").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(), // musbat = kirim, manfiy = chiqim
  reason: text("reason"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
