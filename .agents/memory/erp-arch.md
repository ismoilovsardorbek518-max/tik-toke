---
name: ERP architecture key decisions
description: Tik Toke ERP — frontend/backend patterns, stock formula, important conventions
---

## Frontend data fetching
- Uses a custom `apiFetch` helper in `artifacts/tiktoke-erp/src/lib/api.ts`, NOT a generated OpenAPI client
- Auth token stored in localStorage as `tiktoke_token`
- All routes protected via `ProtectedRoute` wrapper in App.tsx

## Stock formula (as of current implementation)
- **Products**: stock = SUM(production_outputs.quantity) − SUM(delivery_items.quantity) + SUM(stock_adjustments.quantity WHERE type='product')
- **Raw materials**: stock = SUM(rm_receipt_items.quantity) − SUM(production_inputs.quantity) + SUM(stock_adjustments.quantity WHERE type='raw_material')
- Adjustments (korrektirovka) use positive qty = add, negative qty = subtract

## DB operations
- `drizzle-kit push` run with: `echo "y" | pnpm --filter @workspace/db exec drizzle-kit push`
- After schema changes, rebuild lib/db types first: `pnpm --filter @workspace/db exec tsc -b --force`
- Then typecheck api-server: `pnpm --filter @workspace/api-server exec tsc --noEmit -p .`

## req.params.id type issue
- Express 5 + @types/express@5.0.6 types req.params values as `string | string[]`
- Fix: cast as string: `parseInt(req.params.id as string)`
- Apply this to all route files using params.id

## Admin user
- Default admin login: username=`admin`, password=`admin123`
- Inserted via bcryptjs hash + executeSql INTO users table
