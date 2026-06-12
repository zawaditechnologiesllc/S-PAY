# S-PAY — Digital Money Super App for Remote Workers

**Built by Zawadi Technologies LLC · Built on [Celo](https://celo.org)**

> 📋 **Start here for operations:** [`LAUNCH-CHECKLIST.md`](./LAUNCH-CHECKLIST.md) — what's live, how to activate each provider (wallets/Noah/Stripe/Google/Apple/EAS), every remaining task with file paths, and how to run the platform without a terminal. For wallets specifically (the six switchable providers, costs, setup): [`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md).

Like MiniPay, S-PAY is built on the Celo network: stablecoin-first balances (USDC), sub-cent fees, 5-second finality, and no seed phrase, ever — a wallet appears automatically the first time money moves.

S-PAY was born in 2016 by a team of full-stack fintech and crypto engineers frustrated by PayPal blocking legitimate remote worker accounts across Africa and Southeast Asia. The goal: give every remote worker a real US bank account, instant local cash-outs, and the financial tools they deserve — with no gatekeeper.

---

## What S-PAY Does

| Feature | What it gives the user |
|---|---|
| **Digital Wallet** | Hold USD balance, send/receive money globally |
| **Virtual Bank Account** | Real US ACH routing number + European IBAN — get paid like a local business |
| **Global Payouts** | Withdraw to M-Pesa, MTN MoMo, PIX, SEPA, bank transfers in 180+ countries |
| **Remote Jobs Board** | 3,000–5,000 remote-only roles available daily, aggregated from 60+ sources, refreshed hourly, free for all users |
| **Virtual Card** | Complete and integration-ready: Stripe Issuing wired end-to-end (cardholder + virtual card creation, KYC-gated, DB-backed waitlist). An admin flips the **Card Program master switch** in `/admin/settings` to take it from waitlist → live — no deploy needed |
| **KYC / Identity Verification** | Automated via Noah — no manual review, no waiting |

> **The jobs board is free on purpose** — it's S-PAY's acquisition funnel. Job seekers discover S-PAY through listings, sign up to apply, and become wallet users. Every account records its `signupSource` (`jobs`, `jobs:<jobId>`, `landing`, `google`, `mobile`, `direct`), and the admin dashboard shows the **Signups by Source** breakdown so you always know which channel is converting.

---

## Onboarding — MiniPay-style, on the Celo network

S-PAY's onboarding follows the [MiniPay](https://www.opera.com/products/minipay) playbook: a wallet in seconds, no seed phrase, no crypto knowledge required.

1. **Sign up in under 2 minutes** — email + password, or one tap with Google. Phone number optional (used for P2P transfers, M-Pesa/MoMo payouts). Signup and login run **entirely on S-PAY's own database + JWT** — no third-party wallet service is contacted.
2. **Celo wallet created invisibly at the first money action** — the first time a user asks for a deposit address, sends money, or withdraws, S-PAY provisions an EVM wallet on the **Celo network** through the admin-selected wallet provider (**Privy**, **Coinbase CDP**, **Turnkey**, **Openfort**, **thirdweb**, or **Dynamic** — switchable live in `/admin/settings`). No seed phrase to write down; private keys live in the provider's TEE infrastructure and **never touch S-PAY servers or the database** — we store only the public address (`celoWalletAddress`).
   *Why lazy? Wallet providers bill for active wallet users. The jobs board brings thousands of signups who may never move money — they cost zero this way, and only paying users ever appear on the WaaS bill. Full rationale: [`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md).*
3. **Receiving is one tap away** — tap "Add funds" and the wallet (created on the spot if needed) holds **USDC on Celo** (stablecoin-first, like MiniPay's cUSD/USDC). Friends and clients can pay you by phone number or wallet address; P2P recipients get their wallet auto-created the moment someone first pays them.
4. **KYC when you need more** — Noah's automated verification (government ID + selfie) unlocks the virtual US ACH account, the European IBAN, and local cash-outs. Approval is webhook-driven — no manual review queue.
5. **Cash out where you live** — M-Pesa, MTN MoMo, PIX, SEPA and 50+ methods, settled from your Celo USDC balance at live FX rates.

Why Celo: sub-cent transaction fees, 5-second finality, mobile-first design, and fee abstraction (gas payable in stablecoins) — the same reasons MiniPay chose it. Configure at least one wallet provider (see [`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md)) to activate wallets; accounts created before that get their wallet automatically at their next money action.

---

## How Payments Work

### Receiving money
1. User signs up, and their **Celo wallet appears at the first money action** (no seed phrase) — requesting a deposit address, sending, withdrawing, or being paid P2P all create it on the spot. From then on anyone can pay them in USDC/USDT by phone number or wallet address, including withdrawals from Binance/Coinbase to their S-PAY address.
2. After verification (KYC for personal, **KYB for business**), Noah provisions a **virtual US bank account** (ACH routing + account number) and an **EU IBAN** — in the company's name for business accounts.
3. The user shares those details with their employer or client.
4. Client sends a wire, ACH, or SEPA transfer — **it is auto-converted to USDC/USDT** and credited to the wallet (history shows "Bank deposit — auto-converted to USDC").

### Sending / withdrawing money

The user chooses a payout method and enters the recipient details:

| Method | Currency | Typical destination | Arrival |
|---|---|---|---|
| **M-Pesa** | KES | Kenya, Tanzania | < 1 minute |
| **MTN Mobile Money** | UGX / GHC / XAF | Uganda, Ghana, Cameroon | < 1 minute |
| **PIX** | BRL | Brazil | < 1 minute |
| **SEPA Transfer** | EUR | All EU/EEA countries | Same day – next day |
| **ACH / Bank Transfer** | USD | USA and international | 1–2 business days |
| **Crypto exchange** | USDC / USDT | Binance, Bybit, OKX, any Celo wallet — guided MiniPay-style flow with network safety checks | ~5 seconds |

All payouts are processed by **Noah Global Payouts** — no third-party wallet required. The user just enters a phone number (M-Pesa/MTN) or IBAN (SEPA) and hits confirm.

### Internal transfers
Users send USDC/USDT peer-to-peer within S-PAY by entering a recipient phone number — settled on-chain on Celo in ~5 seconds, free by default (admin-tunable).

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│  Web App (React + Vite)        → Deployed on Vercel     │
│  Mobile App (Expo / React Native) → EAS Build + OTA     │
├─────────────────────────────────────────────────────────┤
│  API Server (Express 5 + TypeScript) → Deployed on Render│
│  Database: PostgreSQL           → Render Postgres        │
│  ORM: Drizzle                                            │
├─────────────────────────────────────────────────────────┤
│  Wallets: 6 admin-switchable WaaS providers (Privy, CDP, │
│   Turnkey, Openfort, thirdweb, Dynamic) → USDC on Celo,  │
│   provisioned just-in-time at the first money action     │
│  KYC/KYB + Payouts:  Noah       (single integration)     │
│  Virtual Cards:  Stripe Issuing (admin master switch)    │
│  Auth: JWT 30d · Google (web+Android) · Apple (iOS)      │
│        (auth NEVER touches the wallet provider — $0 MAU) │
│  Type safety:    OpenAPI spec → orval → React Query hooks│
│  SEO: jobs sitemap + bot-routed server-rendered pages    │
└─────────────────────────────────────────────────────────┘
```

**Monorepo layout (pnpm workspaces):**
```
S-PAY/
├── artifacts/
│   ├── web/          React + Vite web app
│   ├── mobile/       Expo React Native app
│   └── api-server/   Express 5 API
└── lib/
    ├── db/           Drizzle schema + migrations
    ├── api-spec/     OpenAPI spec + orval codegen
    ├── api-client-react/  Generated React Query hooks
    └── api-zod/      Generated Zod validators
```

---

## Security

| Layer | How it's protected |
|---|---|
| **Passwords** | bcrypt (cost factor 12) — never stored in plain text |
| **Auth tokens** | Stateless JWT, signed with `JWT_SECRET` (HS256), 30-day expiry |
| **Transport** | TLS enforced by Render (API) and Vercel (web) — HTTP redirects to HTTPS |
| **Webhooks** | HMAC-SHA256 over the raw request body, constant-time compare; unsigned requests rejected once a secret is configured |
| **KYC** | Noah verifies government ID + selfie; all KYC docs stay on Noah's servers |
| **Celo wallet keys** | Provisioned via the active wallet provider (Privy / Coinbase CDP / Turnkey / Openfort / thirdweb / Dynamic) — private keys sealed in the provider's TEE or MPC infrastructure; S-PAY stores only the public address + the provider's wallet reference, never key material or seed phrases |
| **On-chain settlement** | USDC on Celo — auditable, 5s finality, sub-cent fees; no custom bridge or contract risk |
| **Database** | PostgreSQL on Render private network; `DATABASE_URL` never exposed to client |
| **Admin access** | Controlled by `ADMIN_EMAILS` env var — not a role in the DB |
| **CORS** | Locked to `CORS_ORIGIN` env var — only the web app can call the API |
| **No secrets in code** | All keys are environment variables; nothing sensitive is in the repository |

---

## Admin Panel

### Do I need a password?

**Yes.** You register with your own email and password at `/register` — that's a normal account with its own password that you choose. The `ADMIN_EMAILS` environment variable doesn't create an account or bypass any password — it only tells the system *which already-registered accounts* have admin rights.

### How to get admin access (step by step)

**Step 1 — Register your account first**

Go to `https://your-app.vercel.app/register` and sign up with:
- Your real email address (e.g. `you@gmail.com`)
- A strong password of your choice

This creates your user account in the database.

**Step 2 — Grant admin rights on Render**

1. Go to [render.com](https://render.com) → your API service → **Environment**
2. Find the `ADMIN_EMAILS` variable (or add it if it doesn't exist)
3. Set the value to your email:
   ```
   ADMIN_EMAILS=you@gmail.com
   ```
   Multiple admins: `ADMIN_EMAILS=you@gmail.com,colleague@gmail.com`
4. Click **Save Changes** → then click **Manual Deploy → Deploy latest commit**

**Step 3 — Access the admin panel**

Navigate to `https://your-app.vercel.app/admin` while logged in with that email. You'll see the full Admin Dashboard.

> **Important:** If you skip Step 1 and only set `ADMIN_EMAILS`, you won't be able to log in — there's no account yet. Always register first.

### What the admin panel shows

- **Dashboard** — Total users (incl. business count), 30-day actives, **Signups by Source** (jobs/landing/google/mobile/direct), KYC breakdown, transactions today, total volume
- **Users & KYC** — Full user list with account **Type** (Personal / Business · company name), country, acquisition source. KYC/KYB is webhook-driven via Noah — no manual review queue.
- **Transactions** — Every on-chain send, P2P transfer, and deposit credit, filterable by type
- **Job Listings** — Inject S-PAY/partner/sponsored roles: pinned to the top of the feed (SPAY badge), included in the SEO sitemap, live in ≤30s
- **Settings** — Integration status (env configured: DB/Noah/Stripe/Google/wallet providers) **plus the master switches**: 🛠 Maintenance Mode (+ user-facing message), 👛 Wallet Infrastructure (active WaaS — Privy/Coinbase CDP/Turnkey — with per-provider on/off, configured status, and wallet counts), 💳 Card Program (waitlist → live, with waitlist count), 💰 Fees & Revenue (withdrawal %, minimum, card fee, P2P fee — live repricing, provider costs shown so your margin is explicit)

---

## Setting Up a Test Account

### Option A — Register normally

1. Go to your deployed web app → `/register`
2. Sign up with any email (e.g. `testuser+1@gmail.com`)
3. This creates a real DB record with `kycStatus = "pending"`

### Option B — Promote yourself to admin

After registering, add your email to `ADMIN_EMAILS` on Render and redeploy — that makes you a **permanent superadmin (owner)**. From there you appoint everyone else in the panel: **Admin → Settings → Team & Roles** → enter a registered user's email → pick a role → Grant. Roles: **superadmin** (everything incl. switches and team management), **manager** (operations: users/KYC, transactions, job listings, enquiries, notifications), **support** (enquiries inbox + read-only). Revoked roles lose access immediately — no redeploy.

### Option C — Simulate KYC approval (for testing)

Since KYC is triggered by Noah webhooks, you can simulate approval by calling the webhook endpoint directly:

```bash
curl -X POST https://your-api.onrender.com/webhooks/noah \
  -H "Content-Type: application/json" \
  -d '{
    "event": "customer.kyc_approved",
    "customer_id": "YOUR_NOAH_CUSTOMER_ID"
  }'
```

Or if you know the user's `noahCustomerId` in the DB, update it directly via the Render PostgreSQL console:
```sql
UPDATE users SET kyc_status = 'approved' WHERE email = 'testuser@example.com';
```

### Option D — Use Noah sandbox

Noah provides a sandbox environment. Set `NOAH_API_KEY` to your sandbox key and use Noah's test identity documents. KYC will auto-approve in the sandbox.

---

## Environment Variables

Set these on **Render** (API server) and **Vercel** (web app):

### API Server (Render)

**Launch-critical (set these first):**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (auto-wired by the render.yaml Blueprint, or Supabase URI) |
| `JWT_SECRET` | ✅ | Random 64-char hex (auto-generated by the Blueprint) |
| `SESSION_SECRET` | ✅ | Random secret (auto-generated by the Blueprint) |
| `CORS_ORIGIN` | ✅ | Web app URL(s), comma-separated: `https://spayewallet.com,https://spay.vercel.app` |
| `ADMIN_EMAILS` | ✅ | Comma-separated admin emails — controls /admin access |

**Money rails (each unlocks a feature when set):**

Wallets need **one** of the three providers below configured (admin picks the active one in `/admin/settings` — see [`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md) for setup walkthroughs and pricing):

| Variable | Unlocks | Description |
|---|---|---|
| `PRIVY_APP_ID` + `PRIVY_APP_SECRET` | Celo wallets + USDC/USDT sends via **Privy** | From dashboard.privy.io → your app → API keys. Enable gas sponsorship for gasless sends. MAU-tier pricing |
| `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` + `CDP_WALLET_SECRET` | Celo wallets + sends via **Coinbase CDP** | From portal.cdp.coinbase.com → API Keys + Server Wallets → Wallet Secret. $0.005/operation, 5K free ops/month — no MAU billing |
| `TURNKEY_API_PUBLIC_KEY` + `TURNKEY_API_PRIVATE_KEY` + `TURNKEY_ORGANIZATION_ID` | Celo wallets + sends via **Turnkey** | From app.turnkey.com → API keys + organization id. Per-signature pricing — no MAU billing |
| `OPENFORT_API_KEY` + `OPENFORT_WALLET_SECRET` | Celo wallets + sends via **Openfort** | From dashboard.openfort.io (sk_ key) + `openfort wallet-keys create`. ~2,000 free ops/month — no MAU billing |
| `THIRDWEB_SECRET_KEY` | Celo wallets + sends via **thirdweb** | From thirdweb.com/dashboard → project secret key. Plan tiers (no free tier since 2026); queued sends — no MAU billing |
| `DYNAMIC_ENVIRONMENT_ID` + `DYNAMIC_API_TOKEN` + `DYNAMIC_WALLET_PASSWORD_SECRET` | Celo wallets + sends via **Dynamic** (TSS-MPC) | From app.dynamic.xyz + `openssl rand -hex 32` for the password secret (back it up like JWT_SECRET) |
| `NOAH_API_KEY` | KYC + virtual accounts + cash-outs | From the Noah partner dashboard |
| `NOAH_WEBHOOK_SECRET` | KYC auto-approval | From Noah webhook endpoint config (`/api/webhooks/noah`) |
| `STRIPE_SECRET_KEY` | Virtual cards (with the admin switch) | Stripe → Developers → API keys (Issuing enabled) |
| `STRIPE_WEBHOOK_SECRET` | Card transaction events | Stripe webhook endpoint config (`/api/webhooks/stripe`) |

**Sign-in providers (optional):**

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Transactional email via [resend.com](https://resend.com) — email confirmation + password reset. Unset = links are logged on Render instead of emailed |
| `EMAIL_FROM` | Sender identity, e.g. `S-PAY <noreply@spayewallet.com>` (verify the domain in Resend first; defaults to Resend's test sender) |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth (web flow) |
| `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` | Native Google sign-in token audiences (mobile) |
| `APPLE_BUNDLE_ID` | Sign in with Apple audience (defaults to `com.zawaditechnologies.spay`) |
| `FRONTEND_URL` | Vercel URL — Google OAuth redirect target |
| `API_BASE_URL` | Render API URL — Google OAuth callback base |

**Tuning (all optional, sensible defaults):**

| Variable | Default | Description |
|---|---|---|
| `CELO_RPC_URL` | `https://forno.celo.org` | Celo JSON-RPC for balance reads + broadcasting CDP/Turnkey sends |
| `CELO_CAIP2` | `eip155:42220` | Chain id for Privy sends (Celo mainnet) |
| `PRIVY_API_BASE` | `https://api.privy.io` | Privy API base |
| `TURNKEY_API_BASE` | `https://api.turnkey.com` | Turnkey API base |
| `DATABASE_SSL` | auto-detect | Force TLS on/off for Postgres (`true`/`false`) |
| `CARD_PROGRAM_ADDRESS_LINE1/CITY/STATE/POSTAL/COUNTRY` | S-PAY program address | Billing address used for Stripe Issuing cardholders |
| `REMOTIVE_AFFILIATE_URL` / `REMOTE_COM_AFFILIATE_URL` | public URLs | Jobs board affiliate links |
| `MIGRATIONS_DIR` | auto-detect | Override migrations folder path |

### Web App (Vercel)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Your Render API URL: `https://your-api.onrender.com` |

### Mobile App (EAS)

`EXPO_PUBLIC_API_URL` must point to your live Render API. There are two ways to set it:

**Option A — EAS Secret (recommended for production, set once in the dashboard)**

1. Go to [expo.dev](https://expo.dev) → your project → **Settings → Secrets**
2. Click **Add a new secret**
3. Name: `EXPO_PUBLIC_API_URL`
4. Value: `https://your-api.onrender.com`
5. Click **Save**. Every subsequent `eas build` will inject this automatically.

**Option B — `eas.json` env section (visible in repo, fine for non-sensitive values)**

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-api.onrender.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-api.onrender.com"
      }
    }
  }
}
```

> **Note:** `EXPO_PUBLIC_API_URL` is not sensitive (it's a public URL), so putting it in `eas.json` is fine. Use EAS Secrets for things like API keys that should never appear in the repo.

---

## Running Locally (full dev environment)

**Prerequisites:** Node.js 18+, pnpm 9+

```bash
# 1. Clone and install
git clone https://github.com/zawaditechnologiesllc/s-pay
cd s-pay
pnpm install

# 2. Set env vars
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# 3. Push DB schema
pnpm --filter @workspace/db run push

# 4. Start everything
pnpm --filter api-server run dev   # API on :3000
pnpm --filter web run dev          # Web on :5173
cd artifacts/mobile && npx expo start  # Mobile
```

---

## Testing the Mobile App WITHOUT Running Anything Locally

Since the codebase is on GitHub, there are two zero-setup options:

### Option 1 — EAS Build (Recommended — get a real APK/IPA, no local setup)

Expo builds the app in the cloud and gives you a direct download link. No terminal, no local tooling needed.

**One-time setup:**

1. Go to **[expo.dev](https://expo.dev)** → create a free account
2. Click **"Create new project"** → link your GitHub repo (`zawaditechnologiesllc/s-pay`) and set root directory to `artifacts/mobile`
3. Go to **Settings → Secrets** → Add secret:
   - Name: `EXPO_PUBLIC_API_URL`
   - Value: `https://your-api.onrender.com` *(your Render API URL)*

**Trigger a build:**

4. Go to **Builds → New Build** in the Expo dashboard
5. Select platform: **Android**, profile: **preview** (gives a downloadable `.apk` — no Play Store needed)
6. Wait 5–10 minutes → download the `.apk`
7. Send the `.apk` to your Android phone (via WhatsApp, email, Google Drive) → open it → tap Install

**For iPhone:**

8. Select platform: **iOS**, profile: **preview** → requires an Apple Developer account ($99/year) for TestFlight distribution. Without one, use Option 2 (Codespaces) instead.

`eas.json` in `artifacts/mobile/` should have at minimum:
```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    }
  }
}
```

### Option 2 — GitHub Codespaces (run in the cloud, scan QR on phone)

1. Go to your GitHub repo → click **Code → Codespaces → New codespace**
2. Wait for the Codespace to start, then run these commands **in order**:

```bash
# Step 1 — Install pnpm (the package manager this repo uses)
npm install -g pnpm

# Step 2 — Install ALL workspace dependencies from the repo root
#           (This is required — Codespaces does NOT auto-install deps)
cd /workspaces/S-PAY
pnpm install

# Step 3 — Start the mobile app with a public tunnel
cd artifacts/mobile
npx expo start --tunnel
```

3. A QR code appears in the terminal
4. On your phone, open the **Expo Go** app → scan the QR code
5. The S-PAY app opens on your phone instantly

> **Why `--tunnel`?** Codespaces runs in the cloud, not on your local network. The `--tunnel` flag routes traffic through Expo's servers so your phone can reach the Codespace over the internet.

> **Note:** Codespaces gives you 60 free core-hours/month on the free GitHub plan. The Codespace goes to sleep after 30 minutes of inactivity but your phone app keeps working until the tunnel closes.

**Common errors in Codespaces:**

| Error | Fix |
|---|---|
| `expo module is not installed` | You skipped `pnpm install` — run it from `/workspaces/S-PAY` |
| `command not found: pnpm` | Run `npm install -g pnpm` first |
| QR code appears but app won't load | Make sure you used `--tunnel` not just `npx expo start` |
| Port forwarding popup | Ignore it — `--tunnel` bypasses Codespaces port forwarding |

### Option 3 — Expo Web (instant browser preview, limited)

After running `pnpm install` from the repo root:
```bash
cd artifacts/mobile
npx expo start --web
```
Codespaces will offer to open a browser tab with the app running as a web page via React Native Web. Works for most screens (wallet, jobs, profile) but native features (camera, haptics, biometrics) won't work in the browser.

---

## Deployment

See the detailed deployment guide below. Summary:

| Service | What deploys there | How |
|---|---|---|
| **Render** | API server (Docker) + PostgreSQL | Auto-deploy from `main` branch |
| **Vercel** | Web app | Auto-deploy from `main` branch |
| **EAS** | Mobile app | Manual trigger from expo.dev or `eas build` CLI |

---

## Deployment Guide

### 1. Database (Render PostgreSQL) — no terminal needed

**Option A — Blueprint (recommended, fully automatic):**

1. Render dashboard → **New → Blueprint** → connect the `zawaditechnologiesllc/s-pay` repo
2. Render reads `render.yaml` and creates **both** the `spay-db` PostgreSQL database and the `spay-api` web service, with `DATABASE_URL` wired automatically
3. Fill in the env vars marked `sync: false` when prompted (at minimum `CORS_ORIGIN` and `ADMIN_EMAILS`) → click **Apply**
4. Done — the API applies all schema migrations automatically on boot (watch for "Database migrations applied" in the service Logs tab)

**Option B — Manual dashboard setup:**

1. Render dashboard → **New → PostgreSQL** → name it `spay-db`, pick the same region as the API → **Create Database**
2. Open the database page → **Connections** → copy the **Internal Database URL**
3. Go to your API service → **Environment** → add `DATABASE_URL` = the internal URL → **Save Changes**
4. Render redeploys the API; migrations run automatically on boot — no `drizzle-kit push`, no terminal

> **What "expires after 30 days" means:** Render's free PostgreSQL is a trial — 30 days after creation the database is **suspended, and ~14 days later it is deleted along with its data** unless you upgrade it to a paid plan (Basic 256MB, ~$7/mo). Render emails you before this happens. For production either upgrade the plan (Settings tab of `spay-db`) **or use Supabase below — its free tier never expires.**

**Option C — Supabase (free tier never expires):**

1. [supabase.com](https://supabase.com) → **New project** → pick a name, password, and region close to your Render region (e.g. `us-west-1` for Oregon)
2. In the project: **Connect** (top bar) → **Connection string → URI** → choose the **Session pooler** string (works on all networks) and copy it. It looks like
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres`
3. Replace `[YOUR-PASSWORD]` with your database password
4. Render → `spay-api` → **Environment** → set `DATABASE_URL` to that string → **Save Changes**
5. Render redeploys; migrations run automatically on boot — the schema creates itself in Supabase. (TLS is auto-detected for `*.supabase.com` URLs; set `DATABASE_SSL=true|false` to override.)
6. You can browse your data anytime in Supabase's **Table Editor** — no terminal needed

### 2. API Server (Render Web Service)

1. Render dashboard → **New → Web Service** → connect GitHub repo
2. **Root directory:** `artifacts/api-server`
3. **Build command:** `pnpm install && pnpm build`
4. **Start command:** `node dist/index.js`
5. **Environment:** Add all API server env vars listed above
6. Deploy — note the URL (`https://your-api.onrender.com`)

### 3. Web App (Vercel)

1. Vercel dashboard → **New Project** → import from GitHub
2. **Root directory:** `artifacts/web`
3. **Framework:** Vite
4. **Environment variable:** `VITE_API_URL=https://your-api.onrender.com`
5. Deploy — note the URL

### 4. Mobile App (EAS)

1. Install EAS CLI: `npm install -g eas-cli`
2. `eas login` (use your Expo account)
3. `cd artifacts/mobile && eas build --platform android --profile preview`
4. Download APK from the Expo dashboard
5. For production: `eas build --platform all --profile production` → submit to stores

### 5. Setting up the wallet provider (Privy / CDP / Turnkey / Openfort / thirdweb / Dynamic)

Wallets and on-chain sends activate when **one** provider's keys are set — the admin chooses which provider creates new wallets and can toggle each on/off live in `/admin/settings → Wallet Infrastructure`. Signups/logins never call the provider (that's deliberate — providers bill for active wallet users; S-PAY only provisions a wallet at the user's **first money action**, so free jobs-board traffic costs nothing).

Step-by-step setup for each provider, switching semantics, pricing comparison, and troubleshooting: **[`docs/WALLET-PROVIDERS.md`](./docs/WALLET-PROVIDERS.md)**. Quick version:

- **Privy:** dashboard.privy.io → API keys → set `PRIVY_APP_ID`, `PRIVY_APP_SECRET` on Render
- **Coinbase CDP:** portal.cdp.coinbase.com → API key + Wallet Secret → set `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`
- **Turnkey:** app.turnkey.com → API key pair + org id → set `TURNKEY_API_PUBLIC_KEY`, `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_ORGANIZATION_ID`
- **Openfort:** dashboard.openfort.io → sk_ key + wallet secret → set `OPENFORT_API_KEY`, `OPENFORT_WALLET_SECRET`
- **thirdweb:** thirdweb.com/dashboard → secret key → set `THIRDWEB_SECRET_KEY` (run a test send before making it active)
- **Dynamic:** app.dynamic.xyz → env id + API token → set `DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_API_TOKEN`, `DYNAMIC_WALLET_PASSWORD_SECRET`

> ⚠️ Existing wallets always keep the provider that created them (private keys can't move). Switching the active provider only affects new wallets — keep the old provider's env keys set while it still holds wallets.

### 6. Setting up Noah (KYC + Payouts)

1. Apply at [noah.com](https://noah.com) for a fintech partner account
2. Once approved → API Keys → copy your live key → set `NOAH_API_KEY` on Render
3. Noah dashboard → Webhooks → Add endpoint:
   - URL: `https://your-api.onrender.com/webhooks/noah`
   - Events: `customer.kyc_approved`, `customer.kyc_rejected`, `transfer.completed`, `transfer.failed`
4. Copy the signing secret → set `NOAH_WEBHOOK_SECRET` on Render

### 7. Setting up Google Sign-In (optional)

1. [console.cloud.google.com](https://console.cloud.google.com) → Create project → OAuth 2.0 Credentials
2. Authorized redirect URI: `https://your-api.onrender.com/auth/google/callback`
3. Copy **Client ID** and **Client Secret**
4. Set on Render: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `API_BASE_URL`

### 8. Updating the DB schema after changes

Schema migrations live in `lib/db/migrations/` and are **applied automatically every time the API boots** — deploying a new version is all it takes. To add a new migration after editing `lib/db/src/schema/`:

```bash
# Generates a new SQL file in lib/db/migrations/ (no DB connection needed)
cd lib/db && DATABASE_URL=postgres://x:x@localhost/x pnpm exec drizzle-kit generate
```

Commit the generated file and deploy — the server applies it on startup. (The legacy `pnpm --filter @workspace/db run push` still works for quick local prototyping.)

---

## Monitoring Everything Without a Terminal

| What you want to see | Where to look |
|---|---|
| **Code changes / commits** | GitHub → repo → **Commits** (or a branch/PR's **Files changed** tab) |
| **API deploy progress** | Render dashboard → `spay-api` → **Events** (deploy timeline) and **Logs** (live output) |
| **API is healthy** | Open `https://your-api.onrender.com/api/healthz` in a browser → `{"status":"ok"}` |
| **Jobs feed is live + count** | Open `https://your-api.onrender.com/api/jobs?limit=1` → check the `total` field (3,000–5,000) |
| **Database created / size / connections** | Render dashboard → `spay-db` → **Info** & **Metrics** tabs |
| **Run SQL without a terminal** | Render dashboard → `spay-db` → **Query** tab (built-in SQL console) |
| **Migrations applied** | Render → `spay-api` → **Logs** → look for `Database migrations applied` |
| **Web deploy progress** | Vercel dashboard → project → **Deployments** (each shows build logs + preview URL) |
| **Integration status (DB, wallet providers, Noah, Stripe, Google)** | Log in as admin → `/admin/settings` — green "Configured" / red "Not set" per service |
| **Wallet provider switches + per-provider wallet counts** | `/admin/settings` → Wallet Infrastructure (also `GET /api/admin/wallet-providers`) |
| **Users, KYC, transactions** | `/admin` dashboard, `/admin/users`, `/admin/transactions` |
| **Mobile builds** | expo.dev → project → **Builds** (progress, logs, APK download link) |

---

## Regenerating API Types After Spec Changes

If you edit `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates React Query hooks in `lib/api-client-react/` and Zod schemas in `lib/api-zod/`.

---

## Project History

| Year | Event |
|---|---|
| 2016 | Project conceived — engineers frustrated by PayPal blocking remote workers in Africa/SE Asia |
| 2018 | Early prototypes: cross-border payment rails + crypto settlement research |
| 2021 | Architecture refined: hybrid model using M-Pesa, MTN, ACH, SEPA rails |
| 2024 | **S-PAY launches** — Zawadi Technologies LLC incorporated in the USA |
| 2026 | Production launch — Celo wallets, jobs board live, virtual accounts & card rolling out |

---

## Contact

- Support: support@spayewallet.com
- Partnerships: partnerships@spayewallet.com
- Legal: legal@spayewallet.com
- Careers: careers@spayewallet.com

© 2026 S-PAY · Zawadi Technologies LLC · All rights reserved
