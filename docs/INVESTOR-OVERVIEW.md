# S-PAY — Investor Overview

> A plain, honest overview of what S-PAY is, how it works, how it makes money,
> and exactly what is live today versus what is built-and-gated. It deliberately
> separates **shipped** from **in progress** — if a thing needs a partner key to
> switch on, this doc says so. Companion detail:
> [`REVENUE-MODEL.md`](./REVENUE-MODEL.md),
> [`PAYMENT-FLOWS.md`](./PAYMENT-FLOWS.md),
> [`MARKETPLACE-INTEGRATION.md`](./MARKETPLACE-INTEGRATION.md),
> and the operator runbook [`../LAUNCH-CHECKLIST.md`](../LAUNCH-CHECKLIST.md).

---

## 1. The problem

~$900B in remittances and a fast-growing remote-work economy still move on rails
built for a different era. A developer in Nairobi, a tutor in Manila, or a
designer in São Paulo who works for a foreign company faces:

- **Slow, expensive payout** (Payoneer/Wise/bank wires: days, 3–7%+ all-in).
- **Dollar access friction** — they earn in USD but live in local currency, and
  converting/holding dollars is hard.
- **Marketplaces** that must stitch together per-country payout integrations to
  pay their global supply side.

## 2. The solution

**S-PAY is a stablecoin-native money app for global workers, plus a
payouts-as-a-service API for the platforms that pay them.** Workers hold digital
dollars (USDC on Celo) in one wallet, receive pay by email/phone/ID, and cash
out to local rails — M-Pesa, MoMo, PIX, SEPA, ACH — in minutes. Marketplaces
integrate once and pay any worker, anywhere.

It is the **MiniPay model** (one stablecoin balance, addressed by phone, cashed
out locally) extended with **payroll** and a **provider-agnostic rail layer**.

## 3. How it works (the architecture in one screen)

- **One balance.** A user's money is **USDC/USDT in their own Celo wallet**, read
  live from chain. There is no separate "virtual-account balance" — every flow is
  an on-ramp into that one wallet, every cash-out an off-ramp out of it.
- **Wallets are non-custodial WaaS.** Six interchangeable providers (Privy,
  Coinbase CDP, Turnkey, Openfort, thirdweb, Dynamic) — S-PAY never holds a
  private key. Wallets are provisioned **just-in-time on the first money action**,
  so a jobs-board signup that never transacts costs $0 in wallet fees.
- **Money rails are provider-agnostic, both directions.** A pluggable layer
  (Noah, Bridge, Conduit, Yellow Card, Thunes) routes each **deposit** and each
  **withdrawal** to the cheapest rail that serves the corridor — switchable live
  from the admin panel, no redeploy.
- **Payroll settles on-chain.** Employers prepay a USDC float; each payment is a
  real on-chain USDC transfer to the worker's wallet, recorded with its tx hash.
  No wallet provider configured → the payment fails honestly and the employer
  isn't charged. **Nothing is ever shown as paid that didn't move.**
- **Honest by construction.** Every rail that isn't configured returns an honest
  503; the app never fabricates balances, accounts, or settlements. (This is a
  design principle in the code, not a slogan.)

```
  Fiat in  ─▶  [ USDC on Celo : the one wallet ]  ─▶  Fiat out
  (payroll, virtual account,                         (M-Pesa, PIX,
   exchange, P2P)                                     SEPA, ACH, bank)
```

## 4. Why now / why this wins

- **Stablecoins crossed the chasm.** USDC/USDT on low-fee chains (Celo: sub-cent
  gas, stablecoin-denominated) make dollar-in/dollar-out genuinely cheaper than
  incumbents — the unit economics finally work.
- **Provider-agnostic routing is a durable cost moat.** Margin per transaction =
  price − provider cost − gas. Because S-PAY routes to the cheapest rail per
  corridor (and isn't locked to any partner's onboarding-fee economics), it can
  underprice single-rail competitors and still keep margin. Adding the deposit
  side means the same advantage on top-ups, not just cash-outs.
- **Two-sided wedge.** The consumer wallet acquires workers; the payroll API
  acquires the marketplaces that pay them — each side feeds the other.
- **Distribution is already on.** A jobs board (3,000–5,000 listings/day, SEO +
  Google for Jobs) acquires the exact worker persona at near-zero CAC and funnels
  them into the wallet.

## 5. Business model — how S-PAY makes money

A small spread on every movement, collected automatically on-chain to the
treasury. Five wired lines (full detail in [`REVENUE-MODEL.md`](./REVENUE-MODEL.md)):

| Line | Default | Status |
|---|---|---|
| Payroll fee | 1.0% / payment | ✅ wired, swept on settlement |
| Withdrawal fee | max($0.49, 1.0%) | ✅ quoted; collected on execution |
| Card issuance | $1.00 | ✅ live with card program |
| P2P commission | 0% (growth) → dial up | ✅ wired |
| FX spread | baked into every quote | ⚙️ realized when provider keys set |

**Illustrative:** a single marketplace running **$1M/mo** payroll with ~80%
local cash-out yields **~$20–24k/mo** gross at default rates, against sub-cent
gas and netted provider cost. (Mechanism, not a forecast.) The billing engine
exists; growth is turning dials and adding tenants.

## 6. Status — shipped vs. gated (the honest cut)

**Live today:**
- Non-custodial Celo wallets (6 WaaS providers), keyless on-chain balance reads.
- P2P send by phone/email/S-PAY ID/address (PIN-gated), real transaction ledger.
- On-chain payroll settlement (code complete; executes once a wallet provider key
  is set).
- Jobs board + SEO, auth (email/Google/Apple, email MFA), admin console with live
  fee/provider/maintenance switches, virtual-card program (Stripe Issuing) behind
  an admin switch.

**Built and gated on a partner key / final task (no architecture risk):**
- Cash-out execution to local rails (D2) — routing + quotes live; flips on with a
  payout provider key.
- Deposit/top-up execution (provider-agnostic) — routing live; flips on with a
  deposit provider key.
- Virtual account (US ACH / EU IBAN) provisioning (D4) and KYC/KYB initiation
  (D1) — webhooks already wired.
- Card spend history (D3).

We do not present gated items as live. The remaining work is integration and
go-to-market, not core architecture.

## 7. Key risks (and the posture)

- **Licensing / compliance (MSB/MTL, KYB).** Mitigated by routing through
  licensed money-rail partners and KYB-gating live payroll; the operational, not
  technical, constraint on scale.
- **Provider dependency.** Mitigated by the multi-provider abstraction — no single
  partner is load-bearing; corridors re-route live.
- **Stablecoin/regulatory shifts.** USDC/USDT issuer and chain risk; mitigated by
  multi-token support and an EVM-portable design.
- **FX/treasury.** Float and FX exposure managed by settling close to real-time
  and keeping the one-balance model (no held fiat positions by default).

## 8. The shape of the opportunity

A worker wallet with near-zero CAC (jobs board), a marketplace API with one
integration serving every customer, and a cost structure that improves as the
provider mix is optimized per corridor. The wedge is emerging-market payouts —
where incumbents are weakest and S-PAY's rails are strongest — expanding into the
full money app (hold, spend via card, get paid, cash out) around the single
stablecoin balance.

---

*This document is intentionally conservative about status. For the exact code
paths behind every claim, see the linked docs and `artifacts/api-server/src`.*
