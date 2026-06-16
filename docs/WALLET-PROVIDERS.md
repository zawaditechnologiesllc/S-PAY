# S-PAY Wallet Providers — Setup, Switching & The Cost Strategy

> Everything about how S-PAY creates and operates Celo wallets: **why a wallet
> provider exists at all**, why signups/logins never touch one, how to set up
> each of the six supported providers step by step, and how the admin
> switches work. Companion to [`LAUNCH-CHECKLIST.md`](../LAUNCH-CHECKLIST.md)
> (ops master doc) and [`README.md`](../README.md) (product/deploy reference).

---

## 1. "Doesn't Celo make the wallets? Do we even need Privy?"

Short answer: **Celo is the road, not the car.** Celo is a blockchain network —
it doesn't create or hold wallets for anyone. A "wallet" is just a
public/private **keypair**: the public half becomes the `0x…` address (free
math, no fee, no signup), and whoever holds the **private key** controls the
money. Every USDC balance "on Celo" is really an entry in the USDC contract
that only the private key can move.

So the real question is: **who holds each user's private key?** There are only
three options, and S-PAY's product constraints decide between them:

| Key custody model | Who holds the key | Cost | Why S-PAY does / doesn't use it |
|---|---|---|---|
| **User's device** (MiniPay, MetaMask) | The user's phone/browser | Free | ❌ The server can't sign anything — every send, withdrawal, and future Noah payout debit would require the user's device online and tapping. Web + mobile parity breaks, lost phone = lost funds without backup flows. MiniPay can do this because Opera controls the whole client. |
| **S-PAY's own database** (self-custody of user keys) | Our Postgres, encrypted with a master key | Free | ❌ One leaked `DATABASE_URL` + master key drains **every user simultaneously**. We'd become a regulated custodian with a single point of catastrophic failure, carrying full security/compliance burden in-house. Not worth saving the WaaS fee at our stage. |
| **Wallet-as-a-Service (WaaS)** — Privy, Coinbase CDP, Turnkey, Openfort, thirdweb, Dynamic | Provider's TEE/HSM hardware; we call an API to sign | Paid | ✅ The server can execute money flows 24/7, S-PAY never touches key material (only public addresses are stored), and a breach of our DB exposes **zero** keys. |

**So yes — some signer infrastructure is required; "Celo" alone is not enough.**
What is *not* required is paying a WaaS **per monthly-active user**, which is
where Privy got expensive. S-PAY now fixes the cost problem two ways:

1. **Lazy (just-in-time) wallet provisioning** — the provider is only ever
   called when money actually moves (§3), so jobs-board traffic costs $0.
2. **Six interchangeable providers** (§4) — five of which don't bill by MAU
   at all — switchable live from `/admin/settings` (§5).

---

## 2. The cost model (why this architecture)

Provider pricing as of mid-2026 (re-verify on their pricing pages before
budgeting — these numbers move):

| Provider | Pricing model | Free tier — what you get | Paid pricing |
|---|---|---|---|
| **Privy** *(current default)* | Per monthly-active wallet user (MAU) | Free under **~500 MAUs** | **$299/mo** (Core, ≤2,500 MAUs), then usage-based beyond 10K MAUs |
| **Coinbase CDP** | Per wallet *operation* (create/sign/broadcast) | **First 5,000 operations/month free** | **$0.005 / operation** after — no MAU billing |
| **Turnkey** | Per *signature* | **25 free signatures/month** | PAYG **$0.10/signature**, or Pro **$99/mo** at ~$0.01/signature — no MAU billing |
| **Openfort** | Per *operation* (create/transaction) | **First 2,000 operations/month free** (up to 1,000 monthly-active wallets) | Usage-based after — no MAU billing |
| **thirdweb** | Plan tiers + usage | **No free tier** (since 2026-01-01) | Starter **~$9/mo**, Growth **$99/mo**; server wallets + queued Transactions API — no MAU billing |
| **Dynamic** | "Onchain Automation" operations | Free tier up to **1,000 MAUs** | Server-wallet operation rates **not public** — confirm with their sales before committing |

> **Which to pick for cost?** For a money app whose users transact occasionally,
> **per-operation** providers are by far the cheapest because idle/jobs-only users
> cost **$0**. Practical ranking by cost-at-scale: **Coinbase CDP** ($0.005/op,
> 5K free/mo) ≈ **Openfort** (2K free/mo) → **Turnkey** (per-signature) → **Privy**
> (MAU tiers — fine while you're under ~500 active wallets, expensive after).
> Switch the active provider anytime in `/admin/settings → Wallet Infrastructure`
> (existing wallets keep their original provider — see §5). **A cheaper WaaS — not
> SocialConnect — is the lever for cutting wallet costs** (see `docs/SOCIALCONNECT.md`).

The jobs board is S-PAY's acquisition funnel: thousands of people sign up just
to apply for jobs. Under the old "wallet at signup + backfill at login" flow,
**every one of them became a Privy MAU** even if they never touched a dollar.
With MAU-tier pricing, free acquisition traffic was directly inflating the
WaaS bill.

After this change:

- **Signups & logins** run entirely on S-PAY's own stack — Postgres
  (Supabase/Render) + bcrypt + JWT, plus Google/Apple token verification.
  **Zero wallet-provider calls. Zero WaaS MAUs.** The only per-user cost of a
  jobs signup is a database row.
- **Balance/dashboard reads** query the public Celo RPC (Forno) directly —
  keyless and free. Browsing the app never touches the provider either.
- **Only money actions** (send, deposit-address request, withdrawal) touch the
  provider — and only *those* users ever appear on a WaaS invoice.

> **Rule for future code (enforced by comments in `routes/auth.ts` and
> `lib/wallet-providers.ts`):** never import or call the wallet provider from
> auth or read paths. If a new feature needs a wallet, call
> `ensureUserWallet()` from the money action itself.

---

## 3. Just-in-time provisioning — what happens when

| Event | Wallet provider called? | What happens |
|---|---|---|
| Register (email/Google/Apple) | **No** | Account row created in Postgres. `celoWalletAddress` stays empty. |
| Login | **No** | JWT issued. Nothing else. |
| Open dashboard / check balance | **No** | If an address exists, balance is read keylessly from Forno; otherwise $0 is shown. |
| **Request a deposit address** (`POST /wallet/add-funds`) | **Yes — JIT** | First money action: wallet created via the *active* provider, address saved, deposit instructions returned. |
| **Send money** (`POST /wallet/send`) | **Yes — JIT** | Sender's wallet ensured; if the P2P recipient (by phone) has no wallet yet, **the recipient's wallet is JIT-provisioned too** so fresh signups can receive money. The send is then signed by the *sender's wallet's own* provider. |
| **Withdraw / cash-out** (`POST /banking/withdraw`) | **Yes — JIT** | Wallet ensured before quoting, so the Noah payout (task D2) has a wallet to debit. |
| KYC, jobs browsing, profile edits, card waitlist | **No** | Never wallet-related. |

Implementation lives in `artifacts/api-server/src/lib/wallet-providers.ts`:

- `ensureUserWallet(user)` — returns the user's wallet, creating one through
  the admin-selected **active provider** if missing. Race-safe (two
  simultaneous money actions can't double-assign; the column is claimed with a
  `WHERE celo_wallet_address IS NULL` guard). Returns `null` when no provider
  is configured/enabled → routes answer with their honest 503 ("activating
  soon"), and the action simply retries the provisioning next time.
- `getSendableProvider(key)` — the provider allowed to *sign* for an existing
  wallet right now (respects the admin kill switches).
- Each user row records `walletProvider` + the provider's wallet id
  (DB column `privy_wallet_id`, kept for historical compatibility), because **a
  wallet's key lives with the provider that created it, forever**.

User-visible effect: a brand-new user sees no `0x…` address on their profile
until their first money action — at which point it appears within ~2 seconds.
Deposits, balances, and history work exactly as before.

---

## 4. Setting up each provider (step by step)

You only need **one** provider configured to launch. Configure more than one
to A/B costs or to have a standby. All env vars go on **Render → `spay-api` →
Environment** (Save Changes redeploys automatically).

### 4a. Privy (current default — MAU pricing)

Why pick it: most mature embedded-wallet product, the integration S-PAY
launched with; gas sponsorship built in. Why not: MAU-tier pricing gets
expensive exactly when growth works.

1. Go to [dashboard.privy.io](https://dashboard.privy.io) → create (or open)
   your app.
2. **App settings → API keys** → copy the **App ID** and **App secret**.
3. Render env:
   ```
   PRIVY_APP_ID=<app id>
   PRIVY_APP_SECRET=<app secret>
   ```
4. Recommended: enable **gas sponsorship** in the Privy dashboard so sends are
   gasless for users; otherwise each wallet needs a dust of CELO for gas.
5. Optional tuning: `PRIVY_API_BASE` (defaults to `https://api.privy.io`),
   `CELO_CAIP2` (defaults to `eip155:42220`, Celo mainnet).

How S-PAY uses it: `POST /v1/wallets` to create; sends via the server-wallet
RPC `eth_sendTransaction` (Privy builds, signs in its TEE, and broadcasts).

### 4b. Coinbase CDP — Server Wallets v2 (cheapest at scale, no MAU billing)

Why pick it: $0.005 per wallet operation with 5,000 free ops/month — a money
user costs ~a cent, an idle user costs nothing; backed by Coinbase's TEE
infrastructure. Why not: requires a Coinbase developer account; Celo isn't one
of CDP's managed networks, so S-PAY signs via CDP and broadcasts to Celo
itself (already wired — nothing for you to do).

1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → create a
   project.
2. **API Keys** → Create API key (a "Secret API key") → copy the **Key ID**
   and **Key Secret**.
3. **Server Wallets → Wallet Secret** → generate the **Wallet Secret** (this
   authorizes signing; CDP shows it once — store it safely).
4. Render env:
   ```
   CDP_API_KEY_ID=<key id>
   CDP_API_KEY_SECRET=<key secret>
   CDP_WALLET_SECRET=<wallet secret>
   ```
5. `/admin/settings` → Wallet Infrastructure → CDP shows **Configured** →
   press **Make active** when you want new wallets created there.

How S-PAY uses it: `cdp.evm.getOrCreateAccount({ name: <user id> })`
(idempotent — retries can't duplicate wallets); sends are signed by CDP and
broadcast through the public Celo RPC (`CELO_RPC_URL`). Gas is paid in CELO
from the wallet, so either dust new CDP wallets with CELO or fund gas
operationally (CDP's gasless options don't cover Celo).

### 4c. Turnkey (non-custodial TEE, per-signature pricing)

Why pick it: closest security model to Privy (keys sealed in TEEs, S-PAY
policy-controlled), priced per signature instead of per user — 25 free
signatures/month, then $0.10 (PAYG) down to ~$0.01 (Pro). Why not: lowest-level
API of the three; the free tier is small, so expect the Pro plan once sends
ramp.

1. Go to [app.turnkey.com](https://app.turnkey.com) → create an organization.
2. Note your **Organization ID** (visible in the dashboard URL / org settings).
3. Create an **API key pair** (dashboard → API keys → Create, or the `turnkey`
   CLI) → copy the **public key** and **private key** hex strings.
4. Render env:
   ```
   TURNKEY_API_PUBLIC_KEY=<public key hex>
   TURNKEY_API_PRIVATE_KEY=<private key hex>
   TURNKEY_ORGANIZATION_ID=<organization id>
   ```
   Optional: `TURNKEY_API_BASE` (defaults to `https://api.turnkey.com`).
5. `/admin/settings` → Wallet Infrastructure → Turnkey shows **Configured** →
   **Make active** when ready.

How S-PAY uses it: `createWallet` with the standard Ethereum derivation
(`m/44'/60'/0'/0/0`); sends are signed by Turnkey (viem signer) and broadcast
through the public Celo RPC. Same gas note as CDP: wallets pay gas in CELO.

### 4d. Openfort (backend wallets, per-operation pricing)

Why pick it: same shape as CDP (TEE-held EOA keys, chain-agnostic signing,
we broadcast to Celo ourselves), generous free tier (~2,000 operations/month).
Why not: younger product, SDK still 0.x, and a second credential to manage.

1. Go to [dashboard.openfort.io](https://dashboard.openfort.io) → create a
   project → **API keys** → copy the **secret key** (`sk_test_…`/`sk_live_…`).
2. Create a **wallet secret**: install their CLI and run
   `openfort wallet-keys create` (registers an ECDSA keypair that authorizes
   signing — Openfort's equivalent of CDP's Wallet Secret). Store it safely.
3. Render env:
   ```
   OPENFORT_API_KEY=<sk_... secret key>
   OPENFORT_WALLET_SECRET=<wallet secret>
   ```
4. `/admin/settings` → Wallet Infrastructure → Openfort shows **Configured** →
   **Make active** when ready.

How S-PAY uses it: `accounts.evm.backend.create({ idempotencyKey: <user id> })`
(retry-safe); sends are signed in Openfort's TEE via a viem signer and
broadcast through the public Celo RPC. Wallets pay gas in CELO (dust them, or
keep Openfort for users you fund operationally).

### 4e. thirdweb (server wallets in Vault, plan-tier pricing)

Why pick it: one secret key is the whole integration; wallets live in
thirdweb's Vault (TEE) and creation is idempotent per user. Why not: **no free
tier since Jan 2026** (Starter ~$9/mo), and sends go through their queued
Transactions API — S-PAY polls a few seconds for the on-chain hash.

1. Go to [thirdweb.com/dashboard](https://thirdweb.com/dashboard) → create a
   project → **Settings → API keys** → copy the **secret key**.
2. Render env:
   ```
   THIRDWEB_SECRET_KEY=<secret key>
   ```
3. `/admin/settings` → Wallet Infrastructure → thirdweb shows **Configured**.
4. ⚠️ **Before making it active, run one small test send.** Each thirdweb
   server wallet has both a plain EOA address (what S-PAY stores and shows for
   deposits) and a smart-account address. S-PAY pins EOA execution on sends
   (falling back to thirdweb's default if their API rejects the option) — the
   test send proves the debit comes from the same address deposits land on.
   Send a few USDC to a test user's address, send it back out, check the
   balance went to zero.

How S-PAY uses it: `POST /v1/wallets/server { identifier: spay-<user id> }`
(idempotent); sends via `POST /v1/wallets/send` on chain 42220, then polls
`GET /v1/transactions/{id}` (up to 60s) for the transaction hash.

### 4f. Dynamic (TSS-MPC server wallets)

Why pick it: MPC threshold signing (no single TEE holds the whole key),
viem-native, chain-agnostic. Why not: the **most operationally complex** of
the six — S-PAY's server is an MPC *participant* (native signer binary), their
server-wallet pricing isn't public, and the SDK had breaking changes days
before this integration. Treat it as the experimental option.

1. Go to [app.dynamic.xyz](https://app.dynamic.xyz) → create a project → copy
   the **Environment ID** → **Developers → API tokens** → create an **API
   token**.
2. Generate a strong random secret for share-backup passwords:
   `openssl rand -hex 32`.
3. Render env:
   ```
   DYNAMIC_ENVIRONMENT_ID=<environment id>
   DYNAMIC_API_TOKEN=<api token>
   DYNAMIC_WALLET_PASSWORD_SECRET=<random 64-char hex>
   ```
4. `/admin/settings` → Wallet Infrastructure → Dynamic shows **Configured** →
   **Make active** only after a test send (same drill as thirdweb).

How S-PAY uses it: `createWalletAccount` (2-of-2 TSS) with the MPC key shares
**backed up to Dynamic**, protected by a per-wallet password derived as
HMAC-SHA256(`DYNAMIC_WALLET_PASSWORD_SECRET`, user id) — so the database still
stores no key material, only the wallet *metadata* JSON (in the wallet-id
column). Sends run the MPC protocol via Dynamic's native signer and broadcast
to Celo through viem.

⚠️ Two Dynamic-specific warnings:
- **`DYNAMIC_WALLET_PASSWORD_SECRET` is as important as a key.** If it is lost
  or changed, existing Dynamic wallets can't sign until recovered through
  Dynamic's own export/recovery tooling. Back it up like you back up
  `JWT_SECRET`.
- **Deployment constraint (already handled in this repo):** Dynamic's MPC
  signer is a native glibc binary that can't be bundled — the Dockerfile uses
  `node:20-slim` and installs `@dynamic-labs-wallet/node-evm` +
  `@dynamic-labs-wallet/node` into the production image. If you ever slim the
  image or change the base, keep those two facts.

---

## 5. The admin switches — exact semantics

`/admin/settings` → **Wallet Infrastructure (Celo · WaaS)**. Stored in the
`app_settings` table (`wallet_providers` key), cached 15s — changes are live
within 15 seconds, no deploy. API: `GET/PUT /api/admin/wallet-providers`.

| Control | What it does | What it does NOT do |
|---|---|---|
| **Make active** (one provider at a time) | New wallets — i.e. users doing their *first* money action — are created with this provider. | Does **not** move existing wallets. A wallet's private key stays with the provider that created it, forever. |
| **On/Off toggle** (per provider) | OFF is a kill switch: the provider creates no new wallets **and signs no sends** for the wallets it holds (users see "transfers briefly paused"). | Does **not** freeze funds. Balances, deposits, and history are on-chain and keep working; flip the toggle back ON and sends resume. |
| **Configured chip** | Read-only: whether the provider's env vars are set on Render. | A provider can be ON but unconfigured — it just can't do anything until its keys are set. |

Practical playbooks:

- **"Privy is too expensive, move to CDP":** configure CDP (§4b) → Make active.
  From that moment new transacting users are CDP wallets (≈$0.005/op). Existing
  Privy wallets keep signing through Privy — keep `PRIVY_APP_*` set and Privy
  ON. Your Privy MAU count now only includes *pre-existing* wallet users who
  still transact, and it shrinks as activity shifts.
- **"Provider X is having an incident / leaked key scare":** toggle X OFF.
  Sends signed by X pause with a friendly message; everything else keeps
  running. Re-enable when resolved.
- **"Decommission a provider completely":** only safe once it holds zero
  wallets (the panel shows per-provider wallet counts). Otherwise its users'
  sends break permanently — funds would then only be recoverable through that
  provider's own export/recovery tooling.
- **Want to fully migrate old wallets anyway?** That's an on-chain money
  movement (create new wallet at the new provider, transfer each balance,
  update the user row) — deliberate, fee-incurring, and not built today. Ask
  for it as a feature if Privy's residual bill ever justifies it.

> ⚠️ **Never delete a provider's env keys while it still holds wallets** —
> the panel's wallet counts tell you. OFF stops the bills growing; the keys
> staying set is what lets those users still send.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| User reports "Transfers are activating soon" | No provider is active+configured+enabled, or their legacy wallet row has an address but no wallet id | Check `/admin/settings` → Wallet Infrastructure: active provider must show **Configured** and be ON |
| User reports "transfers briefly paused" | The provider that holds *that user's* wallet is toggled OFF (or its env keys were removed) | Toggle it back ON / restore its env vars |
| New user never gets an address | They haven't done a money action yet — **this is by design** (and what keeps the WaaS bill low) | Have them request a deposit address or make a send |
| Send fails with a gas error (CDP/Turnkey wallets) | Wallet has no CELO for gas | Dust the wallet with CELO, or use Privy with gas sponsorship for those users |
| Admin panel shows wallets under "privy" you don't recognize | Wallets created before multi-provider support are recorded as Privy (migration 0009 backfilled them) | Expected — they are Privy wallets |
| Provisioning errors in Render logs (`Wallet provisioning failed`) | Provider API down / wrong credentials | The money action that triggered it just retries provisioning on its next attempt — fix credentials and it self-heals |
| thirdweb send returns "still pending after 60s" | Their Transactions API queue is slow/stuck | The transfer may still confirm — check the wallet on celoscan.io before retrying, or thirdweb's dashboard → Transactions |
| Dynamic sends fail with share/password errors | `DYNAMIC_WALLET_PASSWORD_SECRET` changed since the wallet was created | Restore the original secret (it derives each wallet's share-backup password) — see §4f |

---

## 7. FAQ

**Where do fiat deposits fit?** Noah converts incoming wires/SEPA to USDC and
settles on-chain to the user's address. That needs the *address* (free, stored
in our DB), not a signature — so deposits don't touch the WaaS either.

**Why does the DB column for the wallet id still say `privy_wallet_id`?**
Renaming a column on a live money system is risk with no user benefit. The
Drizzle schema maps it to `walletId` in code, and `wallet_provider` says whose
id it is.

**Does switching providers change the user experience?** No. Addresses look
identical (standard EVM), balances are read the same way, and sends go through
the same endpoint. Only the signing backend differs.

**Could we ever drop the WaaS entirely?** Two futures: (a) client-held keys
(MiniPay model) — big client rewrite, changes the product's trust story; (b)
self-custody of encrypted keys in our DB — cheaper but concentrates
catastrophic risk on us (§1). Revisit when transaction volume makes WaaS fees
material; at current pricing, CDP at $0.005/operation is cheaper than the
engineering + audit cost of either alternative for a long time.
