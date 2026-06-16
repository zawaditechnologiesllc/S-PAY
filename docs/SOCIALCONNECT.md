# SocialConnect on S-PAY — setup guide (do it slowly)

> Companion docs: [`docs/WALLET-PROVIDERS.md`](./WALLET-PROVIDERS.md) (wallets/WaaS) ·
> [`README.md`](../README.md) · [`LAUNCH-CHECKLIST.md`](../LAUNCH-CHECKLIST.md).

This guide explains what SocialConnect is, what's **already wired into S-PAY**,
and the exact remaining steps to turn it on — written so you can do it in stages
without breaking anything. **It is safe to ignore entirely; everything below is
optional and additive.**

---

## 0. Read this first — what SocialConnect is and is NOT

- **SocialConnect IS** Celo's open, decentralized **directory** that maps an
  off-chain identifier (phone number, email) → an on-chain wallet **address**,
  with phone-number privacy provided by **ODIS** (a service that hands out a
  secret "pepper" so raw phone numbers never go on-chain).
- **SocialConnect is NOT a wallet provider.** It does **not** create wallets,
  hold private keys, or sign transactions. That's what the WaaS layer
  (Privy / Coinbase CDP / Turnkey / Openfort / thirdweb / Dynamic) does.

**Therefore: SocialConnect does NOT replace WaaS and will NOT reduce your wallet
bill.** They sit at different layers. You still need a WaaS (or self-custody) for
the wallet itself. If your goal is *lower cost*, the lever is switching to a
cheaper WaaS provider (see `docs/WALLET-PROVIDERS.md §2`), not SocialConnect.

### So why add SocialConnect at all?

One reason only: **interoperability**. Today S-PAY's "send by phone/email"
resolves the recipient from **S-PAY's own database** — which only works if the
recipient is already an S-PAY member. With SocialConnect:

- S-PAY can send to someone by phone/email even if they're **not an S-PAY user**,
  as long as they've registered that identifier on Celo (e.g. via MiniPay/Valora).
- Other Celo apps can find **your** users by phone/email (if you publish
  attestations), so money can flow into S-PAY from the wider ecosystem.

If that cross-app reach isn't a priority yet, leave it off.

---

## 1. What's already built (so you don't re-do it)

The scaffolding is committed and safe — it's a **no-op until you finish setup**:

| Piece | Where | State |
|---|---|---|
| Admin on/off switch | `/admin/settings → SocialConnect (Celo identity)` | ✅ Works now (persists to `app_settings`) |
| Feature flag + config detection | `lib/settings.ts` (`getSocialConnect`), `lib/socialconnect.ts` (`isSocialConnectConfigured`) | ✅ |
| Send-flow fallback hook | `routes/wallet.ts` — when a phone/email isn't an S-PAY member, it calls `resolveByIdentifier()` before 404-ing | ✅ Wired, returns `null` until you implement §4 |
| The actual ODIS + on-chain calls | `lib/socialconnect.ts` → `resolveByIdentifier()` (read) and `publishAttestation()` (write) | ⏳ **You implement these (§4, §5)** |

**Guarantee:** with the switch OFF (default) or the issuer keys unset,
`resolveByIdentifier()` returns `null`, so sends behave exactly as they do today
(unknown phone/email → "No S-PAY member with that…"). You can flip the switch on
at any stage; it does nothing until §2–§6 are done.

---

## 2. Confirm the Celo network + registry address

Celo migrated to an **Ethereum L2** in 2025, so **verify the current contract
addresses before building** (don't trust an old tutorial):

1. Open the SocialConnect repo → `docs/`: <https://github.com/celo-org/social-connect>.
2. Find the **`FederatedAttestations`** and **`OdisPayments`** contract addresses
   for **Celo mainnet (chain 42220)** on the current network.
3. Put the FederatedAttestations address in Render env
   `SOCIALCONNECT_REGISTRY_ADDRESS` (the code reads it; there's no hardcoded
   default on purpose, so a stale address can't silently ship).

> S-PAY already talks to Celo mainnet via Forno RPC (`lib/celo-chain.ts`,
> `CELO_RPC`) — reuse that RPC for the read calls.

---

## 3. Create the issuer identity + set env vars

The **issuer** is the S-PAY-controlled account that vouches "this phone/email
belongs to this address." It signs ODIS requests and on-chain attestations.

1. Generate a fresh keypair (NOT a user wallet, NOT your treasury):
   ```bash
   # any EVM keygen; e.g. with cast (foundry) or viem
   cast wallet new
   ```
2. On **Render → `spay-api` → Environment**, set:
   ```
   SOCIALCONNECT_ISSUER_ADDRESS     = 0x...   (the address)
   SOCIALCONNECT_ISSUER_PRIVATE_KEY = 0x...   (the private key — treat like JWT_SECRET; never commit)
   SOCIALCONNECT_REGISTRY_ADDRESS   = 0x...   (from §2)
   ```
3. Redeploy. The admin panel's **SocialConnect → Issuer keys** row should flip to
   green **Configured**. (The feature is still inert until you implement §4 and
   flip the switch.)

> Security: the issuer key can write attestations under your name. Store it only
> as a Render env var. If it leaks, rotate it and re-issue attestations.

---

## 4. Implement the resolver (read path) — `resolveByIdentifier()`

File: `artifacts/api-server/src/lib/socialconnect.ts`. Replace the TODO body of
`resolveByIdentifier()` with:

1. **Obfuscate the identifier via ODIS** (the privacy step) using
   `@celo/identity`'s `OdisUtils.Identifier.getObfuscatedIdentifier`, signing the
   ODIS auth with `SOCIALCONNECT_ISSUER_PRIVATE_KEY`. Map S-PAY's `type` to the
   ODIS identifier type (`PHONE_NUMBER` / `EMAIL`).
2. **Read the registry**: call
   `FederatedAttestations.lookupAttestations(obfuscatedIdentifier, [SOCIALCONNECT_ISSUER_ADDRESS])`
   with a viem `publicClient` pointed at `CELO_RPC` and
   `SOCIALCONNECT_REGISTRY_ADDRESS`.
3. Return `accounts[0]` (a `0x` address) if present, else `null`.
4. Keep the `try/catch` → on any error return `null` (sends must degrade to the
   DB lookup, never throw).

When this returns a real address, `routes/wallet.ts` already uses it as the
send destination — no other change needed.

> Tip: start by trusting only **your own issuer's** attestations (`[ISSUER]`).
> Resolving against *other* issuers means deciding whom to trust — do that later.

---

## 5. (Optional) Implement publishing (write path) — `publishAttestation()`

Only needed if you want **other** Celo apps to find your users by phone/email.

1. Verify the user owns the identifier first. S-PAY already gives you this:
   **email is confirmed** (Resend flow) and **phone is the P2P key**. Only
   attest verified identifiers.
2. Obfuscate via ODIS (as in §4), then call
   `FederatedAttestations.registerAttestationAsIssuer(obfuscatedId, userAddress, nowSeconds)`
   signed by the issuer key. Pay ODIS quota if prompted via `OdisPayments`
   (≈0.001 cUSD per attestation).
3. Call `publishAttestation()` from a money/verification action (e.g. right after
   `ensureUserWallet()` in `/wallet/add-funds`), best-effort — never fail the
   user action if it doesn't go through.

---

## 6. Install the SDK dependency

`@celo/identity` (and its peer `@celo/phone-number-privacy-common`) are needed
for the ODIS calls in §4/§5. Add them to the **api-server** package:

```bash
pnpm --filter @workspace/api-server add @celo/identity
```

> **Heads-up on supply-chain protection:** `pnpm-workspace.yaml` sets
> `minimumReleaseAge: 1440` (a package version must be ≥24h old to install). This
> is a security feature — **do not disable it**. If a brand-new release is
> blocked, pin to a slightly older published version instead.

Then `pnpm --filter @workspace/api-server run build` and redeploy.

---

## 7. Turn it on and test

1. `/admin/settings → SocialConnect` → toggle **ON**. (The row should show issuer
   keys **Configured** from §3.)
2. Test a send to a phone/email that is **registered on Celo but not an S-PAY
   member** — it should now resolve and send to that address.
3. Test a send to a random unknown phone/email — it should still say "No S-PAY
   member…" (no attestation found → `null` → 404, unchanged).
4. Watch Render logs for `SocialConnect` lines if a lookup misbehaves.

To roll back instantly: toggle the switch **OFF** (sends revert to DB-only
resolution). No deploy needed.

---

## 8. Costs & caveats

- **ODIS quota**: ~10 cUSD ≈ 10,000 identifier operations — cheap.
- **Gas**: each *published* attestation is one small Celo L2 transaction
  (sub-cent). Resolving (reading) is free.
- **This adds latency**: an ODIS round-trip + a chain read on the send path
  (only for non-members) — keep the timeout short and always fall back to DB.
- **Trust model**: you decide which issuers' attestations to honor. Honoring
  arbitrary issuers can let bad actors map a phone to a wrong address — start with
  your own issuer only.
- **It still doesn't reduce your WaaS bill.** Wallet custody/signing is unchanged.
