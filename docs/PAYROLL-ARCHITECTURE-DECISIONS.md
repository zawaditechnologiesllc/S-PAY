# Payroll Architecture Decisions

> **Status (decided & shipped):**
> - **Payroll is business-account-only.** Enforced server-side (`POST
>   /payroll/employers/register` → `403 business_account_required` for personal
>   accounts) and in the UI (the `/payroll` nav link is hidden for personal
>   accounts, and the page itself shows a "business account required" upgrade
>   prompt).
> - **Every user has an S-PAY ID** (`spay_…`), generated on signup and
>   backfilled for all existing users by migration `0015_spay_id`. It is exposed
>   via `/auth/me` and shown as a scannable QR (header, profile, and the P2P
>   transfer dialog).
> - **Payout providers are fully wired to the admin panel** (`GET`/`PUT
>   /admin/payout-providers`): preferred-provider switch + per-provider on/off,
>   live with no deploy.

## Account Type: Personal vs. Business

**Decision:** Payroll is **business accounts only** — implemented.

### Why Business-Only?

1. **Tax/Legal Clarity:** Payroll is inherently a business function. Personal accounts paying workers can create tax/compliance confusion.
2. **KYB Integration:** Payroll integrations (especially with marketplaces) expect verified business entities, not individuals.
3. **Scale:** Businesses are the revenue driver; individuals using personal accounts to pay workers is niche.
4. **Admin UX:** Clearer separation of features in the admin panel + dashboard.

### How to Implement (if desired)

```typescript
// In routes/payroll.ts, POST /payroll/employers/register
if (user.accountType !== 'business') {
  return res.status(400).json({
    error: 'invalid_account_type',
    message: 'Payroll is only available for business accounts. Create a business account instead.'
  });
}
```

### Migration Path
- Existing payroll employers on personal accounts: grandfather in (don't break)
- New payroll registrations: redirect to business account creation

---

## Personal vs. Business Account Feature Matrix

| Feature | Personal | Business |
|---------|----------|----------|
| **Personal wallet** | ✓ | ✓ |
| **Send/Receive P2P** | ✓ | ✗ (team-only) |
| **US ACH account** | ⚙️ after KYC, pending provider key (D4) | ⚙️ after KYB (company name), pending provider key (D4) |
| **EU IBAN** | ⚙️ after KYC, pending provider key (D4) | ⚙️ after KYB (company name), pending provider key (D4) |
| **Virtual card** | ✓ (Stripe Issuing, admin switch) | ✗ (later: corporate cards) |
| **Payroll** | ✗ **(recommend)** | ✓ |
| **Job postings** | ✗ | ✓ (post to 500K workers) |
| **KYC** | Lax (email verified) | Strict (KYB + representative) |
| **Withdrawal methods** | 50+ (M-Pesa, etc.) | 50+ (same) |

---

## S-PAY ID Rollout Strategy

### Current State
- New users: auto-generated on signup
- Existing users: need backfill (migration 0016)

### Backfill Process
1. Run migration 0016_spay_id_backfill.sql on production
2. Users who had NULL spay_id get assigned `spay_<12-char-uuid>`
3. No user action required; transparent
4. Works retroactively for all existing users

### After Backfill
- Every user (new + existing) has unique, immutable spay_id
- Display in profile under "Your S-PAY ID" section
- QR code modal shows shareable S-PAY ID
- Workers identified by spay_id in payroll batches

---

## Profile Update Issue (Cannot Save) — RESOLVED

**Root cause (found & fixed):** The first `spayId` change added the column to
the Drizzle schema but shipped two hand-written SQL files (`0015`, `0016`) that
were **never registered in `migrations/meta/_journal.json`**. The boot-time
migrator (`drizzle-orm/.../migrator`) only applies journaled migrations, so it
skipped them — yet the TypeScript schema now selected a `spay_id` column the
database didn't have. Every users-table query (`SELECT …, spay_id FROM users`)
then failed with "column does not exist", which broke **login and profile-save
and anything else touching the users table** — not just profile editing.

**Fix:** Regenerated `0015` via `drizzle-kit generate` (so it's journaled +
snapshotted) and rewrote it with the safe pattern for a populated table — add
nullable → backfill every existing user with a unique id → `SET NOT NULL` →
unique + index. Verified end-to-end against a real Postgres (27/27 payroll E2E
checks pass; all users backfilled, zero nulls, all unique).

**Lesson:** Never hand-write migration SQL for this repo. Always use
`drizzle-kit generate` so the journal + snapshot stay in sync with the migrator.

### Endpoint Details
```
PATCH /auth/me
Authorization: Bearer <jwt>
Content-Type: application/json

Body example:
{
  "fullName": "James Odhiambo",
  "phoneNumber": "+254712345678",
  "country": "Kenya",
  "avatarUrl": "https://example.com/avatar.jpg"
}

Response:
{
  "id": "user_xxx",
  "email": "james@example.com",
  "fullName": "James Odhiambo",
  "phoneNumber": "+254712345678",
  "country": "Kenya",
  "avatarUrl": "https://example.com/avatar.jpg",
  "spayId": "spay_a1b2c3d4e5f6",
  "updatedAt": "2026-06-19T16:30:00Z"
}
```

### Potential Fixes
- Ensure frontend sends all fields together (don't partial update if validation fails)
- Check that API returns updated user object
- Verify `spayId` is included in userResponse() in auth.ts

---

## Landing Page Alignment with Project Goals

### Current State ✓
- Hero: "The money app that works where you work"
- Sections: Wallet, Banking, Payroll (business), Card, Jobs, Markets, Security
- CTAs: All point to /register or specific features
- Enquiries: Chat widget (replaces email)

### Removed (Too Technical) ✓
- Provider names in landing (Noah, Bridge, Conduit, Yellow Card, Thunes)
- "Fee-free provider switching" language
- Technical corridor/settlement jargon

### Added ✓
- Business section includes both virtual accounts + payroll
- Payroll messaging focuses on "no setup fees" + "instant settlement"
- QR code modal for worker-to-worker discovery via S-PAY ID
- Chat widget for enterprise enquiries

### Remaining Considerations
- Landing page reflects **three core use cases:**
  1. **Freelancers:** Receive globally, withdraw locally (Jobs board + Wallet)
  2. **Remote workers:** Get paid via bank account + withdraw anywhere (Banking)
  3. **Companies:** Pay teams worldwide (Payroll)

---

## Chat Widget Integration (Enquiry Submission)

### Current Flow
```
User clicks "Talk to Sales"
  ↓
Enquiry chat modal opens
  ↓
User fills: email, subject, message
  ↓
POST /enquiries/create
  ↓
Admin sees in /admin/enquiries
```

### Admin Panel Updates
- Enquiries from landing page chat → admin enquiries list
- Enquiries from "Partner with us" email link → convert to chat later
- Bulk export/categorize enquiries in admin UI

---

## QR Code Modal

### Features ✓
- Responsive: desktop (modal), mobile (full-screen sheet)
- Shows QR code of S-PAY ID
- Copy-to-clipboard with feedback
- Share instructions
- Display registered name

### Integration Points
- Triggered from profile page (QR button)
- Can be embedded in P2P send flow ("Send by QR code")
- Printed on business cards for marketers

---

## Payment Flows Summary

> Authoritative, code-matched detail lives in [`docs/PAYMENT-FLOWS.md`](./PAYMENT-FLOWS.md).
> Summary only below.

### Flow 1: Payroll (Employer → Workers)
Employer funds a Celo funding wallet with USDC → on submit, S-PAY **reserves** the
cost on the employer ledger and **settles on-chain** (real USDC transfer from the
funding wallet to the worker's Celo wallet), records a `receive` with the tx hash,
and sweeps the fee to treasury. If no wallet provider is configured the payment
**fails honestly and the employer is not charged** — never a faked credit.

### Flow 2: Celo Wallet Direct
USDC already in the worker's Celo wallet (peer, employer, exchange) → withdraw to local.

### Flow 3: Virtual Account (USD/EUR) + Withdraw
ACH/SEPA hits the worker's virtual account → the provider auto-converts to USDC and
settles it **on-chain to the worker's own wallet** → withdraw to local.

**Key insight:** there is **one balance** — USDC/USDT in the user's Celo wallet,
read live from chain. The flows differ only in how money enters that wallet; the
`transactions` table is history, never a spendable balance.

---

## Admin Panel Payroll Management

### Current State ✓
- `/admin/payroll` dashboard
- Payout providers section in Settings
- Fee configuration

### Wishlist (Future)
- Employer list: active, pending, rejected status
- Batch metrics: count, total value, success rate (30d)
- Worker metrics: auto-onboarded count, duplicate emails/phones
- Provider analytics: which provider used per payout, cost vs. margin
- Retry queue: manually retry failed payouts

---

## Recommended Finalization

### High Priority
1. Restrict payroll to business accounts only (if aligned with go-to-market)
2. Run S-PAY ID backfill migration (0016) on production
3. Debug + fix profile update issue (browser console check)
4. Test QR modal on mobile view
5. Verify chat widget submits to admin enquiries

### Medium Priority
1. Integrate QR modal into P2P send flow ("Receive by QR code")
2. Add S-PAY ID to worker's public profile
3. Document provider switching for support team

### Nice-to-Have
1. Admin employer analytics dashboard
2. Worker payout history export
3. Bulk retry failed payouts

---

## Go-to-Market Priorities

### If Restricting to Business Payroll
1. **Upwork, Fiverr integration:** Business account registration
2. **Pricing:** Highlight "no onboarding fees" vs. Noah
3. **Docs:** "Payroll for Upwork" integration guide
4. **Support:** Point users to /admin/payroll for status

### If Keeping Personal Payroll
1. Document personal + business differences
2. Add warning: "Ensure you're compliant with local tax laws"
3. Clarify use case (small teams, creator collectives, etc.)

---

## Next Steps (In Priority Order)

1. [ ] Clarify: Payroll for business-only or both?
2. [ ] Run backfill migration (0016)
3. [ ] Debug profile save issue
4. [ ] Test mobile QR modal
5. [ ] Onboard first marketplace (e.g., Upwork) with payroll API
6. [ ] Monitor webhook delivery success rate
7. [ ] Gather feedback from initial employers
