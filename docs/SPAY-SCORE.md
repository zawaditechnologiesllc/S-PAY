# S-PAY Score — product, model, data and the 5-year plan

**S-PAY Score** is a free **300–850** financial-reliability score for **every personal and business account**, built only from the member's own S-PAY activity. It's S-PAY's take on the "pay score" super-apps use (deposit-free services above a trusted threshold), with more transparency: every factor, weight and point is shown to the member, along with a simulated plan to raise it.

The long-run purpose: **collect a clean, consented, multi-year score history now so that — from around 2031, and only for members who opt in — licensed financial institutions can use it** to offer credit, working-capital loans and insurance to remote workers and businesses who have no local credit file.

| Where | What |
|---|---|
| Public explainer (indexed) | `https://spayewallet.com/score` — benefits, how it's calculated, data used / never used, why it's collected, roadmap, how to keep it high, controls, FAQ. Bots get the same content server-rendered from `/ssr/score` |
| Member page | `/my-score` (web) · `app/score.tsx` (mobile) |
| Dashboard | Score card on `/dashboard` and the mobile home tab; Business Score card on `/payroll` |
| Footer / nav | "S-PAY Score" in the public nav and footer (Product), "Business Score", "Score Data Notice" (Legal), plus a short disclosure on every public page |
| Legal | Privacy Policy §10, Terms §7 |
| Admin | **Admin → S-PAY Score** (distribution, averages, data collected, partner-sharing readiness, consent trail) · **Admin → Settings → S-PAY Score Program** (master switch) · score column in **Users & KYC** |
| Proof links | `/score/verify/:token` — member-issued, expiring, `noindex` |

---

## 1. The model (`lib/score-model`, version `spay-score-v1`)

One shared package — `@workspace/score-model` — holds **both** the scoring function and every word of customer-facing copy. The API, web app, mobile app and the SSR crawler page all import it, so what customers read is exactly what the engine does (the unit tests enforce that published weights equal model weights).

```
score = 300 + Σ round(550 × weight × factorValue)        factorValue ∈ [0, 1]
```

Points are allocated by largest remainder so the factor points always add up exactly to the score.

| Factor | Personal weight | Business weight | Inputs (aggregates only) |
|---|---|---|---|
| Identity & security / Business verification | 20% | 20% | KYC/KYB result, email confirmed, PIN set, phone, country / business name, verified payroll employer |
| Account / Business history | 20% | 20% | Account age (full at 2 years), months active of last 12 |
| Payment behaviour / Payroll & payment reliability | 20% | 30% | Completed vs failed tx (90 days) · business: worker-payment success, failed batches, months with payroll (live batches only) |
| Income stability / Cash flow | 25% | 15% | Months with income (of 6), number of payers (a count), employer payroll received, volume on a log scale |
| Balance health / Float & balance health | 15% | 15% | Share of 6-month income kept (cashing out is never below neutral) · business: payroll float ÷ average batch |

Design rules baked into the model:

- **Neutral start, not zero.** Factors with no data start at a neutral value — a brand-new account is ~400 ("Building"), not 300.
- **Shrinkage.** Small samples are blended toward the neutral prior until there's enough evidence (10 transactions, 3 payroll batches, 3 months of income), so one payment can't swing the score.
- **Size matters least.** Income volume is log-scaled and worth ≤15% of one factor — consistency beats wealth.
- **Cashing out is fine.** Withdrawing everything is scored as neutral; keeping a 10–20% buffer earns extra.
- **Sandbox never counts.** `[TEST]` ledger rows and sandbox payroll batches are excluded.
- **No sensitive data.** No contacts, location, documents, jobs-board activity, or protected traits.

**Bands** (an ordered tier set, drawn with a one-hue ordinal ramp validated for both themes):

| Band | Range | Meaning |
|---|---|---|
| Building | 300–549 | Getting started |
| Good | 550–649 | **Trusted member** (550+) |
| Great | 650–749 | Consistent, verified, reliable |
| Excellent | 750–850 | Long, clean track record (~1 year+) |

Calibration (from the unit tests): new account ≈ 400 · verified with no activity ≈ 510 · verified + 1 month ≈ 545 · 3 months ≈ 675 · 6 months ≈ 745 · 1 year ≈ 780 · 2 years ≈ 820.

**Improvement plan:** every suggestion's "+N pts" is computed by running the model on the member's signals with that one change applied — never a hand-typed number.

To change the model: edit `lib/score-model/src/model.ts`, bump `SCORE_MODEL_VERSION`, and update the copy in `content.ts`. Stored snapshots keep their own `model_version`, so history stays explainable.

## 2. Data collection (`artifacts/api-server/src/lib/score.ts`)

| Table | Purpose |
|---|---|
| `score_profiles` | One row per member: on/off, partner-sharing consent (+ timestamp + notice version), cached last score/band |
| `score_snapshots` | **One row per member per calendar month**: score, band, factor values, the aggregate signals, model version. This is the multi-year history |
| `score_consent_log` | Append-only trail: `score_enabled`, `score_disabled`, `sharing_granted`, `sharing_revoked`, `history_deleted`, `shares_revoked` |
| `score_shares` | Proof links: sha256 of the token (token never stored), band/score frozen at issue, expiry, revocation, view count |

How it fills up:

1. Opening My Score (or the dashboard card) recomputes when the cached score is older than 6 hours, upserting this month's snapshot.
2. A **background sweep** (every 30 min, 200 members per pass) refreshes anyone without a computation this month or in the last 7 days — so history keeps building for members who never open the page.
3. Members who turned the score off are never computed or snapshotted.
4. Crossing into a new band sends an in-app notification.
5. Deleting an account deletes all four tables' rows for that member.

## 3. Consent & member controls

- **Score on/off** — on by default (it's derived from data S-PAY already holds to run the service); off stops all collection immediately and withdraws partner consent.
- **Partner sharing** — **off by default, explicit opt-in**, versioned (`SCORE_CONSENT_VERSION`), revocable, logged. **Nothing is shared with anyone today** (`partnerSharing.active` is hard-wired `false`).
- **Delete history**, **download data** (JSON), **revoke proof links**, **dispute** via privacy@spayewallet.com.
- The score is **never** used to freeze, hold or block a member's funds.

## 4. API

| Method | Path | Auth | |
|---|---|---|---|
| GET | `/api/score/me` | member | Score view (recomputes when stale) |
| PUT | `/api/score/settings` | member | `{ enabled?, partnerSharing? }` |
| DELETE | `/api/score/history` | member | Erase snapshots |
| GET | `/api/score/export` | member | JSON download |
| POST / DELETE | `/api/score/share` | member | Create (`{ showExactScore, days: 1\|7\|30 }`) / revoke all proof links |
| GET | `/api/score/verify/:token` | public | What the member chose to share; 404 when invalid/expired/revoked |
| GET | `/api/admin/score/stats` | any admin | Program overview |
| PUT | `/api/admin/feature-flags` | superadmin | `{ scoreProgramEnabled }` — pause/resume platform-wide (non-destructive) |

## 5. SEO

- `/score` is in `sitemap.xml`, `llms.txt`, the public nav and footer; it sets its own title, description, canonical and JSON-LD (WebPage + FinancialProduct, BreadcrumbList, FAQPage).
- Crawlers and link-preview bots are rewritten by `vercel.json` (both copies) to `https://s-pay.onrender.com/ssr/score`, which renders the identical content server-side.
- `/my-score` and `/score/verify/` are disallowed in `robots.txt`; verify pages also send `noindex`.
- After deploy: in Search Console, **URL Inspection → `https://spayewallet.com/score` → Request indexing**, and resubmit `sitemap.xml`.

## 6. The road to partner sharing (~2031)

| When | Milestone | Status |
|---|---|---|
| 2026 | Score launches for all accounts; monthly history, plans, proof links, full controls | ✅ Live |
| 2027–2028 | Band-based benefits inside S-PAY (limits, faster reviews, fee discounts) | Planned |
| 2029–2030 | Independent fairness/accuracy review of the model; partner + regulator due diligence | Planned |
| ~2031 | Licensed partners receive data for **opted-in** members only | Planned |

Admin → S-PAY Score tracks readiness: opt-in count, opt-in rate, and **partner-ready** members (opted in + ≥12 months of snapshots).

**Before any data leaves S-PAY**, the partner program needs (not built, deliberately):

1. Legal review per market — e.g. US FCRA (S-PAY could become a consumer reporting agency), Kenya Data Protection Act 2019 + CRB regulations, Nigeria NDPA 2023 + Credit Reporting Act 2017, Brazil LGPD + Cadastro Positivo, EU/UK GDPR Art. 22 (automated decisions).
2. Named partners in an updated Score Data Notice → bump `SCORE_CONSENT_VERSION` and **re-ask** members whose consent is on an older version.
3. A partner export that filters on `partner_sharing_consent = true` *and* the current consent version, with per-partner audit logging.
4. Adverse-action / dispute process with partners, and a member-visible log of which partner accessed what.

## 7. Tests

```bash
cd artifacts/api-server
node --test test/score.unit.mjs                    # model, bands, plan, content↔model (19 tests)
pnpm run build && DATABASE_URL=postgres://… node test/score.e2e.mjs   # 60 end-to-end checks against Postgres
```

The e2e suite covers scoring from real ledger rows, sandbox exclusion, monthly snapshots storing aggregates only, consent changes and their audit trail, proof links (exact vs band-only, revoke, 404s, `noindex`), export, history deletion, account deletion wiping score data, business accounts, admin stats/users, the program master switch, and the SSR crawler page + JSON-LD.
