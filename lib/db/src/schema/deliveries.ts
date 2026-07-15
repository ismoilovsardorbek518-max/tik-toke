import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  deliveryNumber: text("delivery_number").notNull().unique(),
  date: text("date").notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  paymentMethod: text("payment_method").default("cash"), // cash | card | transfer | credit
  note: text("note"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).default("0"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deliveryItemsTable = pgTable("delivery_items", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").notNull().references(() => deliveriesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
});

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({ id: true, createdAt: true });
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveriesTable.$inferSelect;

export const insertDeliveryItemSchema = createInsertSchema(deliveryItemsTable).omit({ id: true });
export type InsertDeliveryItem = z.infer<typeof insertDeliveryItemSchema>;
export type DeliveryItem = typeof deliveryItemsTable.$inferSelect;
