import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productsTable } from "./products";
import { rawMaterialsTable } from "./raw_materials";

export const productionsTable = pgTable("productions", {
  id: serial("id").primaryKey(),
  productionNumber: text("production_number").notNull().unique(),
  date: text("date").notNull(),
  note: text("note"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// What was produced
export const productionOutputsTable = pgTable("production_outputs", {
  id: serial("id").primaryKey(),
  productionId: integer("production_id").notNull().references(() => productionsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  // Kirim (tannarx) narxi — cost price per unit at the time this batch was produced
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull().default("0"),
});

// What raw materials were consumed
export const productionInputsTable = pgTable("production_inputs", {
  id: serial("id").primaryKey(),
  productionId: integer("production_id").notNull().references(() => productionsTable.id, { onDelete: "cascade" }),
  rawMaterialId: integer("raw_material_id").notNull().references(() => rawMaterialsTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
});

export const insertProductionSchema = createInsertSchema(productionsTable).omit({ id: true, createdAt: true });
export type InsertProduction = z.infer<typeof insertProductionSchema>;
export type Production = typeof productionsTable.$inferSelect;
