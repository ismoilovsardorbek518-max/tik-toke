import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { unitsTable } from "./units";

export const rawMaterialsTable = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  code: text("code"),
  name: text("name").notNull(),
  unitId: integer("unit_id").references(() => unitsTable.id),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRawMaterialSchema = createInsertSchema(rawMaterialsTable).omit({ id: true, createdAt: true });
export type InsertRawMaterial = z.infer<typeof insertRawMaterialSchema>;
export type RawMaterial = typeof rawMaterialsTable.$inferSelect;
