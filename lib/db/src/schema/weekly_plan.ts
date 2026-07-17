import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

// Haftalik ishlab chiqarish rejasi
export const weeklyPlanTable = pgTable("weekly_plan", {
  id: serial("id").primaryKey(),
  weekStart: text("week_start").notNull(), // YYYY-MM-DD (dushanba)
  productId: integer("product_id").notNull().references(() => productsTable.id),
  plannedQuantity: numeric("planned_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  note: text("note"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlanTable).omit({ id: true, updatedAt: true });
export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type WeeklyPlan = typeof weeklyPlanTable.$inferSelect;
