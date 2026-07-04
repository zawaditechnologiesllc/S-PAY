# S-PAY Payroll — which marketplaces we can integrate

> Companion to [`docs/PAYROLL.md`](./PAYROLL.md) (the integration guide). This
> doc is the **go-to-market reference** for the team: who can pay their workers
> through S-PAY, why they fit, and where the real limits are.

## The one-line answer

**Any platform that can identify a worker by email or phone can integrate** —
which is essentially all of them. The payroll API is identical for every
marketplace (register → mint key → fund → submit batches), so onboarding
marketplace #500 costs the same engineering as #2: ~zero. The real limit is
**operational** (KYB onboarding, payout-corridor coverage, compliance), not
technical.

---

## Target marketplaces by tier

### Tier 0 — AI data & training workforces (the priority pitch)
The most payout-intensive companies on Earth: thousands-to-hundreds-of-thousands
of annotators, raters and RLHF domain experts, paid weekly or per task, heavily
concentrated in Africa / South & Southeast Asia / LatAm — exactly the corridors
where we beat PayPal/Payoneer on cost, speed and reach. Their supply-side churn
is a payout-experience problem, which makes payouts a sales conversation, not a
procurement one. Pitch doc to send them: [`docs/PITCH.md`](./PITCH.md).

| Company | Workforce shape |
|---|---|
| **Scale AI** (incl. Remotasks, Outlier) | 100k+ taskers & experts globally; task-based micro-to-mid payouts |
| **Surge AI** | Elite rater network; expert-tier weekly payouts |
| **Mercor** | AI-vetted global talent marketplace; contractor payouts |
| **Appen / Toloka / Clickworker** | Classic crowd platforms, enormous worker counts, tiny payments |
| **Invisible Technologies** | AI-ops workforce across emerging markets |
| **Turing / Micro1** | Remote engineer marketplaces feeding AI labs |
| **iMerit / Sama / CloudFactory / Karya** | Africa/Asia-based annotation workforces (impact-oriented — local cash-out is the whole story) |
| **DataAnnotation / Prolific / Pareto** | Research & annotation crowds, email-keyed |

Why we win here: per-task economics (sub-cent rails make a $2 task payable),
auto-onboarding by email (no bank-detail collection from 50k workers), local
cash-out in the worker's currency in minutes, and one API instead of a
per-country provider patchwork.

### Tier 1 — Freelance & gig marketplaces (best fit)
Many small payments to globally-distributed workers — exactly what batch payouts
+ auto-onboarding are built for.

| Platform | Why it fits |
|---|---|
| **Upwork** | 7.5M+ freelancers, 100+ countries; batch payouts, local cash-out |
| **Fiverr** | 4.8M+ sellers; micro-payments |
| **Freelancer.com / Guru / PeoplePerHour / Toptal** | Same payout shape |
| **Workana / Bumeran** (LatAm) | PIX / SPEI corridors are our edge |
| **Truelancer / Outsourcely** (Asia) | UPI / mobile-money corridors |

### Tier 2 — Education & tutoring
| Platform | Notes |
|---|---|
| **Studypool, Chegg, Course Hero, Wyzant, Preply, Cambly, TutorMe** | Weekly/biweekly tutor payouts → recurring batches, mostly email-keyed |

### Tier 3 — Microtask, data & content
| Platform | Notes |
|---|---|
| **Appen, Clickworker, Toloka, Remotasks, Prolific** | High worker counts, tiny payments — batch is ideal |
| **Mechanical-Turk-style platforms** | Email-keyed |

### Tier 4 — Creator & community payouts
| Platform | Notes |
|---|---|
| **Substack, Patreon, Ko-fi, GitHub Sponsors, OpenCollective, bug-bounty platforms** | Payout to creators/contributors by email |

### Tier 5 — Gig delivery & ride-hail (regional)
| Platform | Notes |
|---|---|
| **Bolt, inDrive, local courier/delivery apps** | Driver payouts where M-Pesa / MoMo settlement is a genuine differentiator |

---

## Harder / later

- **Mega-platforms with in-house rails.** Upwork/Fiverr already use
  Payoneer/PayPal. We win them on **cost + speed + local reach**, not by merely
  being available. More realistic first customers: **mid-tier and emerging-market
  platforms** underserved by Payoneer/Wise.
- **Restricted jurisdictions** (China, Russia, Iran): payout-network and
  compliance gaps.

---

## Geographic reach (payout corridors)

100+ countries via the payouts partner. Differentiating corridors:

- **Africa:** Kenya/Tanzania (M-Pesa), Ghana/Cameroon/Rwanda (MTN MoMo),
  Nigeria/South Africa (bank transfer), Uganda (Mobile Money)
- **Asia:** Philippines (GCash), Indonesia (GoPay), India (UPI)
- **LatAm:** Brazil (PIX), Mexico (SPEI), Colombia (Nequi)
- **Europe/NA:** SEPA, UK Faster Payments, US ACH/wire

---

## What gates how many we can onboard

It is **not** the code. The throttles are:

| Factor | Constraint |
|---|---|
| KYB / onboarding bandwidth | ~5–10 new marketplaces/month per ops person |
| Payout coverage | 100+ countries, gaps in restricted markets |
| Compliance licensing | MSB / MTL as volume grows in some jurisdictions |
| Support capacity | each marketplace = ongoing support |
| Treasury / float | working capital if we pre-fund before settlement |

**Year-one realistic:** 30–100 marketplaces (1–2 mega, ~10 regional, ~50 niche)
reaching 5–20M workers. No architectural ceiling.

## Sweet spot to target first

Mid-tier **freelance, tutoring, and microtask** platforms paying workers in
**Africa, South Asia, and Latin America** — where our M-Pesa / MoMo / PIX / UPI
rails beat Payoneer/Wise on cost, speed, and local reach.
