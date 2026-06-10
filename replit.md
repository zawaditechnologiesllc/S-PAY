# S-PAY

S-PAY is a digital wallet super app for remote workers — earn globally in USDC on Celo, manage virtual USD/EUR bank accounts (via Noah API), withdraw to local currency (M-Pesa, SEPA, PIX), use a virtual card (Stripe Issuing, coming soon), and discover remote jobs — all in one place.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, requires DATABASE_URL)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + JWT auth (`jsonwebtoken`, `bcryptjs`)
- DB: PostgreSQL + Drizzle ORM (Render Postgres in production, auto-migrated on boot)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)
- Web: React + Vite (`artifacts/web`)
- Mobile: Expo + Expo Router (`artifacts/mobile`)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (server-side validation)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (frontend)
- `lib/db/src/schema/` — Drizzle DB schema (users, transactions, card-waitlist, jobs-cache)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, wallet, banking, card, jobs, webhooks)
- `artifacts/api-server/src/lib/` — auth JWT utils, mock data, jobs aggregation
- `artifacts/web/src/pages/` — React web pages (dashboard, wallet, banking, card, jobs, auth)
- `artifacts/mobile/app/` — Expo screens (tabs: wallet, banking, card, jobs; login, register, withdraw, profile, job detail)
- `artifacts/mobile/context/AuthContext.tsx` — JWT token state via AsyncStorage

## Architecture decisions

- **Auth + admin are DB-backed**: registration/login/Google OAuth write to Postgres. Wallet/banking/card routes still serve demo mock data until Noah/Stripe are configured.
- **JWT auth**: Token stored in localStorage (web) and AsyncStorage (mobile). Custom fetch in `lib/api-client-react/src/custom-fetch.ts` injects Bearer token automatically.
- **Jobs aggregation**: 60+ free sources (Remotive full feed, RemoteOK, Himalayas paginated, Arbeitnow, TheMuse, WWR category feeds, Jobicy, WorkingNomads + ~50 RSS boards) — 3,000–5,000 deduplicated jobs daily. No API keys needed. Stale-while-revalidate in-memory cache (1h TTL, hourly refresh loop) + the default feed is snapshotted to the `jobs_cache` Postgres table so cold starts serve jobs instantly.
- **OpenAPI contract-first**: All API changes start in `lib/api-spec/openapi.yaml`, then run codegen before writing frontend code.
- **DATABASE_URL is required**: the server fails fast without it. Schema migrations in `lib/db/migrations/` are applied automatically on boot (`src/lib/migrate.ts`) — no terminal needed.

## Product

- **Wallet**: USDC balance on Celo, send/receive money, add funds, view transactions
- **Banking**: Virtual USD (ACH) and EUR (IBAN/SEPA) accounts via Noah API, incoming payment tracking, withdraw to local currency (M-Pesa, SEPA, PIX, bank wire) with live FX rates
- **Card**: Stripe Issuing virtual cards (coming soon), waitlist signup, spending summary by category, card transaction history
- **Jobs**: 3,000–5,000 remote job listings daily from 60+ sources with search, category filtering, load-more pagination, affiliate CTAs, and job detail view

## External Services (configure in production)

| Service | Purpose | Env Var |
|---------|---------|---------|
| Render Postgres | PostgreSQL database | `DATABASE_URL` (auto-wired by render.yaml Blueprint) |
| Noah API | Virtual banking, FX payouts | `NOAH_API_KEY`, `NOAH_WEBHOOK_SECRET` |
| Stripe Issuing | Virtual card issuing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Privy | Celo embedded wallets | `PRIVY_APP_ID`, `PRIVY_APP_SECRET` |
| Firebase | Push notifications | `FIREBASE_PROJECT_ID` |

## User preferences

- Brand colors: Primary #4DC9EE (sky blue), Accent #A8DEFF (light blue), Dark navy #1A2B4A
- Target users: Remote workers in Africa, Southeast Asia, Latin America
- Domain: spayewallet.com

## Gotchas

- `lib/api-zod/src/index.ts` must stay as `export * from "./generated/api"` only — orval mode `"single"` prevents TS2308 collision.
- Do NOT inline webhook bodies in OpenAPI spec — use `type: object` refs or entity-named schemas.
- Expo: do NOT create `app.config.ts/js` — use `app.json` only (required for Expo Launch).
- Jobs API: 60+ upstream sources with 8–20s timeouts each, fetched in parallel; a full refresh takes ~20s. Users never wait: stale data is served while a background refresh runs, and the warm-up + hourly loop in `src/index.ts` keeps the feed hot.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Admin access: register an account, then add the email to `ADMIN_EMAILS` on Render and visit `/admin`
