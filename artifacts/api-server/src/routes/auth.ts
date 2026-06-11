import { Router } from "express";
import bcrypt from "bcryptjs";
import axios from "axios";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { ensureCeloWallet } from "../lib/celo";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "admin@spayewallet.com")
  .split(",").map((e) => e.trim().toLowerCase());

// ─── helpers ─────────────────────────────────────────────────────────────────

function userResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber ?? null,
    avatarUrl: u.avatarUrl ?? null,
    kycStatus: u.kycStatus,
    isAdmin: ADMIN_EMAILS.includes(u.email.toLowerCase()),
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

    // MiniPay-style onboarding: Celo wallet provisioned instantly in the background
    ensureCeloWallet(user.id, user.celoWalletAddress);

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

    // Backfill the Celo wallet for accounts created before Privy was configured
    ensureCeloWallet(user.id, user.celoWalletAddress);

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

    ensureCeloWallet(user.id, user.celoWalletAddress);
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

    ensureCeloWallet(user.id, user.celoWalletAddress);
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

    // MiniPay-style onboarding: Celo wallet provisioned instantly in the background
    ensureCeloWallet(user.id, user.celoWalletAddress);

    const token = signToken({ userId: user.id, email: user.email });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth error");
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

export default router;
