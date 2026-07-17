import { pgTable, serial, numeric, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { rawMaterialsTable } from "./raw_materials";

// Har bir mahsulot uchun 1 birlik ishlab chiqarishda kerak bo'ladigan xom ashyolar
export const productRecipesTable = pgTable("product_recipes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  rawMaterialId: integer("raw_material_id").notNull().references(() => rawMaterialsTable.id),
  // 1 birlik mahsulot uchun kerakli xom ashyo miqdori
  quantityPerUnit: numeric("quantity_per_unit", { precision: 14, scale: 4 }).notNull(),
}, (t) => [
  unique("product_recipes_unique").on(t.productId, t.rawMaterialId),
]);

export const insertProductRecipeSchema = createInsertSchema(productRecipesTable).omit({ id: true });
export type InsertProductRecipe = z.infer<typeof insertProductRecipeSchema>;
export type ProductRecipe = typeof productRecipesTable.$inferSelect;
