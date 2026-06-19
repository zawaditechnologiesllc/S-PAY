# S-PAY Payment Flows

This document explains the three main payment flows through the S-PAY system.

---

## Flow 1: Payroll (Employer → Workers)

**Use case:** Companies, marketplaces, and platforms paying workers globally.

```
Employer registers on S-PAY
     ↓
Employer funds their S-PAY balance with USDC/USDT (Celo)
     ↓
Employer submits batch of payments (API or dashboard)
     ├─ Payment 1: James (Nairobi) — $1,200 → M-Pesa
     ├─ Payment 2: Maria (São Paulo) — $950 → PIX
     └─ Payment 3: Priya (Manila) — $800 → GCash
     ↓
S-PAY processes batch:
     ├─ Debit employer balance (atomic: if balance < total, reject all)
     ├─ Credit each worker's S-PAY wallet (or auto-create if new)
     └─ Enqueue payout via selected provider (Noah, Bridge, Conduit, Yellow Card, Thunes)
     ↓
Provider executes payout:
     ├─ Convert USDC → local currency (using live FX rates)
     ├─ Route through fastest corridor (M-Pesa KE, PIX BR, GCash PH)
     └─ Settle to worker's phone/bank within seconds to minutes
     ↓
Webhook notification:
     ├─ payment.completed → Employer is notified
     └─ Worker receives notification ("You've been paid!")
```

### Key Features
- **Batch processing:** Submit 100s of payments in one request
- **Idempotency:** Resubmit same batch → returns original result (no double-charge)
- **Atomicity:** All-or-nothing: if one line fails validation, entire batch is rejected
- **Auto-onboarding:** New workers identified by email/phone are auto-created + invited
- **No setup fees:** Unlike Noah alone, alternative providers (Bridge, Conduit, Yellow Card, Thunes) charge 0 onboarding
- **Live routing:** Admin can switch preferred provider on-the-fly; next payout uses new provider

### Financial Flow
```
Employer USDC (Celo)
    ↓ (debit)
S-PAY Treasury account (Celo)
    ↓ (payout provider bridge)
Provider's account (Celo or fiat)
    ↓ (convert + route through local rail)
Worker's M-Pesa/PIX/GCash/Bank account
```

### Fees
- **Payroll fee (admin-set):** Flat + percent (e.g., $0.25 + 1%)
- **Provider fee (baked in):** Noah ~0.5–1%, Bridge 0.5%, Conduit 0.8%, Yellow Card 0.9%, Thunes 1.1%
- **S-PAY margin:** Admin's cut = payroll fee - provider fee

---

## Flow 2: Direct Receive + Celo Withdraw

**Use case:** Freelancers receiving from clients globally; direct Celo address settlement.

```
Worker has Celo address (from wallet provider: Privy/CDP/Turnkey)
     ↓
Client/payer sends USDC directly to worker's Celo address
     (can be:)
     ├─ Another S-PAY user (P2P send with fee)
     ├─ Employer batch (payroll)
     ├─ Off-chain bridge like Stripe, Wise, PayPal (employee payout)
     └─ Friend sending from another Celo wallet
     ↓
USDC lands in worker's Celo wallet
     ↓
Worker withdraws via S-PAY app:
     ├─ Choose destination: M-Pesa, PIX, GCash, SEPA, ACH, bank transfer, etc.
     ├─ S-PAY calls selectPayoutProvider()
     │  └─ If Noah configured + enabled: route via Noah
     │  └─ Else if Bridge configured + enabled: route via Bridge
     │  └─ Else: next enabled provider that supports corridor
     ├─ Provider quotes rate + fee (live)
     └─ If worker approves: execute withdrawal (sign Celo tx to provider)
     ↓
Provider converts USDC → local currency
     ↓
Local settlement (seconds to minutes):
     ├─ M-Pesa KE: instant
     ├─ PIX BR: instant
     ├─ MTN MoMo: within 1 min
     ├─ SEPA: same day
     └─ ACH: 1–2 business days
     ↓
Worker receives SMS/notification
```

### Key Features
- **No employer involvement:** Direct peer-to-peer or off-chain bridge
- **Multi-provider:** Live rate quotes from all enabled providers
- **Atomic settlement:** USDC debited from wallet only if provider can settle
- **No minimum withdraw:** Withdraw $1 or $1,000 (provider-dependent minimum may apply)

### Financial Flow
```
Worker's Celo wallet (USDC)
    ↓ (approve + send to provider)
Provider's Celo account
    ↓ (convert USDC → local currency, route through rail)
Worker's local account (M-Pesa/PIX/bank/GCash)
```

### Fees
- **S-PAY withdrawal fee (admin-set):** Flat + percent (e.g., $0.50 + 0.5%)
- **Provider fee:** Included in rate quote
- **S-PAY margin:** Withdrawal fee - provider cost

---

## Flow 3: Bank Account Receive (USD/EUR) + Withdraw to Local

**Use case:** Freelancers receiving payments from US/EU clients as if they were local.

```
Worker has S-PAY account (created at signup)
     ↓
Worker requests virtual bank account:
     ├─ US: ACH routing number (instant, issued by Noah)
     └─ EU: IBAN (instant, issued by Noah)
     ↓
Worker shares account details with US/EU employer/client:
     ├─ "Wire to my US account" → 021000021 ●●●● 4821
     ├─ "Send via SEPA" → DE●● ●●●● ●●●● ●●89
     └─ "ACH direct deposit" → same routing number
     ↓
Employer/client sends USD/EUR via ACH, SEPA, or wire:
     ├─ Lands in S-PAY's Noah-issued US checking account (Celo-linked)
     ├─ Or lands in S-PAY's Noah-issued EU IBAN (Celo-linked)
     └─ Noah instantly credits worker's S-PAY wallet as USDC equivalent
     ↓
Worker's S-PAY wallet balance increases (in real-time):
     ├─ $500 received via ACH → +$500 USDC in wallet
     └─ €500 received via SEPA → +$500 USDC equivalent in wallet
     ↓
Worker withdraws to local currency/method:
     (same as Flow 2 from here)
     ├─ Choose destination: M-Pesa, PIX, GCash, bank transfer, etc.
     ├─ Provider quotes live rate
     └─ Execute withdrawal → settles within minutes to business days
```

### Key Features
- **Employer sees no friction:** Employer uses their normal banking + S-PAY is "invisible"
- **Instant to S-PAY balance:** Noah syncs ACH/SEPA → USDC in seconds
- **Auto-FX:** USD received and stored as USDC (1:1 on Celo), EUR auto-converted to USDC
- **No monthly fee:** Worker keeps everything except payout fee

### Financial Flow
```
US Employer's bank (USD)
    ↓ (ACH transfer)
Noah's US checking account (USD) [holds S-PAY's virtual account]
    ↓ (convert to USDC, deposit to Celo)
S-PAY Treasury account (Celo USDC)
    ↓ (transfer to worker's Celo wallet)
Worker's Celo wallet (USDC)
    ↓ (approve + send to payout provider)
Provider's Celo account
    ↓ (convert USDC → local currency, route through rail)
Worker's local account (M-Pesa/PIX/SEPA/etc.)
```

### Fees
- **Receiving:** $0 (Noah absorbs ACH/SEPA bank fees as part of partnership)
- **Withdrawal:** Same S-PAY fee structure as Flow 2

---

## Comparison Table

| Feature | Flow 1 (Payroll) | Flow 2 (Direct Celo) | Flow 3 (Bank Receive) |
|---------|------------------|----------------------|----------------------|
| **Initiator** | Employer batch | Peer/off-chain bridge | US/EU employer |
| **Entry point** | S-PAY batch API | Celo address directly | Virtual bank account |
| **Inbox method** | Email/phone + auto-create | Celo address | ACH/SEPA routing number |
| **Speed to wallet** | Instant (DB credit) | Instant (Celo tx) | Instant (Noah sync) |
| **Speed to local** | Seconds–minutes | Seconds–minutes | Seconds–minutes |
| **Provider choice** | Admin preferred (configurable) | Worker's choice at withdrawal | Worker's choice at withdrawal |
| **Best for** | Companies paying teams | Peer-to-peer + freelancers | Receiving from US/EU without 3rd party |
| **Employer friction** | Low (API) | N/A (peer flow) | None (normal banking) |

---

## Route Selection (Provider Routing Logic)

### Payroll (Flow 1)
```
selectPayoutProvider(targetCurrency="KES", method="mpesa")
    ↓
Check admin preferred provider (e.g., Noah)
    ├─ Is Noah enabled? ✓
    ├─ Is Noah configured (NOAH_API_KEY set)? ✓
    ├─ Does Noah support KES + mpesa? ✓ (in NOAH_CURRENCIES set)
    └─ Return Noah
```

### Withdrawal (Flows 2 & 3)
```
worker clicks "Withdraw to M-Pesa"
    ↓
quotesForCorridor(targetCurrency="KES", method="mpesa", amountUsd=100)
    ↓
Return all enabled + configured providers that support KES + mpesa:
    ├─ Noah: 1% fee, FX 131.5 KES/USD → quote: 13,015 KES after fees
    ├─ Yellow Card: 0.9% fee, FX 131.5 KES/USD → quote: 13,030 KES after fees
    └─ Thunes: 1.1% fee, FX 131.5 KES/USD → quote: 13,005 KES after fees
    ↓
Worker sees all quotes, picks Yellow Card (best rate)
    ↓
S-PAY routes payout to Yellow Card
```

---

## Atomicity & Concurrency Guarantees

### Payroll Batch (Flow 1)
```sql
BEGIN TRANSACTION;
  -- Check balance once
  SELECT balance FROM employers WHERE id = ? FOR UPDATE;
  IF balance < totalCost THEN ROLLBACK; END;

  -- Debit employer
  UPDATE employers SET balance = balance - totalCost WHERE id = ?;

  -- Credit each worker
  FOR each payment DO
    INSERT INTO users (email, ...) ON CONFLICT DO NOTHING;  -- auto-create if new
    INSERT INTO transactions (type='receive', amount=..., ...) ...
  END;

  -- Mark batch as processing
  UPDATE payroll_batches SET status='processing' WHERE id = ?;
COMMIT;
```

### Withdrawal (Flows 2 & 3)
```sql
BEGIN TRANSACTION;
  -- Check wallet balance
  SELECT balance FROM wallets WHERE userId = ? FOR UPDATE;
  IF balance < amountUsd + fee THEN ROLLBACK; END;

  -- Debit wallet
  UPDATE wallets SET balance = balance - (amountUsd + fee) WHERE userId = ?;

  -- Create transaction record
  INSERT INTO transactions (type='withdraw', amount=amountUsd, fee=fee, ...);

  -- Enqueue payout
  INSERT INTO payout_queue (provider=..., amount=..., destination=..., ...);
COMMIT;
```

**Guarantee:** If any step fails (insufficient balance, rate limit, KYC rejection), the transaction rolls back. User's balance is never charged without a confirmed payout in the queue.

---

## Webhook Notifications

### Payroll Webhooks (Flow 1)
```
POST /employer/webhook (signed with HMAC-SHA256)
{
  "event": "batch.processing",
  "batchId": "batch_xxx",
  "status": "processing",
  "totalAmount": 3150,
  "totalPayments": 3,
  "timestamp": "2026-06-19T16:00:00Z"
}
```

Later:
```
{
  "event": "payment.completed",
  "paymentId": "payment_yyy",
  "workerId": "user_zzz",
  "workerCreated": true,  // was auto-onboarded
  "destinationMethod": "mpesa",
  "localAmount": 131500,
  "localCurrency": "KES",
  "status": "completed",
  "timestamp": "2026-06-19T16:00:05Z"
}
```

### Withdrawal Webhooks (Flows 2 & 3)
```
Currently: Workers see status in app dashboard
Later: Webhooks for integrations (e.g., "withdrawal.completed")
```

---

## Error Scenarios

### Payroll
| Scenario | Behavior | User Impact |
|----------|----------|-------------|
| Balance insufficient | Reject entire batch before processing | "Insufficient funds" error, no payments sent |
| New worker email already exists | Auto-merge (don't create duplicate) | Worker receives funds immediately if registered |
| Provider temporarily unavailable | Retry with exponential backoff; if persistent, fail payment | Employer notified via webhook, manual retry available |
| Rate limit exceeded (provider) | Queue for next minute; notify employer | Slight delay, no funds lost |

### Withdrawal
| Scenario | Behavior | User Impact |
|----------|----------|-------------|
| Balance insufficient | Reject before charging wallet | "Balance too low" error |
| Destination invalid (e.g., wrong M-Pesa account) | Provider rejects; refund issued | User sees error, funds returned to wallet within 24h |
| Provider down | Retry; if 5 attempts fail, mark as failed | User notified, can retry later |

---

## Future Enhancements

1. **Partial payroll batches:** Support "best effort" mode (pay as many as possible, report fails)
2. **Worker stacking:** Combine multiple small payouts to same worker into single larger payout
3. **Scheduled payroll:** "Pay every Friday at 5pm UTC" automation
4. **Multi-currency invoicing:** Employer invoices in USD, worker receives in local currency per withdrawal
5. **Swap integration:** On withdraw, offer "keep in USDC" or "convert to another stablecoin"
