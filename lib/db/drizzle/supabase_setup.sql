-- ============================================================
-- TikToke ERP — Supabase SQL Setup
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. Enum type
CREATE TYPE "public"."user_role" AS ENUM(
  'admin', 'warehouse_manager', 'production_manager', 'cashier', 'director'
);

-- 2. Tables
CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "full_name" text NOT NULL,
  "email" text,
  "role" "user_role" DEFAULT 'cashier' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE "units" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "short_name" text NOT NULL
);

CREATE TABLE "suppliers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "address" text,
  "balance" numeric(15, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "customers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "address" text,
  "balance" numeric(15, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "raw_materials" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "unit_id" integer,
  "description" text,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE "rm_receipts" (
  "id" serial PRIMARY KEY NOT NULL,
  "receipt_number" text NOT NULL,
  "date" text NOT NULL,
  "supplier_id" integer,
  "note" text,
  "total_amount" numeric(14, 2) DEFAULT '0',
  "created_by" integer,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "rm_receipts_receipt_number_unique" UNIQUE("receipt_number")
);

CREATE TABLE "rm_receipt_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "receipt_id" integer NOT NULL,
  "raw_material_id" integer NOT NULL,
  "quantity" numeric(14, 3) NOT NULL,
  "unit_price" numeric(14, 2) NOT NULL,
  "total_price" numeric(14, 2) NOT NULL
);

CREATE TABLE "products" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "unit_id" integer,
  "selling_price" numeric(14, 2) DEFAULT '0',
  "weight" numeric(14, 3),
  "description" text,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE "product_recipes" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "raw_material_id" integer NOT NULL,
  "quantity_per_unit" numeric(14, 4) NOT NULL,
  CONSTRAINT "product_recipes_unique" UNIQUE("product_id","raw_material_id")
);

CREATE TABLE "productions" (
  "id" serial PRIMARY KEY NOT NULL,
  "production_number" text NOT NULL,
  "date" text NOT NULL,
  "note" text,
  "created_by" integer,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "productions_production_number_unique" UNIQUE("production_number")
);

CREATE TABLE "production_inputs" (
  "id" serial PRIMARY KEY NOT NULL,
  "production_id" integer NOT NULL,
  "raw_material_id" integer NOT NULL,
  "quantity" numeric(14, 3) NOT NULL
);

CREATE TABLE "production_outputs" (
  "id" serial PRIMARY KEY NOT NULL,
  "production_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "quantity" numeric(14, 3) NOT NULL,
  "unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
  "total_cost" numeric(14, 2) DEFAULT '0' NOT NULL
);

CREATE TABLE "deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "delivery_number" text NOT NULL,
  "date" text NOT NULL,
  "customer_id" integer,
  "payment_method" text DEFAULT 'cash',
  "note" text,
  "total_amount" numeric(14, 2) DEFAULT '0',
  "created_by" integer,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "deliveries_delivery_number_unique" UNIQUE("delivery_number")
);

CREATE TABLE "delivery_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "delivery_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "quantity" numeric(14, 3) NOT NULL,
  "unit_price" numeric(14, 2) NOT NULL,
  "discount_percent" numeric(5, 2) DEFAULT '0',
  "total_price" numeric(14, 2) NOT NULL
);

CREATE TABLE "stock_adjustments" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "item_id" integer NOT NULL,
  "quantity" numeric(14, 3) NOT NULL,
  "reason" text,
  "date" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE "weekly_plan" (
  "id" serial PRIMARY KEY NOT NULL,
  "week_start" text NOT NULL,
  "product_id" integer NOT NULL,
  "planned_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
  "note" text,
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE "cash_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "party_type" text NOT NULL,
  "party_id" integer NOT NULL,
  "direction" text NOT NULL,
  "amount" numeric(15, 2) NOT NULL,
  "payment_method" text DEFAULT 'cash' NOT NULL,
  "note" text,
  "date" text NOT NULL,
  "created_by" integer,
  "created_at" timestamp DEFAULT now()
);

-- 3. Foreign keys
ALTER TABLE "raw_materials"
  ADD CONSTRAINT "raw_materials_unit_id_units_id_fk"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id");

ALTER TABLE "rm_receipts"
  ADD CONSTRAINT "rm_receipts_supplier_id_suppliers_id_fk"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");

ALTER TABLE "rm_receipts"
  ADD CONSTRAINT "rm_receipts_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id");

ALTER TABLE "rm_receipt_items"
  ADD CONSTRAINT "rm_receipt_items_receipt_id_rm_receipts_id_fk"
  FOREIGN KEY ("receipt_id") REFERENCES "rm_receipts"("id") ON DELETE CASCADE;

ALTER TABLE "rm_receipt_items"
  ADD CONSTRAINT "rm_receipt_items_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_unit_id_units_id_fk"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id");

ALTER TABLE "product_recipes"
  ADD CONSTRAINT "product_recipes_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;

ALTER TABLE "product_recipes"
  ADD CONSTRAINT "product_recipes_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");

ALTER TABLE "productions"
  ADD CONSTRAINT "productions_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id");

ALTER TABLE "production_inputs"
  ADD CONSTRAINT "production_inputs_production_id_productions_id_fk"
  FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE;

ALTER TABLE "production_inputs"
  ADD CONSTRAINT "production_inputs_raw_material_id_raw_materials_id_fk"
  FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id");

ALTER TABLE "production_outputs"
  ADD CONSTRAINT "production_outputs_production_id_productions_id_fk"
  FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE;

ALTER TABLE "production_outputs"
  ADD CONSTRAINT "production_outputs_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id");

ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id");

ALTER TABLE "delivery_items"
  ADD CONSTRAINT "delivery_items_delivery_id_deliveries_id_fk"
  FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE;

ALTER TABLE "delivery_items"
  ADD CONSTRAINT "delivery_items_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "weekly_plan"
  ADD CONSTRAINT "weekly_plan_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id");

ALTER TABLE "cash_transactions"
  ADD CONSTRAINT "cash_transactions_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id");

-- 4. Admin user (login: admin / admin123)
INSERT INTO users (username, password_hash, full_name, role)
VALUES (
  'admin',
  '$2b$10$yxYmqhso0frhAgvjoSo22.kKkPeLAHINtv8Mh2/6fJ51UyAgeE2F.',
  'Administrator',
  'admin'
);
