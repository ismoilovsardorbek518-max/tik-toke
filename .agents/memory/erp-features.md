---
name: ERP features added
description: New tables, routes, and pages added to Tiktoke ERP in July 2026
---

## New DB tables (schema pushed)
- `products.weight` — numeric(14,3), og'irligi kg da
- `product_recipes` — (product_id, raw_material_id, quantity_per_unit) — 1 birlik uchun xom ashyo
- `weekly_plan` — (week_start, product_id, planned_quantity, note) — haftalik reja
- `cash_transactions` — (party_type, party_id, direction, amount, payment_method, note, date) — kassa

## Auto-code generation
- Products: `PRD-XXXXX` (count+1 padded)
- Raw materials: `RM-XXXXX`
- Both: if code field is blank on create, auto-generated; user can override by typing

## New API routes
- `GET/PUT /products/:id/recipe` — formula CRUD
- `POST /productions/preview-inputs` — recipe-based inputs preview
- `GET /forecast` — prognoz (max producible units per product from RM stock)
- `GET/POST/DELETE /kassa` — cash transactions
- `GET /kassa/balances` — customer + supplier balances
- `GET /kassa/sverka/:type/:id` — akt sverka with running balance
- `GET/POST/DELETE /weekly-plan` — haftalik reja

## Auto raw material deduction on production
- When POST /productions is called without `inputs[]` OR with `autoFillInputs: true`,
  the server reads `product_recipes` and auto-calculates RM quantities (qty_per_unit × produced_qty)
- Multiple products in one production order are summed per RM

## New frontend pages
- `/forecast` — Forecast.tsx
- `/kassa` — Kassa.tsx (tabs: transactions / balances + sverka dialog)
- `/weekly-plan` — WeeklyPlan.tsx (week navigation, inline editing)
- Products.tsx updated: weight field + FlaskConical button → recipe sheet

## Workflow startup issue
- Workflows need `PORT=8080` / `PORT=25740` prefix in command
- If port in use: `fuser -k 8080/tcp 25740/tcp` before restart

**Why:** Port env vars are not injected automatically for manually-configured workflows (only for artifact-managed ones).
