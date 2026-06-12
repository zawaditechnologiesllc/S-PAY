import axios from "axios";
import crypto from "node:crypto";
import { logger } from "./logger";

/**
 * Transactional email via Resend (resend.com) — plain REST, no SDK.
 * Set RESEND_API_KEY to activate; EMAIL_FROM controls the sender identity
 * (verify your domain in Resend, then use e.g. "S-PAY <noreply@spayewallet.com>").
 *
 * When unconfigured every send is a logged no-op that INCLUDES the action link,
 * so an admin can copy it from the Render logs while email is being set up —
 * sign-up and password reset never hard-fail on a missing provider.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "S-PAY <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

async function sendEmail(to: string, subject: string, html: string, actionUrl: string): Promise<void> {
  if (!isEmailConfigured()) {
    logger.info({ to, subject, actionUrl }, "Email service not configured (set RESEND_API_KEY) — link logged instead of emailed");
    return;
  }
  try {
    await axios.post(
      "https://api.resend.com/emails",
      { from: EMAIL_FROM, to: [to], subject, html },
      { timeout: 10000, headers: { Authorization: `Bearer ${RESEND_API_KEY}` } },
    );
    logger.info({ to, subject }, "Email sent");
  } catch (err) {
    logger.warn({ err, to, subject, actionUrl }, "Email send failed — link logged so the action can still be completed");
  }
}

/** Random URL-safe token; only its sha256 lands in the database. */
export function generateToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const wrap = (title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string) => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1A2B4A">
    <div style="font-size:22px;font-weight:800;margin-bottom:4px">S-PAY</div>
    <div style="font-size:12px;color:#4DC9EE;font-weight:600;margin-bottom:24px">Digital Wallet</div>
    <h2 style="font-size:18px;margin:0 0 12px">${title}</h2>
    ${bodyHtml}
    <a href="${ctaUrl}" style="display:inline-block;background:#4DC9EE;color:#fff;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:12px;margin:20px 0">${ctaLabel}</a>
    <p style="font-size:12px;color:#6b7280">Or paste this link into your browser:<br><a href="${ctaUrl}" style="color:#2E8FD6;word-break:break-all">${ctaUrl}</a></p>
    <p style="font-size:11px;color:#9ca3af;margin-top:28px">If you didn't request this, you can safely ignore this email.<br>© S-PAY · Zawadi Technologies LLC</p>
  </div>`;

export async function sendVerificationEmail(to: string, fullName: string, verifyUrl: string): Promise<void> {
  await sendEmail(
    to,
    "Confirm your email — S-PAY",
    wrap(
      `Welcome to S-PAY, ${fullName.split(" ")[0]}!`,
      `<p style="font-size:14px;line-height:1.6">Confirm your email address to secure your account. This link is valid for 24 hours.</p>`,
      "Confirm my email",
      verifyUrl,
    ),
    verifyUrl,
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail(
    to,
    "Reset your S-PAY password",
    wrap(
      "Reset your password",
      `<p style="font-size:14px;line-height:1.6">We received a request to reset your S-PAY password. The link below is valid for 1 hour.</p>`,
      "Choose a new password",
      resetUrl,
    ),
    resetUrl,
  );
}
