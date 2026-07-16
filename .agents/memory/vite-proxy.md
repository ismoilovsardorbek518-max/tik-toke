---
name: Vite proxy for API
description: The Vite dev server must proxy /api to the Express API server, and the DB schema + seed must exist before first login.
---

# Vite proxy required for /api routes

## The rule
`artifacts/tiktoke-erp/vite.config.ts` must include a `server.proxy` entry forwarding `/api` to `http://localhost:8080`. Without it, browser fetch calls to `/api/*` hit the Vite dev server and get no response.

## Why
The generated Orval hooks call `/api/auth/login` as a relative URL. In the Replit path-based routing setup, the Vite dev server handles `/` and the Express API handles `/api`. Without an explicit proxy in Vite, the Vite server doesn't forward those requests.

## How to apply
In `vite.config.ts` → `server` block:
```ts
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  },
},
```

## First-run setup also required
- Run `pnpm --filter @workspace/db run push` to apply Drizzle schema
- Seed at least one admin user (username: `admin`, password: `admin123`, role: `admin`) via `executeSql` using bcryptjs hash
- DATABASE_URL is runtime-managed by Replit — do not set manually
