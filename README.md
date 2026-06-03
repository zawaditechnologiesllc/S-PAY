# S-PAY — Digital Money Super App for Remote Workers

**Built by Zawadi Technologies LLC**

S-PAY was born in 2016 by a team of full-stack fintech and crypto engineers frustrated by PayPal blocking legitimate remote worker accounts across Africa and Southeast Asia. The goal: give every remote worker a real US bank account, instant local cash-outs, and the financial tools they deserve — with no gatekeeper.

---

## What S-PAY Does

| Feature | What it gives the user |
|---|---|
| **Digital Wallet** | Hold USD balance, send/receive money globally |
| **Virtual Bank Account** | Real US ACH routing number + European IBAN — get paid like a local business |
| **Global Payouts** | Withdraw to M-Pesa, MTN MoMo, PIX, SEPA, bank transfers in 180+ countries |
| **Remote Jobs Board** | Thousands of remote-only roles aggregated from 6+ sources, free for all users |
| **Virtual Card** *(coming soon)* | Visa/Mastercard virtual card for online purchases |
| **KYC / Identity Verification** | Automated via Noah — no manual review, no waiting |

---

## How Payments Work

### Receiving money
1. User signs up and completes KYC (Noah verifies identity automatically).
2. S-PAY provisions a **virtual US bank account** (ACH routing + account number) and an **EU IBAN** via Noah.
3. The user shares those account details with their employer or client.
4. Client sends a wire, ACH, or SEPA transfer — it arrives in the user's S-PAY wallet as **Digital Dollars**.

### Sending / withdrawing money

The user chooses a payout method and enters the recipient details:

| Method | Currency | Typical destination | Arrival |
|---|---|---|---|
| **M-Pesa** | KES | Kenya, Tanzania | < 1 minute |
| **MTN Mobile Money** | UGX / GHC / XAF | Uganda, Ghana, Cameroon | < 1 minute |
| **PIX** | BRL | Brazil | < 1 minute |
| **SEPA Transfer** | EUR | All EU/EEA countries | Same day – next day |
| **ACH / Bank Transfer** | USD | USA and international | 1–2 business days |

All payouts are processed by **Noah Global Payouts** — no third-party wallet required. The user just enters a phone number (M-Pesa/MTN) or IBAN (SEPA) and hits confirm.

### Internal transfers
Users can also send Digital Dollars peer-to-peer within S-PAY by entering a recipient phone number.

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
│  KYC + Payouts:  Noah           (single integration)     │
│  Virtual Cards:  Stripe Issuing (coming soon)            │
│  Auth:           JWT (30-day) + Google OAuth             │
│  Type safety:    OpenAPI spec → orval → React Query hooks│
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
| **Webhooks** | HMAC-SHA256 signature verification on every Noah and Stripe webhook |
| **KYC** | Noah verifies government ID + selfie; all KYC docs stay on Noah's servers |
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

- **Dashboard** — Total users, KYC breakdown (pending/approved/rejected), transactions today, total volume
- **Users** — Full user list, searchable, filterable by KYC status. KYC is handled automatically by Noah webhooks — no manual approve/reject needed.
- **Transactions** — All transactions, filterable by type
- **Settings** — Which environment variables are configured (never shows the actual values, just whether they're set)

---

## Setting Up a Test Account

### Option A — Register normally

1. Go to your deployed web app → `/register`
2. Sign up with any email (e.g. `testuser+1@gmail.com`)
3. This creates a real DB record with `kycStatus = "pending"`

### Option B — Promote yourself to admin

After registering, add your email to `ADMIN_EMAILS` on Render and redeploy. No role change in the DB needed — admin access is purely env-var based.

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

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string from Render |
| `JWT_SECRET` | ✅ | Random 64-char hex: `openssl rand -hex 32` |
| `CORS_ORIGIN` | ✅ | Your Vercel web app URL, e.g. `https://spay.vercel.app` |
| `ADMIN_EMAILS` | ✅ | Comma-separated admin emails: `admin@spay.com,you@email.com` |
| `NOAH_API_KEY` | ✅ | From Noah partner dashboard — covers KYC + payouts |
| `NOAH_WEBHOOK_SECRET` | ✅ | From Noah webhook endpoint config |
| `GOOGLE_CLIENT_ID` | Optional | For Google Sign-In |
| `GOOGLE_CLIENT_SECRET` | Optional | For Google Sign-In |
| `FRONTEND_URL` | Optional | Your Vercel URL (needed for Google OAuth redirect) |
| `API_BASE_URL` | Optional | Your Render API URL (needed for Google OAuth redirect) |
| `STRIPE_SECRET_KEY` | Optional | For virtual card issuance (coming soon) |
| `STRIPE_WEBHOOK_SECRET` | Optional | For Stripe card events |

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
2. In the Codespace terminal:
   ```bash
   cd artifacts/mobile
   npx expo start --tunnel
   ```
3. A QR code appears — scan it with the **Expo Go** app on your phone
4. The app loads over the internet tunnel — no local network needed

> **Note:** Codespaces gives you 60 free hours/month on the free plan.

### Option 3 — Expo Web (instant browser preview, limited)

If the API is deployed, you can run the mobile app as a web page:
```bash
cd artifacts/mobile
npx expo start --web
```
This opens the app in a browser using React Native Web. Works for most screens (wallet, jobs, profile) but native features (camera, haptics) won't work.

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

### 1. Database (Render PostgreSQL)

1. Render dashboard → **New → PostgreSQL**
2. Copy the **External Database URL** (for migrations from your machine)
3. Copy the **Internal Database URL** (for the API server — faster, free bandwidth)
4. Run migrations from your local machine or Codespace:
   ```bash
   DATABASE_URL=<external-url> pnpm --filter @workspace/db run push
   ```

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

### 5. Setting up Noah (KYC + Payouts)

1. Apply at [noah.com](https://noah.com) for a fintech partner account
2. Once approved → API Keys → copy your live key → set `NOAH_API_KEY` on Render
3. Noah dashboard → Webhooks → Add endpoint:
   - URL: `https://your-api.onrender.com/webhooks/noah`
   - Events: `customer.kyc_approved`, `customer.kyc_rejected`, `transfer.completed`, `transfer.failed`
4. Copy the signing secret → set `NOAH_WEBHOOK_SECRET` on Render

### 6. Setting up Google Sign-In (optional)

1. [console.cloud.google.com](https://console.cloud.google.com) → Create project → OAuth 2.0 Credentials
2. Authorized redirect URI: `https://your-api.onrender.com/auth/google/callback`
3. Copy **Client ID** and **Client Secret**
4. Set on Render: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `API_BASE_URL`

### 7. Updating the DB schema after changes

```bash
# Run from the repo root after editing lib/db/src/schema/
DATABASE_URL=<your-render-external-url> pnpm --filter @workspace/db run push
```

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
| 2025 | 500K+ users · Virtual bank accounts live · S-PAY Card in beta |

---

## Contact

- Support: support@spayewallet.com
- Partnerships: partnerships@spayewallet.com
- Legal: legal@spayewallet.com
- Careers: careers@spayewallet.com

© 2026 S-PAY · Zawadi Technologies LLC · All rights reserved
