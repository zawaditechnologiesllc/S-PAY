import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyToken } from "../lib/auth";
import { db, enquiriesTable } from "@workspace/db";

const router = Router();

// Public endpoint — modest rate limit keeps bots from flooding the inbox
const enquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

// One funnel for ALL enquiries: landing page, contact page, in-app help.
// Signed-in senders are linked automatically via their bearer token.
router.post("/enquiries", enquiryLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, source } = req.body as Record<string, unknown>;
    if (typeof email !== "string" || !/.+@.+\..+/.test(email)) {
      res.status(400).json({ error: "validation_error", message: "A valid email is required" });
      return;
    }
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "validation_error", message: "Please write a message" });
      return;
    }
    let userId: string | null = null;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try { userId = verifyToken(header.slice(7)).userId; } catch { /* anonymous is fine */ }
    }
    await db.insert(enquiriesTable).values({
      userId,
      name: typeof name === "string" ? name.trim().slice(0, 120) : null,
      email: email.trim().slice(0, 254),
      subject: typeof subject === "string" ? subject.trim().slice(0, 160) : null,
      message: message.trim().slice(0, 5000),
      source: typeof source === "string" ? source.trim().slice(0, 40) : "contact",
    });
    res.status(201).json({ message: "Thanks — we received your message and will reply by email." });
  } catch (err) {
    req.log.error({ err }, "Enquiry create error");
    res.status(500).json({ error: "internal_error", message: "Could not submit your message" });
  }
});

export default router;
