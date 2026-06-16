import { logger } from "./logger";
import { getSocialConnect } from "./settings";

/**
 * Celo SocialConnect — optional, additive identity layer.
 *
 * SocialConnect is a DECENTRALIZED DIRECTORY that maps off-chain identifiers
 * (phone numbers, emails) to on-chain Celo addresses, with phone-number privacy
 * provided by ODIS. It is NOT a wallet provider and does NOT replace the WaaS
 * layer (which holds keys and signs) — see docs/SOCIALCONNECT.md.
 *
 * What it adds to S-PAY: a send to a phone/email can reach someone who isn't an
 * S-PAY member yet, by resolving the identifier through the shared on-chain
 * registry instead of only S-PAY's own users table. It also lets other Celo
 * apps (MiniPay, Valora…) find S-PAY users by phone/email if we publish
 * attestations for them.
 *
 * SAFETY / ROLLOUT: this module is a no-op until BOTH (a) the issuer env keys
 * are set and (b) the admin flips the SocialConnect switch on. Until then,
 * `resolveByIdentifier` returns null and callers fall back to the in-DB lookup,
 * so existing behavior is unchanged. The actual ODIS query + on-chain calls are
 * intentionally left as two clearly-marked functions to complete slowly — the
 * step-by-step is in docs/SOCIALCONNECT.md.
 */

// ── Configuration (env) ───────────────────────────────────────────────────────
// The issuer is the S-PAY account that vouches for "this phone/email belongs to
// this address". It signs ODIS quota requests and on-chain attestations.
const ISSUER_ADDRESS = process.env.SOCIALCONNECT_ISSUER_ADDRESS?.trim() ?? "";
const ISSUER_PRIVATE_KEY = process.env.SOCIALCONNECT_ISSUER_PRIVATE_KEY?.trim() ?? "";

// FederatedAttestations registry. Defaults can be overridden per-network; ALWAYS
// confirm the current Celo L2 address before going live (see docs/SOCIALCONNECT.md §2).
export const SOCIALCONNECT_REGISTRY_ADDRESS =
  process.env.SOCIALCONNECT_REGISTRY_ADDRESS?.trim() ?? "";

export type IdentifierType = "phone" | "email";

/** True when the issuer credentials are present (independent of the on/off switch). */
export function isSocialConnectConfigured(): boolean {
  return Boolean(ISSUER_ADDRESS && ISSUER_PRIVATE_KEY);
}

/** True only when configured AND the admin switch is on. */
export async function isSocialConnectActive(): Promise<boolean> {
  if (!isSocialConnectConfigured()) return false;
  try {
    return (await getSocialConnect()).enabled === true;
  } catch {
    return false;
  }
}

// ── Resolution: identifier → address ──────────────────────────────────────────
/**
 * Resolve an off-chain identifier (phone/email) to a Celo address via the
 * SocialConnect registry. Returns null when the feature is inactive OR when no
 * attestation exists — callers MUST treat null as "not found here" and fall back
 * to the in-DB lookup, so this can never break existing sends.
 *
 * TODO(socialconnect §4) — implement with `@celo/identity` + viem:
 *   1. Obtain the obfuscated identifier: query ODIS for the pepper
 *      (OdisUtils.Identifier.getObfuscatedIdentifier) using the issuer as the
 *      authentication signer; this is the privacy step.
 *   2. Read the registry: FederatedAttestations.lookupAttestations(
 *        obfuscatedId, [ISSUER_ADDRESS]) via a viem publicClient on Celo.
 *   3. Return the first attested `accounts[0]` (a 0x address) or null.
 * Keep the try/catch — a registry/ODIS hiccup must degrade to the DB lookup,
 * never throw into the send path.
 */
export async function resolveByIdentifier(
  identifier: string,
  type: IdentifierType,
): Promise<string | null> {
  if (!(await isSocialConnectActive())) return null;
  try {
    // Not yet wired — see the TODO above and docs/SOCIALCONNECT.md §4.
    logger.info(
      { type },
      "SocialConnect is ON but the resolver isn't wired yet — falling back to the in-DB lookup",
    );
    return null;
  } catch (err) {
    logger.warn({ err, type }, "SocialConnect lookup failed — falling back to the in-DB lookup");
    return null;
  }
}

// ── Publishing: address → identifier attestation ──────────────────────────────
/**
 * Publish an attestation so OTHER Celo apps can find this S-PAY user by their
 * phone/email. No-op until active. Best-effort: callers should never fail a
 * user action because publishing didn't go through.
 *
 * TODO(socialconnect §5) — implement with `@celo/identity` + viem:
 *   1. Verify the user actually owns the identifier (we already do: email is
 *      confirmed via Resend, phone is the P2P key) before attesting.
 *   2. Get the obfuscated identifier from ODIS (as in resolveByIdentifier).
 *   3. Send FederatedAttestations.registerAttestationAsIssuer(obfuscatedId,
 *      address, nowSeconds) signed by the issuer key; pay ODIS quota if needed
 *      (OdisPayments) — costs ~0.001 cUSD/attestation.
 */
export async function publishAttestation(
  identifier: string,
  type: IdentifierType,
  address: string,
): Promise<void> {
  if (!(await isSocialConnectActive())) return;
  try {
    // Not yet wired — see the TODO above and docs/SOCIALCONNECT.md §5.
    logger.info({ type, address }, "SocialConnect is ON but attestation publishing isn't wired yet");
  } catch (err) {
    logger.warn({ err, type }, "SocialConnect attestation publish failed (non-fatal)");
  }
}
