# S-PAY Payment Flows

This document explains how money actually moves through S-PAY. It is written to
match the code — if you find a discrepancy, the code (`artifacts/api-server/src`)
wins and this doc is the bug.

> **The one thing to remember — there is ONE balance.**
> A user's spendable balance is the **USDC (or USDT) held in their own Celo
> wallet**, read live from the chain on every request
> (`lib/celo-chain.ts → getTokenBalances`). There is no second "virtual-account
> balance" and no internal "S-PAY wallet balance" to reconcile. Every flow below
> is just a different **on-ramp into that one wallet**; every cash-out is the
> same **off-ramp out of it**. The `transactions` table is **history**, not a
> balance — a row only ever represents money that actually moved on-chain.

This is the MiniPay model: stablecoins on Celo are the account; fiat rails sit at
the edges to get money in and out.

---

## The two ledgers you should NOT confuse

| | What it is | Source of truth for |
|---|---|---|
| **On-chain USDC balance** | Real USDC/USDT in the user's Celo wallet | The user's spendable balance (the ONE balance) |
| **`transactions` table** | A history log of movements | "What happened" — never a spendable balance |
| **`employers.balance_usdc`** | An employer's prepaid float (accounting ledger) | How much payroll an employer may still send; backed by real USDC in their funding wallet |

The employer ledger is the only internal balance, and it exists solely to
**reserve** funds atomically across concurrent batches. Every debit of it is
matched by a **real on-chain USDC transfer** to the worker (see Flow 1).

---

## Plain-English summary (the three on-ramps)

1. **Payroll → workers.** A company funds its S-PAY funding wallet with USDC,
   then submits a batch. For each worker S-PAY reserves the cost on the employer
   ledger and **sends real USDC on-chain** from the funding wallet to the
   worker's Celo wallet. The worker later cashes out to M-Pesa / PIX / SEPA via
   the payout-providers layer. *Business-account-only (KYB-gated).*

2. **Direct Celo transfer.** Anyone sends USDC straight to the worker's Celo
   address (P2P inside S-PAY, an employer, an exchange withdrawal, a friend).
   It lands in the one wallet. From there, cash-out is identical to everyone
   else's.

3. **Virtual account (USD/EUR).** The worker shares a virtual **US ACH number /
   EU IBAN**. A US/EU payer sends a normal domestic transfer — they never touch
   "crypto." The money-rail provider auto-converts the fiat to USDC and settles
   it on-chain to the worker's own Celo wallet. From there, identical to the
   others.

All three converge on the same wallet. **The identifier (phone / email / S-PAY
ID / Celo address) is just how a worker is addressed; the virtual account is just
how fiat gets in. Neither is a separate balance.**

---

## Flow 1: Payroll (Employer → Workers)

**Use case:** Companies, marketplaces and platforms paying workers globally.
**Account requirement:** Business account only (live payroll is KYB-gated;
personal accounts are pointed to the business-account upgrade).

```
Employer registers (business account) on S-PAY
     ↓
Employer requests a funding address → S-PAY provisions the owner's Celo wallet
     ↓
Employer funds it by sending USDC on Celo  (sandbox: mint test balance instead)
     ↓
Employer submits a batch (API or dashboard)
     ↓
processBatch(), per worker  (lib/payroll-processor.ts):
     1. Resolve / auto-create the worker (by email / phone / S-PAY id / address)
     2. RESERVE: guarded debit of employers.balance_usdc (>= cost, atomic)
     3. SETTLE ON-CHAIN: send `amount` USDC from the funding wallet → worker's
        Celo wallet, signed by the employer wallet's WaaS provider
        • success → record a "receive" transaction with the on-chain tx hash,
                    mark the payment completed, notify the worker
        • send fails → REFUND the reservation, mark the payment failed (honest);
                       the worker is never shown money the chain can't back
     4. Best-effort: sweep the S-PAY fee (USDC) to TREASURY_CELO_ADDRESS
     ↓
Worker now holds USDC in their wallet (the one balance)
     ↓
Worker cashes out locally → see "Off-ramp" below
```

**No on-chain rail configured?** If no wallet provider keys are set, S-PAY
**cannot** move USDC, so live payroll payments are marked **failed** with an
honest reason and the employer is **not** charged. We do not write a fake
"received" row. (Sandbox batches are unaffected — they are ledger-only TEST
credits, clearly labelled, that never touch the chain.)

### Guarantees
- **Atomic reservation:** the guarded `UPDATE … WHERE balance_usdc >= cost`
  means two concurrent batches can never overdraw the employer.
- **No fake settlement:** a payment is `completed` only with a real on-chain tx
  hash; otherwise it is `failed` and refunded.
- **Idempotent:** a payment already in a terminal state is skipped on re-run;
  batch creation is idempotent via `idempotencyKey`.
- **Auto-onboarding:** unknown workers are auto-created and invited to claim.

### Fees (this is S-PAY revenue — see `docs/REVENUE-MODEL.md`)
- **Payroll fee:** `payrollFee(amount)` (see `lib/payroll.ts`), charged on top of
  each payment and reserved alongside it.
- **Collected on-chain:** swept from the funding wallet to
  `TREASURY_CELO_ADDRESS`. Without a treasury address the fee stays in the
  funding wallet for later reconciliation (logged, never silently lost).

---

## Flow 2: Direct Celo Transfer + Withdraw

**Use case:** Freelancers receiving from clients; peers paying each other.

```
USDC arrives at the worker's Celo address, from any of:
     ├─ Another S-PAY user (P2P send — POST /wallet/send, PIN-gated, fee on top)
     ├─ An employer (Flow 1)
     ├─ An exchange withdrawal (Binance / Coinbase / any Celo-supporting venue)
     └─ Any other Celo wallet
     ↓
It is in the one wallet immediately (balance is a live chain read)
     ↓
Worker withdraws via the app → see "Off-ramp" below
```

P2P sends are signed by the sender's WaaS provider; a transfer commission
(`transferFee`, flat + %) is charged on top and swept to `TREASURY_CELO_ADDRESS`
when one is configured (free until then).

---

## Flow 3: Virtual Account (USD/EUR) Receive + Withdraw

**Use case:** Remote workers who want to be paid by a US/EU client as if they
were local — the payer never sees crypto.

```
Worker (after KYC/KYB) is issued a virtual account by a money-rail provider:
     ├─ US: ACH routing + account number
     └─ EU: IBAN
     ↓
Worker shares it with their US/EU client
     ↓
Client sends a normal ACH / SEPA / wire transfer
     ↓
The provider auto-converts the fiat to USDC and SETTLES IT ON-CHAIN to the
worker's OWN Celo wallet (the single balance)
     ↓
Provider fires a webhook (e.g. payment.received) → S-PAY records the matching
"receive" history row (with the settlement tx hash when supplied)
     ↓
Worker withdraws via the app → see "Off-ramp" below
```

The virtual account is an **entry point, not a balance**. `GET /banking/accounts`
lists account details to receive into; it never reports a separate balance.

**Provider-neutral, USD/EUR only:** S-PAY issues **USD ACH / EU IBAN** virtual
accounts (we don't offer local-currency accounts). Issuer-capable rails:
**Bridge** (USD + EUR, no onboarding fee — the default), **Noah** (USD + EUR),
and **Conduit** (USD only). The admin designates one (`virtualAccountIssuer`);
it's sticky per user, and a currency the designated issuer can't serve routes
to the next capable rail automatically. Yellow Card and Thunes are payout
rails and can't issue accounts — the admin selector lists them disabled with
that reason. The deposit on-ramp itself is routed per-transaction by
`selectDepositProvider()` (see "On-ramp routing"), so S-PAY is never locked to
Noah for deposits.

**KYC is provider-agnostic too:** most partners (Noah, Bridge, Conduit, Yellow
Card) run their own hosted KYC/KYB — S-PAY routes the user to the admin-selected
`kycProvider`'s flow (`selectKycProvider`) and the result webhooks back to set
`kycStatus`. Thunes is a payout network and leaves KYC to the partner.

**…and the data stays in S-PAY's system.** Every attempt started via
`POST /kyc/start` is recorded in `kyc_verifications` (provider, the provider's
customer id, the hosted-flow URL, and later the decision payload from the
webhook). This gives us:

- `GET /kyc/status` — the user's gate (`kycStatus`) plus the latest attempt,
  with a **resume URL** while the hosted flow is in flight (the profile page
  shows "Resume verification" instead of restarting).
- `GET /admin/kyc/verifications` — the audit trail in the admin panel
  (Users page): who verified with which provider, and the outcome.
- Webhook landing places: `/webhooks/noah` (Noah KYC/KYB events) and the
  generic `/webhooks/kyc/:provider` for Bridge / Conduit / Yellow Card
  (HMAC-verified with `<PROVIDER>_WEBHOOK_SECRET`); both update the trail and
  flip `users.kycStatus`.

---

## Off-ramp (the cash-out, shared by all flows)

```
Worker taps "Withdraw to M-Pesa / PIX / SEPA / bank"  (POST /banking/withdraw)
     ↓
PIN check (second factor on every money-out action)
     ↓
selectPayoutProvider(targetCurrency, method)  →  best enabled+configured rail
     ├─ Noah | Bridge | Conduit | Yellow Card | Thunes
     └─ none can serve the corridor → honest 503, funds untouched
     ↓
On-chain balance check (the cash-out debits the user's own USDC)
     ↓
provider.createPayout(...)  — a provider without live keys throws its
NotConfiguredError → the same honest 503; nothing is recorded, nothing moves
     ↓
A "withdraw" row lands in the transactions table (status from the provider:
pending → completed via webhook) and the user is notified. Execution is live
the moment a payout provider's keys are set.
```

Quotes for comparison across every eligible provider:
`quotesForCorridor(targetCurrency, method, amountUsd)`.

---

## On-ramp routing (deposits are NOT Noah-only)

`selectDepositProvider(sourceCurrency, method)` mirrors payout routing for the
**deposit** side, so a top-up can route to the cheapest rail that serves the
corridor instead of always Noah:

- **M-Pesa / MoMo (KES, GHS, …):** Yellow Card (strong African on-ramp).
- **USD / EUR (ACH, SEPA, card):** Bridge (USD/EUR virtual accounts).
- **LatAm (BRL/MXN/COP), Asia (PHP/IDR/INR):** Conduit.
- **Anywhere Noah is cheapest / the only option:** Noah.

This is why the deposit abstraction exists: **Noah charges an onboarding/setup
fee, so we avoid it for corridors a usage-priced rail already covers.** Compare
deposit quotes with `depositQuotesForCorridor()`.

`POST /banking/deposit` provisions the user's wallet (so USDC has somewhere to
land) and asks the selected provider to start the collection. No provider
configured for the corridor → honest 503.

---

## Provider routing rule (one rule, both directions)

```
candidates = providers that are admin-ENABLED + configured + support(corridor)
if none: null → caller returns an honest 503 (never a faked movement)
else: pick the candidate with the BEST RATE FOR THE CUSTOMER
      (max  rate × (1 − feePercent));  ties broken by the admin's preferred provider
```

- Off-ramp evaluates `supports()` + `quote()`; on-ramp evaluates
  `supportsDeposit()` + `quoteDeposit()`.
- **The provider is never shown to the user.** Deposit and withdrawal responses
  expose only the rate/fee/ETA/amount — the chosen rail is an internal routing
  decision (logged for reconciliation, returned to no one). This is deliberate:
  the user should never have to understand or choose between Noah/Bridge/etc.
- **The admin only turns providers on/off** (and sets a tiebreaker) from
  `/admin/settings` → Payout Providers, live with no redeploy. A single switch
  governs **both** a provider's deposits and its payouts.

### Virtual accounts are the one exception (sticky single issuer)

A virtual account (US ACH / EU IBAN) is a **persistent identifier a worker shares
with employers**, so it cannot be re-routed per transaction the way a deposit or
withdrawal can. Rule:

- A worker's virtual account is issued **once**, by one enabled provider, and
  **stays with that provider** (stored on the user) so the account number never
  changes underneath them.
- It is presented **generically** — "Your USD account" / "Your EUR account" —
  never branded "Noah account" or "Bridge account," so switching the issuer for
  *new* users never confuses *existing* ones.
- Which provider issues *new* virtual accounts follows the same enabled-set you
  control in admin; existing accounts are untouched (exactly like wallet
  providers: keys/accounts never move once created).

*(Virtual-account provisioning itself is task D4 — gated on a provider key. The
sticky-issuer rule above is the contract D4 implements.)*

---

## Current status (what executes today vs. what's gated)

| Capability | Status |
|---|---|
| On-chain balance reads (one balance) | ✅ Live (keyless RPC) |
| P2P send (Flow 2) | ✅ Live once any wallet provider's keys are set |
| Payroll on-chain settlement (Flow 1) | ✅ Code complete; executes once a wallet provider is configured; honest-fail otherwise |
| Withdraw / cash-out (off-ramp) | ⚙️ Quotes + routing live; execution (D2) starts when a payout provider key is set |
| Deposit / top-up (on-ramp, all providers) | ⚙️ Routing live; execution starts when a deposit provider key is set |
| Virtual accounts (USD ACH / EU IBAN) | ⚙️ Provisioning (D4) pending a provider key; `GET /banking/accounts` returns an honest empty state until then |

"Honest 503 / never fake" is the rule everywhere: if a rail isn't configured,
the endpoint says so and no money moves.

---

## Error scenarios (real behavior)

### Payroll
| Scenario | Behavior |
|---|---|
| Employer balance < batch cost | Submit rejected (`402`) before processing; nothing moves |
| No wallet provider configured (live) | Each payment fails honestly; employer not charged |
| On-chain send fails mid-batch | Reservation refunded for that payment; payment marked failed; other payments continue |
| Unknown worker | Auto-created + invited (if `autoCreateWorkers`); else payment fails |

### Withdraw
| Scenario | Behavior |
|---|---|
| No payout provider for the corridor | Honest `503`; funds untouched |
| PIN missing / wrong / locked | `428 / 401 / 423`; no money moves |
| Insufficient on-chain balance | Rejected before any send |
