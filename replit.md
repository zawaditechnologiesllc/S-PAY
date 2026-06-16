# S-PAY

S-PAY is a digital money super app for remote workers and businesses, **built on Celo**: wallets holding USDC/USDT provisioned **just-in-time at the first money action** via an admin-switchable WaaS (Privy / Coinbase CDP / Turnkey / Openfort / thirdweb / Dynamic), virtual USD/EUR bank accounts with automatic fiat→stablecoin conversion (Noah), local cash-outs (M-Pesa, MoMo, PIX, SEPA…), guided exchange withdrawals (Binance/Bybit/OKX), an admin-switchable Stripe Issuing card program, and a 3,000–5,000-listings/day remote jobs board that doubles as the SEO + signup-acquisition engine.

> Operational source of truth: **`LAUNCH-CHECKLIST.md`** (what's live, provider activation, remaining tasks D1–D10). Product/deploy reference: `README.md`. Wallet providers deep dive: `docs/WALLET-PROVIDERS.md`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query hooks + Zod schemas from the OpenAPI spec (run after ANY spec change)
- Schema changes: edit `lib/db/src/schema/`, then in `lib/db`: `DATABASE_URL=postgres://x:x@localhost/x pnpm exec drizzle-kit generate --name <name>`, then hand-edit the SQL to be idempotent (`IF NOT EXISTS` / `DO $$ ... duplicate_object` — see migrations 0000–0007). Migrations auto-apply on server boot.

## Stack

- pnpm workspaces, TypeScript 5.9; API: Express 5, esbuild **ESM** bundle (`dist/index.mjs`), Dockerized on Render
- DB: PostgreSQL + Drizzle (Render Postgres or Supabase/Neon — TLS auto-detected, `DATABASE_SSL` override); migrations applied programmatically at boot (`src/lib/migrate.ts`)
- Auth: JWT HS256 30d (`jsonwebtoken`), bcrypt 12; Google web OAuth + native Google/Apple token sign-in verified against provider JWKS via `jose`; soft email verification + password reset via Resend (`lib/email.ts` — sha256 tokens in users table, links logged when RESEND_API_KEY unset)
- Chain: Celo mainnet — balances via Forno JSON-RPC (keyless); sends signed by the wallet's own provider: Privy (`/v1/wallets/{id}/rpc` eth_sendTransaction), CDP/Turnkey/Openfort (SDK signer + viem `writeContract` on `celo` chain, broadcast via Forno), thirdweb (REST, queued tx → poll for hash), Dynamic (TSS-MPC via native signer); USDC `0xcebA…118C`, USDT `0x4806…3D5e` (6 decimals)
- Web: React + Vite SPA (wouter, TanStack Query staleTime 30s) on Vercel; Mobile: Expo SDK 54 (expo-router) via EAS
- Contract-first: `lib/api-spec/openapi.yaml` → orval → `lib/api-client-react` (hooks) + `lib/api-zod` (validators)

## Where things live

- `artifacts/api-server/src/routes/` — `auth` (register/login/oauth/me [GET + **PATCH profile**]/delete/verify-email/reset/pin), `notifications` (list/mark-read; helper `lib/notify.ts` — notifyUser/notifyAll, called from sends/webhooks/admin), `enquiries` (public POST, rate-limited), `kyc` (start), `wallet` (chain balances, P2P + address sends, deposit instructions), `banking` (accounts/rates/withdraw — Noah-gated), `card` (details/issue/waitlist — flag-gated), `jobs` (+ `/sitemap.xml`), `ssr` (bot-rendered job pages), `admin` (stats/users/transactions/feature-flags/fees/custom-jobs/settings), `webhooks` (Noah KYC/KYB + deposits, Stripe), `health` (`/healthz`, `/status`)
- `artifacts/api-server/src/lib/` — `jobs` (aggregator+filters+custom listings), `wallet-providers` (WaaS abstraction: Privy/CDP/Turnkey/Openfort/thirdweb/Dynamic, JIT provisioning `ensureUserWallet`, per-wallet signing), `celo-chain` (keyless balances, token constants), `stripe-issuing`, `settings` (app_settings: flags/fees/maintenance/wallet_providers), `migrate`, `auth`
- `artifacts/api-server/src/middlewares/` — `auth` (JWT), `maintenance` (503 gate; allows health/status/login/oauth/webhooks/admin)
- Web pages: `artifacts/web/src/pages/` (+ `admin/`, `maintenance.tsx`, `exchange-withdraw.tsx`); layouts in `components/layout.tsx` (app), `public-layout.tsx` (marketing), `admin/layout.tsx`
- Mobile: `artifacts/mobile/app/` — `welcome` (MiniPay-style entry), tabs `index|banking|card|jobs`, `login/register` (+ `SocialAuthButtons`), `profile` (delete account)
- DB schema: `lib/db/src/schema/` — `users` (accountType/businessName/country/signupSource/celoWalletAddress/walletId [DB col `privy_wallet_id`, historical name]/walletProvider/noahCustomerId/stripe ids), `transactions`, `card-waitlist`, `jobs-cache`, `app-settings`, `custom-jobs`

## Architecture decisions

- **Jobs**: 60+ sources fetched ONCE into a single in-memory dataset (hourly loop + boot warm-up + `jobs_cache` Postgres snapshot for cold starts). Category/keyword filtering is in-memory (`filterJobs`) — accepts Remotive ids (`software-dev`, web) AND labels (`Engineering`, mobile). Admin `custom_jobs` are prepended (source `SPAY`). Descriptions capped at 16KB.
- **SEO**: `vercel.json` routes bot user-agents on `/jobs*` to `https://s-pay.onrender.com/ssr/...` (server-rendered HTML + JobPosting JSON-LD); humans get the SPA. `/jobs-sitemap.xml` proxies the API sitemap. If the Render hostname changes, update those 3 destinations.
- **Money**: balances are read from chain (never stored); `transactions` table is the display ledger (sends, P2P receives, Noah deposit credits). No demo/mock money anywhere — empty states are honest. Fees come from the admin-editable `fee_schedule` (user price = provider cost + margin).
- **Wallets are lazy on purpose** (WaaS bills per active wallet user): signup/login/read paths NEVER call the wallet provider — auth is pure Postgres+JWT, balances are keyless Forno reads. `ensureUserWallet()` provisions just-in-time from money actions only (send — incl. the P2P recipient —, add-funds, withdraw), race-safe via `WHERE celo_wallet_address IS NULL`. Each wallet records `wallet_provider`; sends are signed by the wallet's own provider (keys never move between providers). Admin picks the active provider + per-provider kill switches live.
- **Feature flags** (`app_settings`, 15s cache): `card_program_enabled`, `maintenance_mode`, `fee_schedule`, `wallet_providers` (active + enabled map). Toggled live from `/admin/settings`, no deploy.
- **Accounts**: `personal` (Noah KYC) vs `business` (Noah KYB, requires `businessName`, virtual accounts in company name). Identical wallet/USDC/USDT rails for both.
- **Attribution**: every signup records `signup_source` (jobs board → `jobs:<jobId>`; carried through Google OAuth `state`; mobile tags itself).
- **Admin roles** (`lib/admin-roles.ts`): superadmin / manager / support in `users.admin_role`, resolved from DB per request (instant revocation). `ADMIN_EMAILS` env = permanent superadmins (bootstrap + recovery, immutable from UI). Matrix: any-admin = reads + enquiries; manager+ = custom-jobs, notifications; superadmin = all PUT switches (flags/fees/wallet-providers/site-content) + team CRUD (no self-demote, env-admins protected).
- **Notifications**: rows with user_id are personal, NULL = broadcast; per-user read state = users.notifications_read_at (no fan-out). Auto-fired on P2P receive, Noah deposit credit, KYC approval; manual via POST /admin/notifications.
- **Site content** (`app_settings.site_content`): hero/footer/colours served by public GET /site-content, consumed by landing + public layout; edited in Admin → Settings.
- **Transaction PIN** (`lib/pin.ts`): bcrypt-hashed 4–6 digit PIN in users.transaction_pin_hash, REQUIRED on every money-out path — `/wallet/send` and `/banking/withdraw` — the login JWT alone never moves money. ALL client cash-out flows collect + pass it: web `quick-actions` (P2P), `exchange-withdraw` (crypto), `withdraw` (bank/mobile-money); mobile `(tabs)/index` (P2P) + `withdraw`. 5 wrong tries → 15-min lockout (atomic SQL increment); `/auth/pin` sets/changes it (change needs currentPin). API returns hasPin; never the hash. Errors: pin_not_set(428)/pin_locked(423)/pin_wrong(401).
- **Profile editing** (`PATCH /auth/me`): name/phone/country/businessName/avatarUrl, all optional, persisted to the users row (email immutable). Phone must be unique (it's the P2P key — collision → phone_in_use), avatarUrl must be http(s) (blocks javascript:/data:), businessName can't be blanked on business accounts. Web `pages/profile.tsx` + mobile `app/profile.tsx` inline-edit and invalidate the getMe cache.
- **Transfer commission** (`settings.transferFee` + `TREASURY_CELO_ADDRESS`): per-send fee = transferFeeFlat + amount*p2pFeePercent/100, computed SERVER-SIDE (never trust client), charged on top, swept to the treasury wallet after the main send (best-effort). Only charged when a treasury address is set. On-chain Celo gas (sub-cent) is the real cost; the flat fee is the margin. Admin edits both in Settings → Fees.
- **Send recipient resolution**: phone OR email (both → DB lookup, self-send blocked, recipient wallet JIT-provisioned) OR raw 0x address. If the DB lookup misses AND SocialConnect is active, `resolveByIdentifier()` is tried before 404 (resolves to an external Celo address; no recipientUser/receive record).
- **SocialConnect** (`lib/socialconnect.ts`, flag `socialconnect` in `lib/settings.ts`): OPTIONAL, additive Celo identity layer (phone/email → address via FederatedAttestations + ODIS). NOT a WaaS replacement and does NOT reduce wallet cost — different layer. Admin switch (`/admin/settings`, `socialConnectEnabled` in feature-flags) + send-flow fallback are wired; `resolveByIdentifier`/`publishAttestation` are intentionally no-op stubs (return null / skip) until `SOCIALCONNECT_ISSUER_ADDRESS`+`_PRIVATE_KEY` are set AND the ODIS/on-chain calls are implemented — full guide in `docs/SOCIALCONNECT.md`. `isSocialConnectActive()` = configured AND flag on; resolver short-circuits to null when inactive (no DB hit, no throw), so sends are unchanged by default.
- **Security**: helmet (CSP off for SSR pages), trust proxy 1, rate limits on /api/auth/* incl. /auth/pin (50/15min/IP) and /api/enquiries (10/h/IP).
- **CORS** (`app.ts`): two tiers. Public read-only paths (`/api/jobs`, `/api/sitemap.xml`, `/api/site-content`, `/api/status`, `/api/healthz`) reflect ANY origin (GET **and** its OPTIONS preflight — once logged in the client adds an Authorization header, making even jobs a preflighted request). Everything else (auth/wallet/admin) is credentialed + locked to the `CORS_ORIGIN` allowlist, into which S-PAY's own prod origins (`spayewallet.com` + `www.`) are ALWAYS merged so a CORS_ORIGIN typo can't lock users out of login (symptom: "Failed to fetch" on login while the jobs board still loads). Unset CORS_ORIGIN = allow all (dev).
- **Money UX**: receive-from-exchange = per-source guided steps (Binance/Bybit/OKX/wallet) with "My QR code" as ONE option (web + mobile deposit screens); dashboard "Money" grid — Mobile money tile opens a Top up / Withdraw chooser; /deposit and /banking/withdraw both group mobile-money providers under ONE expandable option (M-Pesa/MTN/Airtel/GCash/Nequi chips). /how-it-works renders inside the app Layout for signed-in users (PublicLayout for visitors) — signed-in users never leave the app shell.
- **Dark mode**: class-based (`@custom-variant dark` in index.css), toggle persists in localStorage (`spay-theme`); marketing pages stay light by design.
- **Webhooks**: HMAC over the **raw body** (captured in `app.ts`), constant-time compare; unsigned rejected once a secret is set.

## Gotchas

- `lib/api-zod/src/index.ts` must stay `export * from "./generated/api"` only (orval `single` mode, TS2308).
- Never hand-edit `lib/*/src/generated/` — regenerate via codegen.
- Migrations MUST be idempotent (DB may pre-date a migration via old `drizzle-kit push`). 14 migrations (0000–0013).
- `drizzle-kit generate` may emit a phantom diff that DROP/CREATEs `idx_notifications_user_created` + `idx_enquiries_created` as `DESC NULLS LAST`. It's a snapshot-normalization artifact with ZERO functional effect (both index columns are NOT NULL `created_at`) — discard the generated file + revert `meta/_journal.json`; do NOT commit it (it only churns prod indexes). Schema is otherwise in sync.
- Expo: `app.json` only (no app.config.ts). `updates` disabled until `eas init` writes a real projectId. Mobile API URL = `EXPO_PUBLIC_API_URL` (EXPO_PUBLIC_DOMAIN is the Replit-dev fallback).
- Server REQUIRES `DATABASE_URL` (fails fast). Jobs work without DB but lose snapshot/custom listings.
- Job ids are deterministic (`stableId`) so detail links survive hourly refreshes; ids appear in sitemap URLs.
- Web Google buttons must hit `/api/auth/google` (the `/api` prefix bug was fixed once already).
- The maintenance gate fails OPEN if the settings read errors — never locks the platform.
- NEVER call the wallet provider (or import `lib/wallet-providers`) from auth or read endpoints — it would re-create the per-MAU WaaS bill the lazy design exists to avoid. New money features get wallets via `ensureUserWallet()` inside the money action.
- `@dynamic-labs-wallet/*` is EXTERNALIZED in `build.mjs` (native glibc MPC binary, unbundleable): the Dockerfile prod stage must stay glibc (`node:20-slim`, NOT alpine) and `npm install` those two packages, pinned to the bundle's version. Dynamic wallets store their metadata JSON in the wallet-id column; their share-backup passwords derive from `DYNAMIC_WALLET_PASSWORD_SECRET` (loss = Dynamic wallets can't sign).

## User preferences

- Brand: Primary #4DC9EE, Accent #A8DEFF, Navy #1A2B4A, Celo yellow #FCFF52 ("Built on Celo" everywhere, MiniPay-style)
- 500K+ users marketing claim stays until 2028 per owner; jobs board is free on purpose (acquisition funnel)
- Target: remote workers + businesses in Africa, SE Asia, LatAm; domain spayewallet.com
- Fees: owner adds margin on provider costs via admin Fees panel; P2P default free (growth)
