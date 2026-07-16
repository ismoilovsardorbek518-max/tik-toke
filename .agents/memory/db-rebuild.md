---
name: DB rebuild required after schema changes
description: lib/db must be rebuilt (tsc -b) before api-server tsc, or it reports columns as missing
---

## The problem
`lib/db` is a TypeScript project reference. After adding columns to schema files, `api-server/tsc --noEmit` reports "Property 'newColumn' does not exist" because it reads the compiled `.d.ts` from `lib/db/dist/`, not the source.

## Fix
Always run in this order after schema changes:
1. `pnpm --filter @workspace/db exec tsc -b --force` — rebuilds lib/db types
2. `echo "y" | pnpm --filter @workspace/db exec drizzle-kit push` — pushes schema to DB
3. `pnpm --filter @workspace/api-server exec tsc --noEmit -p .` — now sees new columns

**Why:** TypeScript project references use pre-built declaration files. `--force` ensures stale cache is busted.
