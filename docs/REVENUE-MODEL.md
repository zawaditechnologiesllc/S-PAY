# S-PAY Revenue Model — how the business makes money

> This is the money map for the business. Every number here maps to a real,
> already-shipped knob in the code or admin panel — nothing aspirational is
> presented as live. Defaults are what ships; you reprice live from
> **Admin → Settings → Fees & Revenue** (`fee_schedule` in `app_settings`),
> no redeploy.

## The one-sentence model

**S-PAY charges a small spread on each movement of money — payroll, cash-out,
card, and (optionally) P2P — and collects it automatically, on-chain, to the
treasury wallet.** Because the rails are stablecoins on Celo, the cost of
delivering each transaction is sub-cent gas plus the chosen provider's fee, so
the spread is mostly margin.

---

## The five revenue lines (and where each lives in code)

| # | Line | Default price | Lever (code) | Status |
|---|---|---|---|---|
| 1 | **Payroll fee** | flat $0.00 + **1.0%** per payment | `DEFAULT_PAYROLL_FEE` (`lib/payroll.ts`), `payrollFee()` | ✅ Charged + reserved per payment; swept on-chain to treasury on settlement |
| 2 | **Withdrawal / cash-out fee** | **max($0.49, 1.0%)** per withdrawal | `DEFAULT_FEES.withdrawalFee*`, `withdrawalFee()` (`lib/settings.ts`) | ✅ Quoted live; collected on execution (D2) |
| 3 | **Card issuance fee** | **$1.00** one-time | `DEFAULT_FEES.cardIssuanceFee` | ✅ Live with the card program |
| 4 | **P2P transfer commission** | flat $0.00 + **0%** (free) | `transferFeeFlat`, `p2pFeePercent`, `transferFee()` | ✅ Live; swept to treasury when priced > 0 |
| 5 | **FX spread on deposits/withdrawals** | the gap between the live FX you show and the provider's wholesale FX | `quote()` / `quoteDeposit()` `feePercent` in `lib/payout-providers.ts` | ⚙️ Realized once provider keys are set |

All five are **already wired**. Lines 1–4 are explicit fees in the schedule;
line 5 is the FX spread baked into every quote. You do not need to build a
billing system — you turn dials.

---

## How collection actually works (it's automatic and on-chain)

The fee is never an invoice you chase. It is taken in the same motion as the
payment, in USDC, and swept to **`TREASURY_CELO_ADDRESS`**:

- **Payroll (line 1):** `settleLive()` reserves `amount + fee`, sends `amount`
  to the worker, then sweeps `fee` to the treasury (best-effort; logged for
  reconciliation if the treasury isn't set). See `lib/payroll-processor.ts`.
- **P2P (line 4):** `POST /wallet/send` charges `transferFee` on top and sweeps
  it to the treasury in the same flow. See `routes/wallet.ts`.
- **Withdrawal (line 2):** the user-facing fee from the schedule is netted at
  cash-out; your margin is that fee minus the provider's cost.
- **Card (line 3):** Stripe nets card economics from the Stripe balance; the
  $1 issuance fee is your schedule price.

> ⚠️ **To actually collect lines 1, 4 (and the on-chain portion of 2), set
> `TREASURY_CELO_ADDRESS`.** Until it's set, the platform runs **fee-free by
> design** (growth mode): payroll/P2P fees stay in the payer's funding wallet
> and are logged for reconciliation rather than collected. This is intentional
> and honest — flip it on when you want revenue to start.

---

## The margin math (worked example)

A marketplace runs **$1,000,000/month** in payroll through S-PAY, and workers
cash out ~80% locally.

| Line | Basis | Rate | Monthly |
|---|---|---|---|
| Payroll fee | $1,000,000 disbursed | 1.0% | **$10,000** |
| Cash-out fee | $800,000 withdrawn | ~1.0% (min $0.49) | **~$8,000** |
| FX spread | $800,000 converted | ~0.3–0.7% net of provider | **$2,400–$5,600** |
| **Gross** | | | **~$20,400–$23,600/mo** |

**Cost to deliver:** Celo gas is sub-cent per transfer; the provider's wholesale
fee is already netted inside the FX-spread line. The payroll and cash-out fees
are therefore close to pure margin. The dominant variable cost is the **payout
provider's** cut — which is exactly why the provider-agnostic rail (below) is a
revenue lever, not just resilience.

*(Numbers illustrate the mechanism with default rates; they are not a forecast.)*

---

## Why the provider-agnostic rail is a profit lever

Margin per transaction = **(your price) − (provider cost) − (gas)**. The provider
cost is the only meaningful term, and it differs by corridor and by provider:

- **Noah** charges an **onboarding/setup fee** and prices per corridor — fine as
  a fallback, expensive as a default.
- **Bridge / Conduit / Yellow Card / Thunes** are **usage-based with no setup
  fee**, and each is cheapest in different corridors (Yellow Card in African
  mobile money, Bridge in USD/EUR, Conduit in LatAm/Asia).

`selectPayoutProvider()` / `selectDepositProvider()` route each transaction to
the cheapest configured rail for its corridor, **on both the deposit and the
withdrawal side**. Every basis point shaved off provider cost drops straight to
margin without changing the price the user sees. Adding the deposit side
(this change) means you also stop paying Noah's onboarding-fee economics on
**top-ups**, not just cash-outs.

---

## Pricing levers you control live (no deploy)

From **Admin → Settings → Fees & Revenue**:

- Withdrawal **%** and **minimum** ($).
- Card issuance fee ($).
- P2P **%** and flat — keep at 0 for growth, raise once sticky.
- (Payroll % / flat are in `DEFAULT_PAYROLL_FEE`; expose in the same panel when
  you want per-tenant payroll pricing.)

From **Admin → Settings → Payout Providers**: preferred provider + per-provider
on/off — your direct control over the cost side of every transaction.

---

## Roadmap revenue (not yet built — labelled honestly)

These are credible future lines the architecture supports but that are **not
implemented today**; do not quote them as live:

- **Card interchange share** (Stripe Issuing revenue-share) — needs the spend
  webhooks (D3) and an interchange agreement.
- **Float/yield** on stablecoin balances awaiting cash-out — treasury policy
  decision, not built.
- **Per-tenant SaaS / platform fees** for marketplaces (monthly minimums, named
  pricing) — commercial, not a code feature.
- **Premium FX / instant-settlement tier** — a higher-spread express option.

---

## TL;DR for the operator

1. Set `TREASURY_CELO_ADDRESS` → fees start being collected on-chain.
2. Configure the **cheapest** payout **and** deposit provider per corridor →
   maximize margin, avoid Noah's onboarding fee.
3. Tune the fee schedule in the admin panel → reprice live.
4. The billing engine already exists; you are turning dials, not building.
