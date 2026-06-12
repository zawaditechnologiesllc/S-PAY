# S-PAY — Launch Checklist & Operations Runbook

> **This is the single document to work from.** It inventories what is built and live,
> the exact steps to activate each provider, every remaining code task with file paths,
> and how to operate the platform day-to-day — all without a terminal.
>
> Companion docs: [`README.md`](./README.md) (product + deployment reference) ·
> [`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md) (wallet providers: setup, switching, cost strategy) ·
> [`replit.md`](./replit.md) (developer/agent architecture context).

---

## A. What is already built and live

| Area | Status | Where it lives |
|---|---|---|
| **Jobs board** — 3,000–5,000 listings/day from 60+ sources, instant category filters + search, hourly refresh, Postgres snapshot for cold starts, "Load more" | ✅ Live | `artifacts/api-server/src/lib/jobs.ts`, web `pages/jobs.tsx` + `public-jobs.tsx`, mobile `(tabs)/jobs.tsx` |
| **Self-injected job listings** (pinned, SPAY badge, SEO content) | ✅ Live | Admin → Job Listings (`pages/admin/jobs.tsx`), API `routes/admin.ts`, table `custom_jobs` |
| **Jobs SEO** — sitemap (3–5k URLs), Google for Jobs JSON-LD, bot-routed server-rendered pages, social preview cards | ✅ Live (needs one-time Search Console submit, see C3) | `routes/ssr.ts`, `routes/jobs.ts` (sitemap), `vercel.json` (bot rewrites), `artifacts/web/public/robots.txt` |
| **Auth** — email/password (confirm + show/hide), Google web OAuth, native Google (Android) & Apple (iOS) token sign-in, JWT 30d | ✅ Live (Google/Apple need client IDs, see B4/B5) | `routes/auth.ts`, web `pages/register.tsx`/`login.tsx`, mobile `components/SocialAuthButtons.tsx` |
| **Personal & Business accounts** — type chooser at sign-up, business name, KYB-ready | ✅ Live | `routes/auth.ts`, register pages, `users.account_type/business_name` |
| **Signup attribution** — `jobs / jobs:<id> / landing / google / mobile / direct` + country, shown in admin | ✅ Live | `users.signup_source`, Admin → Dashboard "Signups by Source" |
| **Celo wallet provisioning** — just-in-time at the user's **first money action** (deposit address / send / withdraw), never at signup/login, via the admin-selected provider (**Privy / Coinbase CDP / Turnkey**), no seed phrase | ✅ Code complete — activates with any provider's keys (B2) | `lib/wallet-providers.ts` |
| **Wallet provider switches** — active provider for new wallets + per-provider kill switches, wallet counts, live from admin | ✅ Live | Admin → Settings → Wallet Infrastructure; `GET/PUT /admin/wallet-providers` |
| **USDC/USDT wallet** — live on-chain balances (keyless reads), P2P send by phone (recipient wallet auto-provisioned), send to any address, real ledger | ✅ Live for balances/receives; sends activate with a wallet provider's keys | `lib/celo-chain.ts`, `lib/wallet-providers.ts`, `routes/wallet.ts` |
| **Withdraw to Binance/Bybit/OKX/any wallet** — MiniPay-style guided flow, CELO-network safety gates, CeloScan receipt | ✅ Live (executes once a wallet provider's keys are set) | web `pages/exchange-withdraw.tsx` |
| **Fiat → stablecoin auto-conversion credit** — bank/IBAN deposits land as USDC/USDT in history | ✅ Code complete — fires on Noah webhooks (B3) | `routes/webhooks.ts` |
| **Virtual accounts + cash-outs (M-Pesa, MoMo, PIX, SEPA…)** — UI, quotes, fee engine, 16-corridor rates | ⚙️ UI + quotes live; **execution awaits Noah key** (B3 + D2) | `routes/banking.ts`, web `pages/banking.tsx`/`withdraw.tsx` |
| **KYC/KYB via Noah** — webhook-driven approval for personal (KYC) and business (KYB) | ✅ Webhooks ready — needs Noah key + D1 (initiation) | `routes/webhooks.ts` |
| **Virtual card program** — Stripe Issuing wired end-to-end, DB waitlist, KYC gate, admin master switch | ✅ Code complete — set Stripe keys + flip switch (B6) | `lib/stripe-issuing.ts`, `routes/card.ts`, Admin → Settings |
| **Admin console** — stats, signups-by-source, users (type/country/source), transactions, job listings, settings | ✅ Live | `pages/admin/*` |
| **Admin master switches** — card program, **maintenance mode** (+message), **fee schedule** (your margin), **wallet providers** (active WaaS + kill switches) | ✅ Live | Admin → Settings; stored in `app_settings` |
| **Maintenance mode** — 503 for users, branded screen; sign-in/admin/webhooks/SSR stay up | ✅ Live | `middlewares/maintenance.ts`, web `pages/maintenance.tsx` |
| **Account deletion (store compliance)**, in-app legal links, Sign in with Apple | ✅ Live | profile pages, `DELETE /auth/me` |
| **Mobile app** — MiniPay-style welcome, tabs (Wallet/Banking/Card/Jobs), platform-native auth | ✅ Code complete — needs EAS setup to ship (B7) | `artifacts/mobile/` |
| **Auto-migrations** — schema applies itself on every boot (10 migrations) | ✅ Live | `lib/db/migrations/`, `src/lib/migrate.ts` |

**Database**: PostgreSQL (Render Blueprint auto-provisions `spay-db`; Supabase supported — TLS auto-detected). Tables: `users`, `transactions`, `card_waitlist`, `jobs_cache`, `app_settings`, `custom_jobs`.

---

## B. Provider activation steps (each unlocks a feature instantly — no deploy)

### B1. Database — required for everything
1. Render → **New → Blueprint** → pick this repo → it creates `spay-db` + wires `DATABASE_URL`.
   *(Already running another way? Render → `spay-api` → Environment → set `DATABASE_URL` manually.)*
2. ⚠️ Render's free Postgres is **deleted ~45 days after creation**. Upgrade `spay-db` → Settings → paid plan (~$7/mo), **or** use Supabase (free forever): supabase.com → New project → Connect → copy the **Session pooler URI** → paste into `DATABASE_URL`.
3. Verify: Render → `spay-api` → Logs → `Database migrations applied`.

**Supabase troubleshooting — tables not appearing automatically:**
The API creates all tables itself at boot; if Supabase stays empty, the connection from Render is failing. Check Render → Logs right after a deploy:
- `DATABASE_URL must be set` → the env var isn't saved on the service.
- `Database migration failed …` → read the error beneath it; the three classic Supabase string mistakes are:
  1. **`[YOUR-PASSWORD]` placeholder left in the URI** — replace it with the real DB password.
  2. **Direct connection string used** (`db.<ref>.supabase.co:5432`) — that host is **IPv6-only** on Supabase and unreachable from Render. Use the **Session pooler** string instead: host `aws-0-<region>.pooler.supabase.com`, **port 5432**, username `postgres.<ref>` (Supabase → Connect → Session pooler).
  3. **Transaction pooler used** (port **6543**) — connects but is unreliable for migrations; switch to port **5432** (session mode).
- After fixing, **Save Changes** (Render redeploys automatically) and watch for `Database migrations applied`. The 6 tables + the `drizzle` journal schema appear in Supabase's Table Editor.
- **Security & performance (automatic since migration 0008):** all tables have **RLS enabled with no policies** — a deny-all lock on Supabase's auto-generated REST Data API (the S-PAY API connects as table owner and bypasses RLS, so nothing changes for the app). For belt-and-braces you can also turn the Data API off entirely: Supabase → Project Settings → Data API → disable. Hot-path **indexes** ship in the same migration (transactions by user+date, users by phone / Noah customer id / created / KYC status).
- **Manual fallback (always safe):** every file in `lib/db/migrations/*.sql` is idempotent — you can paste them **in numeric order** into Supabase's SQL Editor and run them. The boot migrator will still reconcile harmlessly afterwards. Fix the connection anyway, or future schema changes won't auto-apply.

### B2. Wallet provider — turns ON Celo wallets + USDC/USDT sends + exchange withdrawals

Pick **one** of the three supported providers (full walkthroughs, pricing comparison, and switching semantics in [`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md)). Wallets are provisioned **just-in-time at a user's first money action — never at signup/login** — so jobs-board signups cost zero WaaS MAUs; you only pay for users who actually move money.

**Option 1 — Privy** (MAU-tier pricing: free <~500 MAUs, then $299/mo):
1. [dashboard.privy.io](https://dashboard.privy.io) → create app → **App settings → API keys**.
2. Render env: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`.
3. In Privy: enable **gas sponsorship** (recommended — gasless sends for users). Without it, wallets need a dust of CELO for gas.

**Option 2 — Coinbase CDP** (cheapest at scale: $0.005/wallet operation, first 5,000 ops/month free, no MAU billing):
1. [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → create project → **API Keys** → create a Secret API key.
2. **Server Wallets → Wallet Secret** → generate it (shown once — store safely).
3. Render env: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`.
4. Gas note: CDP wallets pay gas in CELO (sub-cent) — dust wallets with CELO or fund gas operationally.

**Option 3 — Turnkey** (per-signature pricing: 25 free/mo, then $0.10 PAYG / ~$0.01 on Pro, no MAU billing):
1. [app.turnkey.com](https://app.turnkey.com) → create organization → note the **Organization ID**.
2. Create an **API key pair** → copy public + private key hex.
3. Render env: `TURNKEY_API_PUBLIC_KEY`, `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_ORGANIZATION_ID`.
4. Same gas note as CDP.

**Then activate it:**
5. `/admin/settings` → **Wallet Infrastructure** → your provider shows green **Configured** → press **Make active** (Privy is the default active provider).
6. Verify: log in as any user → tap **Add funds** (or make a send) → a `0x…` Celo address appears on the profile within seconds. *Registering alone no longer creates a wallet — that's the cost feature, not a bug.*
7. ⚠️ Existing wallets keep the provider that created them forever (keys can't move) — when switching providers, keep the old provider's env keys set and its toggle ON while it still holds wallets (the panel shows per-provider counts).

### B3. Noah — turns ON KYC/KYB, virtual accounts, fiat auto-conversion, cash-outs
1. Apply at noah.com for a partner account — request **both KYC (individuals) and KYB (businesses)** products.
2. Render env: `NOAH_API_KEY`.
3. Noah dashboard → Webhooks → add `https://<your-api>.onrender.com/api/webhooks/noah` → subscribe: `customer.kyc_approved/rejected`, `business.kyb_approved/rejected`, `payment.received`, `transfer.completed/failed` → copy signing secret → Render env: `NOAH_WEBHOOK_SECRET`.
4. Complete code task **D1** (KYC initiation) and **D2** (payout execution) — small, marked in code.

### B4. Google sign-in (web + Android)
1. console.cloud.google.com → OAuth credentials:
   - **Web client** → redirect URI `https://<your-api>.onrender.com/api/auth/google/callback` → Render env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `API_BASE_URL`.
   - **Android client** (package `com.zawaditechnologies.spay` + SHA-1 from EAS credentials) → Render env: `GOOGLE_ANDROID_CLIENT_ID`; EAS secrets: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

### B5. Sign in with Apple (iOS)
1. developer.apple.com → Identifiers → enable *Sign in with Apple* for `com.zawaditechnologies.spay`.
2. Render env: `APPLE_BUNDLE_ID` only if the bundle id ever differs (defaults correctly). Works automatically in EAS iOS builds.

### B6. Stripe Issuing — turns ON the card program
1. Stripe → activate **Issuing** → Developers → API keys → Render env: `STRIPE_SECRET_KEY`.
2. Webhook endpoint `https://<your-api>.onrender.com/api/webhooks/stripe` (events: `issuing_authorization.*`, `issuing_transaction.*`) → Render env: `STRIPE_WEBHOOK_SECRET`.
3. Optional env: `CARD_PROGRAM_ADDRESS_LINE1/CITY/STATE/POSTAL/COUNTRY` (cardholder billing address; sensible defaults set).
4. **Flip the switch**: `/admin/settings` → Card Program Master Switch → ON. Waitlist instantly becomes "Create My Virtual Card" (admin panel shows waitlist demand first).
5. Complete code task **D3** (record card transactions from webhooks) when you want spend history to populate.

### B7. Mobile release (Android + iOS)
1. expo.dev → create project → in a Codespace run `eas init` once (writes the real `projectId` into `app.json`), commit.
2. Re-enable OTA updates in `artifacts/mobile/app.json`: `"updates": {"enabled": true, "url": "https://u.expo.dev/<projectId>"}` (eas init prints it).
3. EAS → Secrets: `EXPO_PUBLIC_API_URL=https://<your-api>.onrender.com` + the Google client IDs (B4).
4. Build: EAS dashboard → Builds → Android (profile `preview` = installable APK; `production` for stores).
5. **Store compliance (console-side, code is ready):**
   - Play Console: Data Safety form · account-deletion URL → `https://spayewallet.com/profile` · content rating · **Finance app declaration**.
   - App Store Connect: privacy nutrition labels · reviewer demo account · in-app account deletion (already built) will be checked.
   - Verify `assets/images/icon.png` is 1024×1024 with the logo inside the central ~66% (adaptive-icon crop safety).

---

## C. One-time platform tasks

| # | Task | Where | Status |
|---|---|---|---|
| C1 | Register your account, then set `ADMIN_EMAILS` (comma-separated) and `CORS_ORIGIN` | Render → spay-api → Environment | ☐ |
| C2 | Set `SITE_URL=https://spayewallet.com` (canonicals + sitemap URLs) | Render env | ☐ |
| C3 | Submit `https://spayewallet.com/jobs-sitemap.xml` in Search Console (domain already verified); spot-check a job URL in the Rich Results test | search.google.com/search-console | ☐ |
| C4 | If the Render hostname is NOT `spay-api.onrender.com`, update the **3 destinations** in `vercel.json` (bot rewrites ×2 + sitemap proxy) | `vercel.json` | ☐ |
| C5 | Review the fee schedule (withdrawal %, min, card fee, P2P) — defaults: 1% / $0.49 / $1.00 / free | `/admin/settings` → Fees & Revenue | ☐ |
| C6 | Decide on the landing testimonials (currently illustrative personas with earnings claims — owner's call) | `artifacts/web/src/pages/landing.tsx` → `TESTIMONIALS` | ☐ |
| C7 | Claim brand social handles, then add links back to the footer | `artifacts/web/src/components/public-layout.tsx` | ☐ |

---

## D. Remaining code tasks (everything else is done)

Ordered by launch impact. Each is small and isolated; the file tells you exactly where.

| # | Task | File(s) | What to build |
|---|---|---|---|
| **D1** | **KYC/KYB initiation** — the "Verify Now" button is static | `artifacts/api-server/src/routes/auth.ts` or new `routes/kyc.ts`; buttons in web `pages/profile.tsx` (~line 117) + dashboard banner | `POST /kyc/start`: create Noah customer (individual or business per `user.accountType`, include `businessName`), save `noahCustomerId`, return Noah's hosted verification URL; open it from the button. Approval already flows back via webhooks. |
| **D2** | **Execute payouts via Noah** — withdraw currently quotes + records, gated 503 until key | `artifacts/api-server/src/routes/banking.ts` (`POST /banking/withdraw`) | When `NOAH_API_KEY` set: call Noah payout API (M-Pesa/MoMo/PIX/SEPA/bank) with quoted fee, debit by sending USDC from user wallet to the Noah settlement address, insert `withdraw` transaction. `transfer.completed/failed` webhooks already logged — flip them to update the transaction row. |
| **D3** | **Card spend history** — webhook events logged but not recorded | `artifacts/api-server/src/routes/webhooks.ts` (Stripe section); serve in `routes/card.ts` `/card/transactions` + `/card/spending-summary` | On `issuing_transaction.created`: find user by `metadata.spay_user_id` (already set at issuance), insert a `payment` transaction with merchant name/category; aggregate for the spending summary. |
| **D4** | **Virtual account provisioning** — banking accounts list is empty until Noah | `artifacts/api-server/src/routes/banking.ts` (`GET /banking/accounts`) | After KYC/KYB approval, fetch/create the user's US ACH + EU IBAN from Noah and return them (account in `businessName` for business accounts). |
| **D5** | **Forgot-password backend** — page exists, **no API route** | New: `POST /auth/forgot-password` + `POST /auth/reset-password` in `routes/auth.ts`; wire `web/src/pages/forgot-password.tsx`; needs an email provider (e.g. Resend) + reset-token column/table | Until built, the page is a dead end — either build or temporarily link "Contact support" instead. |
| **D6** | Dashboard quick-action buttons (Scan/Transfer/Recharge/Withdraw) are decorative | `web/src/pages/dashboard.tsx` (`QuickAction`) | Link: Transfer → P2P send UI (build a small send dialog calling `POST /wallet/send`), Recharge → wallet deposit (add-funds modal showing the Celo address), Withdraw → `/banking/withdraw`, Scan → QR scan (mobile-first, can hide on web). |
| **D7** | Card "Show Details" / "Manage Card" buttons are static | `web/src/pages/card.tsx` | Details: Stripe Issuing ephemeral-key flow to reveal PAN/CVV; Manage: freeze/unfreeze via `POST /issuing/cards/:id` (status `inactive`/`active`). |
| **D8** | Exchange-withdraw screen on **mobile** (web is done) | New `artifacts/mobile/app/exchange.tsx` mirroring `web/src/pages/exchange-withdraw.tsx` | Same guided steps/safety gates; reuse `useSendMoney`. |
| **D9** | Jobs "Load more" on mobile (fetches first 30 only) | `artifacts/mobile/app/(tabs)/jobs.tsx` | Raise `limit` and/or add FlatList `onEndReached` paging like the web pages. |
| **D10** | Transfer fee collection — P2P/withdraw fees are computed and quoted, but the fee itself isn't yet swept to a treasury wallet | `routes/wallet.ts` (send), D2 (withdraw) | Add `TREASURY_CELO_ADDRESS` env; send the fee portion there in the same flow when fee > 0. |

---

## E. Operating the platform (no terminal, ever)

- **Admin console** `/admin`: stats + signups-by-source · **Users & KYC** (type, country, source) · **Transactions** · **Job Listings** (inject/remove pinned SPAY roles — also your SEO content lever) · **Settings**.
- **Settings switches**: Maintenance mode (+ user-facing message) · **Wallet Infrastructure** (active WaaS provider + per-provider kill switches — see `docs/WALLET-PROVIDERS.md` §5 for playbooks) · Card Program · Fees & Revenue (live repricing).
- **Health**: `GET /api/healthz` (uptime) · `GET /api/status` (maintenance state) · `GET /api/jobs?limit=1` (`total` = live job count) · Render Logs ("Database migrations applied", "Jobs feed warmed", hourly refresh lines).
- **Deploys**: merge to `main` → Render (API) + Vercel (web) auto-deploy. DB schema changes apply themselves on boot.
- **Schema changes** (developer task): edit `lib/db/src/schema/`, run `drizzle-kit generate` in `lib/db`, make the SQL idempotent (`IF NOT EXISTS` — see migrations 0001–0007 for the pattern), commit.
- **API changes** (developer task): edit `lib/api-spec/openapi.yaml` → `pnpm --filter @workspace/api-spec run codegen` → use the generated hooks. Never hand-edit `lib/*/src/generated/`.

## F. Environment variables — complete inventory

See **README → Environment Variables** for the full annotated tables (launch-critical, money rails, sign-in, tuning, Vercel, EAS). Quick reference of every key:

`DATABASE_URL` · `JWT_SECRET` · `SESSION_SECRET` · `CORS_ORIGIN` · `ADMIN_EMAILS` · `SITE_URL` · `PRIVY_APP_ID` · `PRIVY_APP_SECRET` · `CDP_API_KEY_ID` · `CDP_API_KEY_SECRET` · `CDP_WALLET_SECRET` · `TURNKEY_API_PUBLIC_KEY` · `TURNKEY_API_PRIVATE_KEY` · `TURNKEY_ORGANIZATION_ID` · `NOAH_API_KEY` · `NOAH_WEBHOOK_SECRET` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_ANDROID_CLIENT_ID` · `GOOGLE_IOS_CLIENT_ID` · `APPLE_BUNDLE_ID` · `FRONTEND_URL` · `API_BASE_URL` · `CELO_RPC_URL` · `CELO_CAIP2` · `PRIVY_API_BASE` · `TURNKEY_API_BASE` · `DATABASE_SSL` · `CARD_PROGRAM_ADDRESS_*` · `REMOTIVE_AFFILIATE_URL` · `REMOTE_COM_AFFILIATE_URL` · `MIGRATIONS_DIR` · `TREASURY_CELO_ADDRESS` (reserved for D10) — plus Vercel `VITE_API_URL`, EAS `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`.
