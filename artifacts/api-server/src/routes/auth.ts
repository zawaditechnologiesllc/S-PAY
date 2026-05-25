import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { DEMO_USER } from "../lib/mock-data";

const router = Router();

const usersStore = new Map<string, { id: string; email: string; passwordHash: string; fullName: string; phoneNumber?: string; kycStatus: string; celoWalletAddress?: string; createdAt: Date }>();

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;
    if (!email || !password || !fullName) {
      res.status(400).json({ error: "validation_error", message: "email, password, and fullName are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "validation_error", message: "Password must be at least 8 characters" });
      return;
    }
    if (usersStore.has(email)) {
      res.status(400).json({ error: "user_exists", message: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      fullName,
      phoneNumber,
      kycStatus: "pending",
      celoWalletAddress: undefined,
      createdAt: new Date(),
    };
    usersStore.set(email, user);

    const token = signToken({ userId: user.id, email });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber ?? null,
        kycStatus: user.kycStatus,
        celoWalletAddress: user.celoWalletAddress ?? null,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "internal_error", message: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "validation_error", message: "email and password are required" });
      return;
    }

    if (email === "demo@spayewallet.com" && password === "demo1234") {
      const token = signToken({ userId: DEMO_USER.id, email: DEMO_USER.email });
      res.json({
        token,
        user: {
          id: DEMO_USER.id,
          email: DEMO_USER.email,
          fullName: DEMO_USER.fullName,
          phoneNumber: DEMO_USER.phoneNumber,
          kycStatus: DEMO_USER.kycStatus,
          celoWalletAddress: DEMO_USER.celoWalletAddress,
          createdAt: DEMO_USER.createdAt.toISOString(),
        },
      });
      return;
    }

    const user = usersStore.get(email);
    if (!user) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber ?? null,
        kycStatus: user.kycStatus,
        celoWalletAddress: user.celoWalletAddress ?? null,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  const { userId, email } = req.user!;
  if (userId === DEMO_USER.id) {
    res.json({
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      fullName: DEMO_USER.fullName,
      phoneNumber: DEMO_USER.phoneNumber,
      kycStatus: DEMO_USER.kycStatus,
      celoWalletAddress: DEMO_USER.celoWalletAddress,
      createdAt: DEMO_USER.createdAt.toISOString(),
    });
    return;
  }
  const user = usersStore.get(email);
  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber ?? null,
    kycStatus: user.kycStatus,
    celoWalletAddress: user.celoWalletAddress ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
