# S-PAY — Global payouts for the AI workforce

> The document you send a company that pays remote workers at scale — AI
> data/training platforms (Scale AI, Mercor, Surge AI, Outlier, Appen, Toloka,
> Invisible, Turing, Micro1, iMerit, Sama, CloudFactory, Prolific…), freelance
> and tutoring marketplaces, and any modern company with a distributed
> workforce. Technical companion docs: [`PAYROLL.md`](./PAYROLL.md) (API
> reference) and [`MARKETPLACE-INTEGRATION.md`](./MARKETPLACE-INTEGRATION.md)
> (architecture decision guide).

---

## What S-PAY is

**S-PAY is payouts-as-a-service for globally distributed workforces.** One REST
API pays any worker in 100+ countries — identified by nothing more than an
email or phone number — and every worker gets a real financial account: a USD
balance, local cash-out to M-Pesa / MoMo / PIX / SEPA / ACH and 50+ local
methods, a US bank account & EU IBAN to receive with, and a virtual card to
spend with.

Under the hood, payments settle as **USDC on the Celo network** — sub-cent
transaction costs, ~5-second settlement, 24/7/365 — but neither you nor your
workers ever need to touch or understand crypto. You see a payout API; workers
see money that arrives instantly and cashes out in their own currency.

---

## The problem we solve (why AI-workforce companies specifically)

AI data companies run the most payout-intensive operations on Earth:

- **Tens of thousands of annotators, raters and domain experts** across Africa,
  South/Southeast Asia and Latin America — precisely the corridors where
  PayPal/Payoneer coverage is weakest and fees are highest.
- **Weekly or task-based pay cycles** — thousands of small payments, where a
  $1–5 flat transfer fee or a 3–6% FX spread visibly eats worker earnings.
- **Supply-side churn is the business risk.** Workers who wait 5 days for a
  transfer, lose 6% to fees, or can't cash out locally leave for the platform
  that pays better. Payout experience *is* worker retention.
- **Expert-tier contractors** (RLHF domain experts at $50–150/hr) expect
  professional rails: named bank transfers, statements, a real account.

S-PAY's answer, in one sentence: **pay everyone in one batch API call; every
worker gets paid like a local, in minutes, with fees measured in cents.**

---

## What your integration looks like

Two API calls, from sandbox to production:

```bash
# 1. Create a batch — workers identified by email/phone; unknown workers are
#    auto-onboarded and invited (you can pay someone who's never heard of us)
POST /api/payroll/batches
{ "reference": "2026-07-week2",
  "idempotencyKey": "run-2026-07-w2",
  "payments": [
    { "workerIdentifier": "annotator@gmail.com", "amount": 184.50, "reason": "Week 2 tasks" },
    { "workerIdentifier": "+254712345678",       "amount": 92.00,  "reason": "Week 2 tasks" }
  ] }

# 2. Submit — S-PAY resolves every worker, settles on-chain, fires signed webhooks
POST /api/payroll/batches/{id}/submit
```

- **Scale-ready:** up to 10,000 payments per batch; large batches are accepted
  instantly (`202`) and settle in the background, with signed webhooks
  (`payment.completed`, `payment.failed`, `batch.completed`) reporting every
  outcome. Idempotency keys make every call safe to retry.
- **Sandbox-first:** test keys (`spk_test_…`) exercise the entire flow —
  including webhooks — with zero real money. Live keys unlock after business
  verification (KYB).
- **No worker data collection on your side:** no bank details, no wallet
  addresses, no country-specific forms. An email or phone number is enough.
- **Prepaid, not postpaid:** you fund a USDC balance; every batch is reserved
  against it before anything moves. You can never overdraw, and failed payments
  are automatically refunded to your balance.

Median engineering effort in practice: **one backend developer, under a week**,
most of it on your side's bookkeeping rather than our API.

---

## What your workers get

- **Paid in minutes, not days** — funds land in their S-PAY balance at
  settlement (~5s on-chain) with an in-app notification.
- **Local cash-out**: M-Pesa, MTN MoMo, Airtel, GCash, PIX, Nequi, SPEI, SEPA,
  UK Faster Payments, US ACH — guided step-by-step flows, PIN-protected.
- **A USD account that holds value** — workers in high-inflation currencies can
  keep earnings in digital dollars and convert only when they spend.
- **US ACH account + EU IBAN** (KYC-gated) to receive bank payments like a
  local, and a **virtual card** that spends directly from their balance.
- **No crypto knowledge required** — ever. It's an app with a balance.

---

## What it costs

| | Typical incumbent (PayPal / Payoneer / wire) | S-PAY |
|---|---|---|
| Per-payout fee to you | $1–5 flat and/or 2%+ | **1% platform fee** (volume-tiered) |
| FX spread on the worker | 2–6% hidden in the rate | Routed to the **best rate** across our rail partners |
| Settlement to worker | 2–5 business days | **Minutes** |
| Minimum payout size | Often $50+ to be economical | **Any amount** — sub-cent rails make $2 tasks payable |
| Your integration | Per-country rails / provider patchwork | One REST API |

Corridor pricing is routed dynamically across multiple licensed money-rail
partners (Bridge, Yellow Card, Conduit, Thunes, Noah) — S-PAY always picks the
best customer rate per corridor, and you're never locked to a single provider.

---

## Trust, security & compliance posture

- **Every worker is KYC-verifiable** through hosted flows run by licensed
  partners (KYB for businesses); verification state is queryable and gates bank
  features. Employers pass **KYB** before live keys exist.
- **Money never moves on a session alone:** every worker cash-out is authorized
  by a transaction PIN; every employer action by scoped, hashed API keys
  (`test`/`live` split, Stripe-style).
- **Signed webhooks** (HMAC-SHA256), idempotent APIs, prepaid ledger with
  guarded debits, on-chain settlement hashes on every payment — your auditors
  can trace every cent to a public transaction.
- **Non-custodial key architecture:** wallet keys live in TEE/MPC
  infrastructure (Privy, Coinbase CDP, Turnkey…), never on S-PAY servers.
- Fail-closed engineering throughout: unsigned webhooks rejected, unfunded
  rails answer honestly instead of pretending, balances are read live from
  chain — never simulated.

---

## Who this is for (in priority order)

1. **AI data & training platforms** — Scale AI (incl. Remotasks/Outlier), Surge
   AI, Mercor, Appen, Toloka, Invisible, Turing, Micro1, iMerit, Sama,
   CloudFactory, DataAnnotation, Prolific, Pareto, Karya… anywhere thousands of
   raters and experts get paid per task or per week.
2. **Freelance & talent marketplaces** — Upwork-style platforms, tutoring
   networks, dev-talent shops (Andela-style), regional gig platforms.
3. **Any modern remote-first company** paying contractors across emerging
   markets and tired of the Payoneer/Wise patchwork.

## The ask

A 30-minute technical walkthrough plus a sandbox key the same day. Your team
can run a full test batch — auto-onboarding, webhooks, per-payment results —
before the call ends.

**Contact:** support@spayewallet.com · https://spayewallet.com
