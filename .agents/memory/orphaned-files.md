---
name: Orphaned files from abandoned feature branches
description: Pattern for dead code files that exist in routes/pages/schema dirs but are NOT wired into the app
---

## What happened
This project had abandoned feature branches that left files in:
- `artifacts/api-server/src/routes/` — employees.ts, finance.ts, inventory.ts, production.ts (singular), purchases.ts, recipes.ts, sales.ts, categories.ts, seed.ts
- `lib/db/src/schema/` — same names, plus activities.ts
- `artifacts/tiktoke-erp/src/pages/` — same feature pages

These files were NOT imported in routes/index.ts, schema/index.ts, or App.tsx, so they had no runtime effect but caused tsc errors.

## Rule
**Always check the barrel/index file before trusting a copied file is live.**
- Backend routes: `artifacts/api-server/src/routes/index.ts`
- DB schema: `lib/db/src/schema/index.ts`  
- Frontend pages: `artifacts/tiktoke-erp/src/App.tsx`

**Why:** Files can exist in dirs without being wired in, creating a false impression they're active.

**How to apply:** When debugging "route not found" or "table not found" errors, verify the file is actually imported in the relevant barrel. When deleting dead code, check all three barrels.
