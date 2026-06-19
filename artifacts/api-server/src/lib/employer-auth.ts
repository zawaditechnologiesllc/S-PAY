import { createHash, randomBytes } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { db, employersTable, employerApiKeysTable, type Employer, type EmployerApiKey } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Employer API-key authentication ─────────────────────────────────────────────
// Marketplaces call the payroll API with a secret key in the Authorization
// header (Bearer) or the X-API-Key header. We store only the SHA-256 hash, so
// the plaintext key is unrecoverable after creation — exactly like Stripe.
//
// Key format:  spk_live_<32 url-safe bytes>   (real money)
//              spk_test_<32 url-safe bytes>   (sandbox only)
// The prefix encodes the environment, so a leaked test key can never move
// production funds and the dashboard can show a recognisable, non-secret stub.

export interface GeneratedKey {
  plaintext: string; // returned to the caller exactly once
  prefix: string;    // stored + shown in the UI, e.g. "spk_live_a1b2c3d4"
  hash: string;      // stored; the only persisted form of the secret
}

export function generateApiKey(sandbox: boolean): GeneratedKey {
  const env = sandbox ? "test" : "live";
  const secret = randomBytes(24).toString("base64url"); // 32 url-safe chars
  const plaintext = `spk_${env}_${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 16), // "spk_live_xxxxxxx" — safe to display
    hash: hashApiKey(plaintext),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim()).digest("hex");
}

export function isSandboxKey(plaintext: string): boolean {
  return plaintext.startsWith("spk_test_");
}

export interface EmployerAuthContext {
  employer: Employer;
  apiKey: EmployerApiKey;
  sandbox: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      employerAuth?: EmployerAuthContext;
    }
  }
}

function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.trim()) return apiKeyHeader.trim();
  return null;
}

/**
 * Express middleware: authenticates an employer by API key and attaches
 * { employer, apiKey, sandbox } to the request. Verifies the key is not
 * revoked, not expired, and that its employer is not suspended. Optionally
 * enforces a required scope (e.g. "payroll:write").
 */
export function requireEmployer(requiredScope?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plaintext = extractKey(req);
      if (!plaintext) {
        res.status(401).json({ error: "unauthorized", message: "Provide your API key as a Bearer token or X-API-Key header." });
        return;
      }

      const [apiKey] = await db.select().from(employerApiKeysTable)
        .where(eq(employerApiKeysTable.keyHash, hashApiKey(plaintext))).limit(1);
      if (!apiKey) {
        res.status(401).json({ error: "invalid_key", message: "Unknown or malformed API key." });
        return;
      }
      if (apiKey.revokedAt) {
        res.status(401).json({ error: "key_revoked", message: "This API key has been revoked." });
        return;
      }
      if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
        res.status(401).json({ error: "key_expired", message: "This API key has expired." });
        return;
      }

      const scopes = Array.isArray(apiKey.scopes) ? (apiKey.scopes as string[]) : [];
      if (requiredScope && !scopes.includes(requiredScope)) {
        res.status(403).json({ error: "insufficient_scope", message: `This key is missing the "${requiredScope}" scope.` });
        return;
      }

      const [employer] = await db.select().from(employersTable)
        .where(eq(employersTable.id, apiKey.employerId)).limit(1);
      if (!employer) {
        res.status(401).json({ error: "invalid_key", message: "The employer for this key no longer exists." });
        return;
      }
      if (employer.status === "suspended") {
        res.status(403).json({ error: "employer_suspended", message: "This employer account is suspended. Contact S-PAY support." });
        return;
      }

      // Best-effort last-used stamp; never block a request on it.
      void db.update(employerApiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(employerApiKeysTable.id, apiKey.id))
        .catch(() => {});

      req.employerAuth = { employer, apiKey, sandbox: apiKey.sandbox };
      next();
    } catch (err) {
      req.log?.error({ err }, "Employer auth error");
      res.status(500).json({ error: "internal_error", message: "Authentication failed." });
    }
  };
}
