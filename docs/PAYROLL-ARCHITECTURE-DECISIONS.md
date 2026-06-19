# Payroll Architecture Decisions

## Account Type: Personal vs. Business

**Current Implementation:** Both personal and business accounts can create payroll employers.

**Recommendation:** Restrict payroll to **business accounts only** for the following reasons:

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
| **US ACH account** | ✓ | ✓ (company name) |
| **EU IBAN** | ✓ | ✓ (company name) |
| **Virtual card** | ✓ | ✗ (later: corporate cards) |
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

## Profile Update Issue (Cannot Save)

**Suspected Cause:** Frontend form may not be sending updates correctly, or API response parsing is failing.

### Debug Steps
1. Check browser console for error messages when "Save" is clicked
2. Verify API endpoint is `/auth/me` with `PATCH` method
3. Check if `updatedAt` field is being returned by backend (it should auto-update)

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

### Flow 1: Payroll (Employer → Workers)
**S-PAY Receives:** Employer USDC → Debit employer → Credit workers → Payout provider routes locally

**Timeline:** Batch submitted → instant wallet credit → local settlement 1min–24h

### Flow 2: Celo Wallet Direct
**S-PAY Receives:** USDC already in Celo wallet (peer, off-chain bridge, employer) → Withdraw to local

**Timeline:** Direct wallet debit → provider conversion → local settlement

### Flow 3: Bank Account + Withdraw
**S-PAY Receives:** ACH/SEPA to virtual bank account → Auto-converted to USDC → Withdraw to local

**Timeline:** ACH arrives → instant Celo credit → withdraw → local settlement

**Key Insight:** S-PAY always holds USDC/USDT on Celo as the canonical ledger. Flows differ in how funds arrive, but settlement is identical.

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
