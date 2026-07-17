import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { unitsTable } from "./units";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  code: text("code"),
  name: text("name").notNull(),
  unitId: integer("unit_id").references(() => unitsTable.id),
  sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).default("0"),
  weight: numeric("weight", { precision: 14, scale: 3 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
