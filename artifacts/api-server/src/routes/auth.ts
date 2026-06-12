import { Router } from "express";
import bcrypt from "bcryptjs";
import axios from "axios";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { generateToken, hashToken, sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
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
    email: u.email,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber ?? null,
    avatarUrl: u.avatarUrl ?? null,
    kycStatus: u.kycStatus,
    emailVerified: u.emailVerified,
    isAdmin: effectiveRole(u) !== null,
    adminRole: effectiveRole(u),
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

    // No wallet call on login either — wallets are provisioned (or backfilled)
    // lazily by the first money action, so jobs-only traffic costs zero WaaS MAUs.
    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
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

export default router;
