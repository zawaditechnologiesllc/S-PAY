# S-PAY for Marketplaces — what to choose and why

> The decision guide you hand a marketplace (Upwork-style platform, tutoring
> site, microtask network, creator platform) evaluating S-PAY to pay its
> workers. For the full REST reference see [`docs/PAYROLL.md`](./PAYROLL.md); for
> who fits and the go-to-market view see
> [`docs/PAYROLL-MARKETPLACES.md`](./PAYROLL-MARKETPLACES.md); for how money
> actually moves see [`docs/PAYMENT-FLOWS.md`](./PAYMENT-FLOWS.md).

## The pitch in three lines

1. **One API to pay anyone, anywhere.** Identify a worker by email, phone, S-PAY
   ID, or wallet address — S-PAY resolves or auto-creates them and pays them.
2. **Workers cash out locally** to M-Pesa, MoMo, PIX, SEPA, ACH and banks, in
   minutes, in their own currency.
3. **No per-country bank integrations for you, no onboarding fee on the rails we
   route around.** You integrate once; S-PAY owns the corridor complexity.

---

## The one real choice a marketplace makes

Everything else is data. The single architectural decision is **how you deliver
pay**, and there are two options that both land in the worker's single Celo USDC
wallet:

### Option A — Pay to the worker's wallet (recommended)
You call the **Payroll API** with a worker identifier. S-PAY settles **real USDC
on-chain** into the worker's wallet; they cash out locally when they want.

- **Choose this if:** you already hold balances you can convert to USDC, or you
  prepay an S-PAY balance. This is true for essentially every marketplace.
- **Why it's the default:** instant, near-zero marginal cost, no bank rails on
  your side, and it's the native MiniPay-style model — the wallet *is* the
  account.

### Option B — Pay into the worker's virtual account (fiat-in)
If you can **only** send fiat (a traditional company doing ACH/SEPA), pay the
worker's virtual **US ACH / EU IBAN**. The provider auto-converts to USDC and
settles it on-chain to the same wallet.

- **Choose this if:** your treasury is bank-only and you cannot hold/convert
  USDC. You send a normal domestic transfer; the worker "receives a bank
  payment" and never sees crypto.
- **Trade-off:** depends on KYC/KYB-issued virtual accounts (provider-gated) and
  carries bank-rail timing (ACH/SEPA settlement windows).

> **Recommendation:** start with **Option A (pay to wallet by identifier)**. It's
> the cheapest, fastest, and least operationally coupled. Keep **Option B** as
> the on-ramp for fiat-only payers. **Both end in the same one wallet — there is
> no separate balance to reconcile.**

| | Option A — Pay to wallet | Option B — Virtual account |
|---|---|---|
| You send | USDC (or prepaid S-PAY balance) | Fiat (ACH / SEPA / wire) |
| Worker addressed by | email / phone / S-PAY ID / address | their issued ACH/IBAN |
| Speed to worker's wallet | Seconds (on-chain) | Bank-rail window, then on-chain settle |
| Your integration | One REST API | Bank transfer + provider account setup |
| Worker sees | "Paid in USDC" → cash out | "Received a bank payment" |
| Best for | Marketplaces, crypto-capable treasuries | Fiat-only traditional employers |
| Marginal cost | Sub-cent gas + provider FX | Bank fees + provider FX |

---

## How the integration works (Option A, end to end)

```
1. Register the company         POST /payroll/employers/register   (business account)
2. Verify the business (KYB)     → unlocks live API keys
3. Mint an API key               POST /payroll/employers/me/api-keys  (test first)
4. Fund the balance              send USDC to your funding address    (sandbox: mint test)
5. Create a batch                POST /payroll/batches                (draft; validated)
6. Submit it                     POST /payroll/batches/:id/submit     (reserve + settle)
7. Receive signed webhooks       payment.completed / .failed, batch.*
```

- **Sandbox-first:** every key is `test` or `live`. Test keys move only sandbox
  balance, so you build and verify the whole flow — including webhooks — without
  touching real money. Live keys require KYB.
- **Idempotent:** batch creation takes an `idempotencyKey`; submit and process
  are safe to retry — a payment in a terminal state is never re-paid.
- **Auto-onboarding:** unknown workers are created and invited to claim, so you
  can pay someone before they've ever heard of S-PAY (higher conversion).
- **Webhooks are signed** (HMAC-SHA256 with your `webhookSecret`); verify them.

Full request/response shapes, error codes, and webhook payloads:
[`docs/PAYROLL.md`](./PAYROLL.md).

---

## Which cash-out rail does a worker get? (and why it's not your problem)

You never pick a provider. S-PAY routes each worker's cash-out (and each
deposit) to the **best-configured rail for that corridor** via
`selectPayoutProvider()` / `selectDepositProvider()`:

| Corridor | Routed to (typical) | Why |
|---|---|---|
| Kenya / Ghana / Nigeria / SA — mobile money & bank | **Yellow Card** | Strongest African M-Pesa / MoMo coverage, no setup fee |
| USD / EUR — ACH / SEPA / card | **Bridge** | USD/EUR virtual accounts + stablecoin orchestration, usage-priced |
| Brazil / Mexico / Colombia / Philippines / Indonesia / India | **Conduit** | Purpose-built for emerging-market collections + payouts |
| Anywhere the above don't cover | **Thunes** (payout) / **Noah** | Widest global payout network; Noah as broad fallback |

**Why multiple providers (the honest reason):** Noah was the first rail but
charges an **onboarding/setup fee** and isn't cheapest everywhere. The
provider-agnostic layer lets S-PAY route around that on both deposits and
withdrawals, which keeps worker payout costs (and your effective fees) down. An
admin switches providers live from `/admin/settings` with no redeploy — so a
corridor can be re-routed to a cheaper partner without you changing anything.

---

## What to tell a marketplace (the short version)

- **"Integrate once, pay everywhere."** One API; we own the 100+ corridor
  complexity and the per-country compliance posture.
- **"Your workers get paid like locals."** Cash out to M-Pesa / PIX / SEPA in
  minutes, in their currency — a real retention lever for your supply side.
- **"Start in sandbox today."** Build the whole flow against test keys; flip to
  live after KYB. No bank integrations on your side.
- **"Pay by email or phone."** No need to collect wallet addresses or bank
  details from workers; auto-onboarding does the rest.
- **Default them to Option A** (pay to wallet by identifier); offer Option B
  (virtual accounts) only if their treasury is fiat-only.

---

## Best fits to target first

Mid-tier **freelance, tutoring, and microtask** platforms paying workers in
**Africa, South Asia, and Latin America**, where M-Pesa / MoMo / PIX / UPI rails
beat Payoneer/Wise on cost, speed, and local reach. Full tiering and the
go-to-market view: [`docs/PAYROLL-MARKETPLACES.md`](./PAYROLL-MARKETPLACES.md).
