# S-PAY Payroll API — pay your workers through S-PAY

> How marketplaces (Upwork, Fiverr, Studypool…) and any company pay their
> workers through S-PAY. Companion to [`README.md`](../README.md),
> [`docs/PAYROLL-MARKETPLACES.md`](./PAYROLL-MARKETPLACES.md) (who we can
> integrate — go-to-market reference), [`docs/WALLET-PROVIDERS.md`](./WALLET-PROVIDERS.md)
> (how funds settle on Celo) and [`docs/SOCIALCONNECT.md`](./SOCIALCONNECT.md).

The payroll API turns S-PAY into a **payouts-as-a-service** layer. A company
registers once, funds a prepaid USDC balance, then submits **batches** of worker
payments over a single REST API. S-PAY resolves each worker (by email, phone,
S-PAY id or Celo address — auto-onboarding people it has never seen), credits
them, and fires signed webhooks back. Workers cash out through the normal S-PAY
withdraw flow (M-Pesa, MoMo, PIX, SEPA, bank transfer…).

**One integration serves every marketplace.** There is no per-company custom
code: the same endpoints, the same auth, the same webhooks. Differences between
companies are just data (which identifier they key workers on, batch size,
currency).

---

## 0. The mental model

```
  Marketplace backend                 S-PAY                         Worker
  ───────────────────                 ─────                         ──────
  POST /payroll/batches  ───────────▶ store batch (draft)
  POST /…/submit         ───────────▶ check balance, resolve,
                                       reserve employer ledger,
                                       SETTLE ON-CHAIN: USDC ─────────▶ worker's Celo wallet
                          ◀─────────── signed webhooks                  + notification
                                                                        cash out via
                                                                        withdraw flow
```

- **Employer** — the company. Owned by a regular S-PAY user account (the person
  who registers it and signs in to the dashboard).
- **Prepaid balance** — payroll is drawn from a USDC balance the employer funds
  first (real USDC in their Celo funding wallet). Honest by construction:
  **live** payments settle as a **real on-chain USDC transfer** to the worker's
  Celo wallet, and a payment is only marked paid once it has a tx hash; if no
  wallet provider is configured the payment fails and the employer isn't charged.
  **Sandbox** payments move ledger rows only (clearly-labelled TEST credits), so
  you integrate end-to-end without touching real funds.
- **Sandbox vs live** — every API key is either `test` or `live`. Test keys move
  only **sandbox** balance (minted freely), so you integrate end-to-end without
  touching real funds. Live keys require business verification (KYB).

---

## 1. Onboarding (once per company)

1. The company's operator creates a normal S-PAY account and signs in.
2. **Register the employer** — `POST /api/payroll/employers/register` (user JWT):
   ```json
   { "companyName": "Upwork Demo Ltd", "email": "pay@company.com",
     "websiteUrl": "https://company.com", "webhookUrl": "https://company.com/spay/webhooks" }
   ```
   The response includes a one-time `webhookSecret` — store it to verify callbacks.
3. **Mint an API key** — `POST /api/payroll/employers/me/api-keys` (user JWT):
   ```json
   { "name": "Production", "sandbox": true }
   ```
   The plaintext key (`spk_test_…` / `spk_live_…`) is returned **once**. Only its
   SHA-256 hash is stored. Live keys require `status: "verified"`.

All of this is also available as a UI at **`/payroll`** in the web app (sidebar →
Payroll): register, manage keys, watch batches and per-payment results.

---

## 2. Authentication

Server-to-server calls send the API key as a Bearer token (or `X-API-Key`):

```
Authorization: Bearer spk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

Scopes: `payroll:read`, `payroll:write`. Keys can be revoked or given an expiry.
The owner's **dashboard** reads (`/api/payroll/dashboard/*`) use the user's normal
JWT session instead — API keys are only for the marketplace's backend.

---

## 3. Funding the balance

- **Live:** `POST /api/payroll/funding/address` (user JWT) returns a Celo address.
  Send USDC there; confirmed deposits credit the payroll balance.
- **Sandbox:** `POST /api/payroll/sandbox/fund` with a **test** key:
  ```json
  { "amount": 5000 }
  ```
  Credits test balance instantly. Rejected for live keys.

---

## 4. Sending payroll

### Create a batch (draft — nothing is charged yet)

`POST /api/payroll/batches`

```json
{
  "reference": "2026-06-payroll",
  "description": "June freelancer payouts",
  "idempotencyKey": "june-2026-run-1",
  "currency": "USDC",
  "payments": [
    { "workerIdentifier": "alice@gmail.com",  "amount": 500, "reason": "Logo design" },
    { "workerIdentifier": "+254712345678",    "amount": 300, "reason": "Code review", "identifierType": "phone" },
    { "workerIdentifier": "spay_user_id_or_0xCeloAddress", "amount": 120, "externalId": "your-line-id" }
  ]
}
```

- `identifierType` is optional — it's inferred (`email` / `phone` / `celo_address`
  / `spay_id`) when omitted.
- `idempotencyKey` (body or `Idempotency-Key` header) makes create **safe to
  retry**: the same key returns the original batch instead of a duplicate.
- Up to **10,000** payments per batch. The response echoes computed
  `totalAmount`, `feeAmount` and `totalCost`.

### Submit (resolve workers + pay)

`POST /api/payroll/batches/{batchId}/submit`

- Verifies the prepaid balance covers `totalCost` (**402** if short — top up and
  retry; nothing is charged).
- Flips the batch to `processing`, then for each payment: resolves/creates the
  worker, **atomically** debits the employer and credits the worker, notifies
  them, and records the result.
- Returns the final batch (`completed`, `partially_completed`, or `failed`).
- Submit is **idempotent** — re-submitting a non-draft batch returns its current
  state, never double-pays.

### Inspect

| Endpoint | Purpose |
|---|---|
| `GET /payroll/batches` | list batches (paginated, `?status=`) |
| `GET /payroll/batches/{id}` | batch detail |
| `GET /payroll/batches/{id}/payments` | per-worker results + failure reasons |
| `GET /payroll/summary` | balance, totals disbursed, fees, workers onboarded |
| `POST /payroll/batches/{id}/cancel` | cancel a still-draft batch |

---

## 5. Worker resolution & auto-onboarding

For each payment S-PAY matches the identifier to a user:

| Type | Matched against |
|---|---|
| `email` | `users.email` (normalised) |
| `phone` | `users.phone_number` (normalised; `+` optional) |
| `spay_id` | `users.id` |
| `celo_address` | `users.celo_wallet_address` |

If no user is found and the employer has `autoCreateWorkers` on (default), an
**email** or **phone** identifier auto-creates a claimable account and sends the
worker an invite notification ("You've been paid 🎉 — finish setting up to
claim"). `celo_address` / `spay_id` with no match **fail** that payment (there's
nothing to invite on); with `autoCreateWorkers` off, unknown workers fail too.

Failures are isolated: a batch with some unresolved workers settles the rest and
ends `partially_completed`, with `errorMessage` on each failed payment.

---

## 6. Webhooks

When configured, S-PAY POSTs signed JSON events to the employer (or per-batch)
`webhookUrl`:

| Event | When |
|---|---|
| `batch.processing` | submit accepted |
| `payment.completed` / `payment.failed` | each worker |
| `batch.completed` / `batch.partially_completed` / `batch.failed` | batch done |
| `webhook.test` | `POST /payroll/webhooks/test` |

Each request carries `X-SPay-Event` and a signature header:

```
X-SPay-Signature: t=<unix>,v1=<hex hmac_sha256(secret, `${t}.${rawBody}`)>
```

Verify it with your `webhookSecret`:

```js
const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
```

Delivery is retried with exponential backoff (2s → 16s, 5 attempts) and every
attempt is logged — see `GET /payroll/webhooks/deliveries`.

---

## 7. Fees

Per payment: `1% + 0` flat (platform default; tiered pricing for high volume is
an admin setting). Fees are drawn from the employer balance on top of each payout
and surfaced as `feeAmount` / `totalCost` on the batch.

---

## 8. Errors

| Status | Meaning |
|---|---|
| 400 | validation (bad/empty payments, invalid identifier or amount) |
| 401 | missing/invalid/revoked/expired API key |
| 402 | insufficient prepaid balance at submit |
| 403 | insufficient scope, unverified employer (live key), suspended, or live action on a sandbox-only route |
| 404 | employer/batch/key not found |
| 409 | not cancellable / idempotency conflict |

---

## 9. Data model (lib/db/src/schema/payroll.ts)

`employers` · `employer_api_keys` · `payroll_batches` · `payroll_payments` ·
`payroll_webhook_deliveries`. Migration `0014_payroll.sql`. All tables have RLS
enabled (the API connects as table owner; Supabase's auto REST API is deny-all).

---

## 10. Test it

A self-contained end-to-end test boots the API against a throwaway Postgres and
runs the full flow (register → key → fund → batch → submit → resolve →
webhooks → assertions):

```
DATABASE_URL=postgres://… node artifacts/api-server/test/payroll.e2e.mjs
```
