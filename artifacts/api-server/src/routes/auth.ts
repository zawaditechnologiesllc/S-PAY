import { Router } from "express";
import bcrypt from "bcryptjs";
import axios from "axios";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
// Where the browser lands after Google auth succeeds
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
// The public URL of this API server, used to build the Google redirect URI
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:5000";

// ─── helpers ─────────────────────────────────────────────────────────────────

function userResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber ?? null,
    avatarUrl: u.avatarUrl ?? null,
    kycStatus: u.kycStatus,
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
    }).returning();

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
        [user] = await db.insert(usersTable).values({
          email,
          fullName: name,
          googleId,
          avatarUrl: picture,
          passwordHash: null,
        }).returning();
      }
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth error");
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

export default router;
