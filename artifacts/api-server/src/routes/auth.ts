import { Router } from "express";
import bcrypt from "bcryptjs";
import axios from "axios";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { generateToken, hashToken, sendVerificationEmail, sendPasswordResetEmail, generateLoginCode, sendLoginCodeEmail } from "../lib/email";
import { isValidPinFormat, hashPin } from "../lib/pin";
import { db, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

/** Sanitized acquisition channel, e.g. "jobs", "jobs:rv-123", "landing", "google", "mobile" */
function cleanSignupSource(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().slice(0, 64).replace(/[^\w:\-./]/g, "");
}

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:5000";

import { effectiveRole } from "../lib/admin-roles";

// ─── helpers ─────────────────────────────────────────────────────────────────

function userResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    spayId: u.spayId,
    email: u.email,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber ?? null,
    country: u.country ?? null,
    avatarUrl: u.avatarUrl ?? null,
    kycStatus: u.kycStatus,
    emailVerified: u.emailVerified,
    isAdmin: effectiveRole(u) !== null,
    adminRole: effectiveRole(u),
    hasPin: Boolean(u.transactionPinHash),
    celoWalletAddress: u.celoWalletAddress ?? null,
    accountType: u.accountType,
    businessName: u.businessName ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

// ─── Email / password register ────────────────────────────────────────────────

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body as Record<string, string>;

    if (!email || !password || !fullName) {
      res.status(400).json({ error: "validation_error", message: "email, password, and fullName are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "validation_error", message: "Password must be at least 8 characters" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const country = typeof body.country === "string" ? body.country.trim().slice(0, 56) : "";

    // Personal accounts verify with Noah KYC; business accounts verify the
    // business + its representative with Noah KYB and get business virtual accounts.
    const accountType = body.accountType === "business" ? "business" as const : "personal" as const;
    const businessName = typeof body.businessName === "string" ? body.businessName.trim().slice(0, 120) : "";
    if (accountType === "business" && !businessName) {
      res.status(400).json({ error: "validation_error", message: "businessName is required for business accounts" });
      return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "user_exists", message: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email,
      passwordHash,
      fullName,
      phoneNumber: phoneNumber || null,
      country: country || null,
      accountType,
      businessName: accountType === "business" ? businessName : null,
      signupSource: cleanSignupSource(body.signupSource) ?? "direct",
    }).returning();

    // Deliberately NO wallet-provider call here: signups/logins must never touch
    // the WaaS (it bills per monthly-active wallet user). The Celo wallet is
    // provisioned just-in-time by the first money action — see lib/wallet-providers.ts.

    // Soft email verification: fire-and-forget the confirmation email; the
    // account works immediately and the app shows a banner until confirmed.
    void issueVerificationEmail(user.id, user.email, user.fullName);

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({ token, user: userResponse(user) });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "internal_error", message: "Registration failed" });
  }
});

// ─── Email / password login ───────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as Record<string, string>;

    if (!email || !password) {
      res.status(400).json({ error: "validation_error", message: "email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "google_account", message: "This account uses Google sign-in. Please continue with Google." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
      return;
    }

    // Email MFA: a correct password is only the FIRST factor. Issue a 6-digit
    // code, email it, and withhold the session token until the code is verified
    // at /auth/verify-login-code. The login JWT is never returned here.
    const code = generateLoginCode();
    await db.update(usersTable)
      .set({
        loginVerificationCode: code,
        loginVerificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));
    void sendLoginCodeEmail(user.email, user.fullName, code);

    res.json({ requiresVerification: true, email: user.email });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

// ─── Email MFA: verify the 6-digit sign-in code (second factor) ───────────────

router.post("/auth/verify-login-code", async (req, res) => {
  try {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) {
      res.status(400).json({ error: "validation_error", message: "email and code are required" });
      return;
    }
    if (!/^[0-9]{6}$/.test(code)) {
      res.status(400).json({ error: "validation_error", message: "Enter the 6-digit code from your email." });
      return;
    }

    // Exact-match lookup, identical to /auth/login, so we always find the same
    // row the code was stored on (emails are persisted as entered).
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim())).limit(1);
    // Same generic answer whether the email is unknown or the code is wrong —
    // never reveal which accounts exist.
    const reject = () =>
      res.status(401).json({ error: "invalid_code", message: "That code is incorrect or has expired. Try signing in again." });

    if (!user || !user.loginVerificationCode || !user.loginVerificationExpires) {
      reject();
      return;
    }
    if (user.loginVerificationExpires < new Date()) {
      reject();
      return;
    }
    if (user.loginVerificationCode !== code) {
      reject();
      return;
    }

    // Single-use: clear the code so it can't be replayed.
    await db.update(usersTable)
      .set({ loginVerificationCode: null, loginVerificationExpires: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    req.log.error({ err }, "Verify login code error");
    res.status(500).json({ error: "internal_error", message: "Could not verify the code" });
  }
});

// ─── Current user ─────────────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    res.json(userResponse(user));
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch user" });
  }
});

// ─── Update profile ───────────────────────────────────────────────────────────
// Editable fields only (name, phone, country, business name, avatar). Email is
// immutable here (it's the login identity + KYC anchor). Every change is
// validated server-side, persisted to the users row, and stamps updatedAt so the
// record stays the single source of truth as the user adopts more features.

router.patch("/auth/me", requireAuth, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {};

    // fullName — required to be a non-empty name when present
    if (body.fullName !== undefined) {
      const name = typeof body.fullName === "string" ? body.fullName.trim() : "";
      if (name.length < 1 || name.length > 120) {
        res.status(400).json({ error: "validation_error", message: "Please enter your name (up to 120 characters)." });
        return;
      }
      updates.fullName = name;
    }

    // phoneNumber — nullable; trimmed; must be unique (it's the P2P send key)
    if (body.phoneNumber !== undefined) {
      const raw = body.phoneNumber === null ? "" : typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
      if (raw && !/^\+?[0-9 ()\-]{6,20}$/.test(raw)) {
        res.status(400).json({ error: "validation_error", message: "That phone number doesn't look right. Use digits, spaces, +, -, ( )." });
        return;
      }
      if (raw) {
        const [clash] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phoneNumber, raw)).limit(1);
        if (clash && clash.id !== user.id) {
          res.status(400).json({ error: "phone_in_use", message: "That phone number is already linked to another S-PAY account." });
          return;
        }
      }
      updates.phoneNumber = raw || null;
    }

    // country — nullable free text
    if (body.country !== undefined) {
      const c = body.country === null ? "" : typeof body.country === "string" ? body.country.trim().slice(0, 56) : "";
      updates.country = c || null;
    }

    // businessName — only meaningful for business accounts; required to stay set there
    if (body.businessName !== undefined) {
      const bn = body.businessName === null ? "" : typeof body.businessName === "string" ? body.businessName.trim().slice(0, 120) : "";
      if (user.accountType === "business" && !bn) {
        res.status(400).json({ error: "validation_error", message: "Business accounts need a business name." });
        return;
      }
      // Ignore on personal accounts so it can never silently flip account behavior
      if (user.accountType === "business") updates.businessName = bn;
    }

    // avatarUrl — nullable; only http(s) URLs (blocks javascript:/data: injection)
    if (body.avatarUrl !== undefined) {
      const a = body.avatarUrl === null ? "" : typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";
      if (a && (!/^https?:\/\//i.test(a) || a.length > 512)) {
        res.status(400).json({ error: "validation_error", message: "Avatar must be a valid http(s) image URL." });
        return;
      }
      updates.avatarUrl = a || null;
    }

    if (Object.keys(updates).length === 0) {
      res.json(userResponse(user));
      return;
    }

    updates.updatedAt = new Date();
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    req.log.info({ userId: user.id, fields: Object.keys(updates) }, "Profile updated");
    res.json(userResponse(updated));
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "internal_error", message: "Could not save your changes" });
  }
});

// ─── Account deletion (App Store 5.1.1(v) / Play "Account deletion" policy) ──

router.delete("/auth/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { transactionsTable, cardWaitlistTable } = await import("@workspace/db");
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await db.delete(cardWaitlistTable).where(eq(cardWaitlistTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    req.log.info({ userId }, "Account deleted at user request");
    res.json({ message: "Your account and all associated data have been permanently deleted." });
  } catch (err) {
    req.log.error({ err }, "Account deletion error");
    res.status(500).json({ error: "internal_error", message: "Failed to delete account" });
  }
});

// ─── Native mobile sign-in: Google (Android) & Apple (iOS) ───────────────────
// The apps send the ID token obtained on-device; we verify the signature
// against the provider's JWKS before trusting any claim in it.

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const GOOGLE_AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
].filter((v): v is string => !!v);

const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.zawaditechnologies.spay";

router.post("/auth/oauth/google", async (req, res) => {
  try {
    const { idToken, signupSource } = req.body as { idToken?: string; signupSource?: string };
    if (!idToken) {
      res.status(400).json({ error: "validation_error", message: "idToken is required" });
      return;
    }
    if (GOOGLE_AUDIENCES.length === 0) {
      res.status(503).json({ error: "not_configured", message: "Google sign-in is not configured" });
      return;
    }

    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: GOOGLE_AUDIENCES,
    });
    const googleId = String(payload.sub);
    const email = typeof payload.email === "string" ? payload.email : null;
    const name = typeof payload.name === "string" ? payload.name : "S-PAY User";
    const picture = typeof payload.picture === "string" ? payload.picture : null;
    if (!email) {
      res.status(401).json({ error: "invalid_token", message: "Google token has no email" });
      return;
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId)).limit(1);
    if (!user) {
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (byEmail) {
        [user] = await db.update(usersTable)
          .set({ googleId, avatarUrl: byEmail.avatarUrl ?? picture, updatedAt: new Date() })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
      } else {
        [user] = await db.insert(usersTable).values({
          email,
          fullName: name,
          googleId,
          avatarUrl: picture,
          passwordHash: null,
          signupSource: cleanSignupSource(signupSource) ?? "mobile",
        }).returning();
      }
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    req.log.warn({ err }, "Google token sign-in failed");
    res.status(401).json({ error: "invalid_token", message: "Google sign-in could not be verified" });
  }
});

router.post("/auth/oauth/apple", async (req, res) => {
  try {
    const { identityToken, fullName, signupSource } = req.body as {
      identityToken?: string; fullName?: string; signupSource?: string;
    };
    if (!identityToken) {
      res.status(400).json({ error: "validation_error", message: "identityToken is required" });
      return;
    }

    const { payload } = await jwtVerify(identityToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience: APPLE_BUNDLE_ID,
    });
    const appleId = String(payload.sub);
    const email = typeof payload.email === "string" ? payload.email : null;

    let [user] = await db.select().from(usersTable).where(eq(usersTable.appleId, appleId)).limit(1);
    if (!user && email) {
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (byEmail) {
        [user] = await db.update(usersTable)
          .set({ appleId, updatedAt: new Date() })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
      }
    }
    if (!user) {
      if (!email) {
        // Apple only includes the email claim on first authorization — ask the user to revoke & retry
        res.status(401).json({ error: "invalid_token", message: "Apple token has no email. Remove S-PAY from Settings → Apple ID → Sign-In & Security and try again." });
        return;
      }
      [user] = await db.insert(usersTable).values({
        email,
        fullName: fullName?.trim() || "S-PAY User",
        appleId,
        passwordHash: null,
        signupSource: cleanSignupSource(signupSource) ?? "mobile",
      }).returning();
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    req.log.warn({ err }, "Apple token sign-in failed");
    res.status(401).json({ error: "invalid_token", message: "Apple sign-in could not be verified" });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "not_configured", message: "Google sign-in is not configured" });
    return;
  }
  const redirectUri = `${API_BASE_URL}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  // Carry the acquisition source (e.g. ?source=jobs) through the OAuth round-trip
  const source = cleanSignupSource(req.query.source);
  if (source) params.set("state", source);
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${FRONTEND_URL}/login?error=google_cancelled`);
    return;
  }

  try {
    const redirectUri = `${API_BASE_URL}/api/auth/google/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await axios.post<{
      access_token: string;
      id_token: string;
    }>("https://oauth2.googleapis.com/token", {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    // Fetch user info from Google
    const infoRes = await axios.get<{
      sub: string;
      email: string;
      name: string;
      picture: string;
    }>("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const { sub: googleId, email, name, picture } = infoRes.data;

    // Find existing user by googleId or email; create if new
    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId)).limit(1);

    if (!user) {
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (byEmail) {
        // Link Google to existing email account
        [user] = await db.update(usersTable)
          .set({ googleId, avatarUrl: picture, updatedAt: new Date() })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
      } else {
        // Brand-new user via Google
        const stateSource = cleanSignupSource(req.query.state);
        [user] = await db.insert(usersTable).values({
          email,
          fullName: name,
          googleId,
          avatarUrl: picture,
          passwordHash: null,
          signupSource: stateSource ?? "google",
        }).returning();
      }
    }

    // No wallet call in the OAuth flow — provisioned lazily at first money action
    const token = signToken({ userId: user.id, email: user.email });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth error");
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

// ─── Email verification (soft — never blocks login) ──────────────────────────

async function issueVerificationEmail(userId: string, email: string, fullName: string): Promise<void> {
  try {
    const { token, hash } = generateToken();
    await db.update(usersTable)
      .set({ emailVerifyToken: hash, emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    const verifyUrl = `${API_BASE_URL}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, fullName, verifyUrl);
  } catch (err) {
    // Verification is best-effort; the resend button covers transient failures
    console.error("Verification email issue failed", err);
  }
}

// The link in the email lands here, then bounces to the app's success page
router.get("/auth/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.redirect(`${FRONTEND_URL}/auth/verified?status=invalid`);
    return;
  }
  try {
    const [user] = await db.update(usersTable)
      .set({ emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null, updatedAt: new Date() })
      .where(and(eq(usersTable.emailVerifyToken, hashToken(token)), gt(usersTable.emailVerifyExpires, new Date())))
      .returning({ id: usersTable.id });
    res.redirect(`${FRONTEND_URL}/auth/verified?status=${user ? "ok" : "invalid"}`);
  } catch (err) {
    req.log.error({ err }, "Email verification error");
    res.redirect(`${FRONTEND_URL}/auth/verified?status=error`);
  }
});

router.post("/auth/resend-verification", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    if (user.emailVerified) {
      res.json({ message: "Your email is already confirmed." });
      return;
    }
    await issueVerificationEmail(user.id, user.email, user.fullName);
    res.json({ message: "Confirmation email sent. Check your inbox (and spam folder)." });
  } catch (err) {
    req.log.error({ err }, "Resend verification error");
    res.status(500).json({ error: "internal_error", message: "Could not send the confirmation email" });
  }
});

// ─── Password reset ───────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "validation_error", message: "email is required" });
      return;
    }
    // Always answer the same way — never reveal whether an account exists
    const generic = { message: "If an account exists for that email, a reset link is on its way." };

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim())).limit(1);
    if (user?.passwordHash) {
      const { token, hash } = generateToken();
      await db.update(usersTable)
        .set({ passwordResetToken: hash, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
      await sendPasswordResetEmail(user.email, `${FRONTEND_URL}/reset-password?token=${token}`);
    }
    res.json(generic);
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    res.status(500).json({ error: "internal_error", message: "Could not process the request" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "validation_error", message: "Reset token is missing" });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "validation_error", message: "Password must be at least 8 characters" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.update(usersTable)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        // Following an emailed link proves inbox ownership
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        updatedAt: new Date(),
      })
      .where(and(eq(usersTable.passwordResetToken, hashToken(token)), gt(usersTable.passwordResetExpires, new Date())))
      .returning({ id: usersTable.id });
    if (!user) {
      res.status(400).json({ error: "invalid_token", message: "This reset link is invalid or has expired. Request a new one." });
      return;
    }
    res.json({ message: "Password updated. You can sign in with your new password now." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "internal_error", message: "Could not reset the password" });
  }
});

// ─── Transaction PIN (second factor on money actions) ────────────────────────

router.post("/auth/pin", requireAuth, async (req, res) => {
  try {
    const { pin, currentPin } = req.body as { pin?: unknown; currentPin?: unknown };
    if (!isValidPinFormat(pin)) {
      res.status(400).json({ error: "validation_error", message: "PIN must be 4–6 digits." });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    // Changing an existing PIN requires the current one (defends a stolen session)
    if (user.transactionPinHash) {
      if (!isValidPinFormat(currentPin) || !(await bcrypt.compare(currentPin, user.transactionPinHash))) {
        res.status(403).json({ error: "wrong_pin", message: "Your current PIN is incorrect." });
        return;
      }
    }
    await db.update(usersTable).set({
      transactionPinHash: await hashPin(pin),
      pinSetAt: new Date(),
      pinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));
    res.json({ message: user.transactionPinHash ? "PIN updated." : "PIN set — it's now required to send or withdraw." });
  } catch (err) {
    req.log.error({ err }, "Set PIN error");
    res.status(500).json({ error: "internal_error", message: "Could not save your PIN" });
  }
});

export default router;
