import jwt from "jsonwebtoken";
import crypto from "node:crypto";

// Fail closed in production: a session-signing key must never fall back to a
// published default, or anyone reading the source can mint valid sessions.
// Dev/test keeps a fixed local secret; production without JWT_SECRET refuses
// to boot (set it on Render: `openssl rand -hex 32`).
const envSecret = process.env.JWT_SECRET;
if (!envSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production — refusing to start with the built-in dev secret. Generate one with: openssl rand -hex 32");
}
const JWT_SECRET = envSecret ?? "spay-dev-secret-change-in-production";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/** SHA-256 hex of a short-lived credential (login codes) — never store plaintext. */
export function hashLoginCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
