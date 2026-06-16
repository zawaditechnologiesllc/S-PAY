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

async function sendEmail(to: string, subject: string, html: string, text: string, actionUrl: string): Promise<void> {
  if (!isEmailConfigured()) {
    logger.info({ to, subject, actionUrl }, "Email service not configured (set RESEND_API_KEY) — link logged instead of emailed");
    return;
  }
  try {
    // Sending both html + text lifts deliverability (lower spam score) and
    // covers plain-text mail clients.
    await axios.post(
      "https://api.resend.com/emails",
      { from: EMAIL_FROM, to: [to], subject, html, text },
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

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * One branded, email-client-safe template for every transactional email.
 * Table-based layout + inline styles so it renders consistently in Gmail,
 * Apple Mail, Outlook and mobile clients. S-PAY brand: navy #1A2B4A,
 * cyan #4DC9EE.
 */
const wrap = (opts: {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
}) => {
  const { title, preheader, bodyHtml, ctaLabel, ctaUrl, footerNote } = opts;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background-color:#1A2B4A;padding:26px 32px;">
            <div style="font-family:${FONT};font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1;">S-PAY</div>
            <div style="font-family:${FONT};font-size:12px;font-weight:600;color:#4DC9EE;margin-top:4px;">Digital Wallet</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:${FONT};color:#1A2B4A;">
            <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#1A2B4A;">${title}</h1>
            ${bodyHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td align="center" style="border-radius:12px;background-color:#4DC9EE;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${ctaLabel}</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;color:#64748b;line-height:1.5;margin:0 0 4px;">Or paste this link into your browser:</p>
            <p style="font-size:13px;margin:0;"><a href="${ctaUrl}" style="color:#2E8FD6;word-break:break-all;">${ctaUrl}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
            <p style="font-family:${FONT};font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
              ${footerNote ?? "If you didn't request this, you can safely ignore this email — your account stays unchanged."}<br>
              © ${year} S-PAY · Zawadi Technologies LLC · Built on Celo
            </p>
          </td>
        </tr>
      </table>
      <p style="font-family:${FONT};font-size:11px;color:#94a3b8;margin:16px 0 0;">Digital money for the world's remote workers.</p>
    </td>
  </tr>
</table>
</body>
</html>`;
};

const plain = (lines: string[], ctaLabel: string, ctaUrl: string) =>
  `S-PAY — Digital Wallet\n\n${lines.join("\n\n")}\n\n${ctaLabel}:\n${ctaUrl}\n\nIf you didn't request this, you can safely ignore this email.\n© ${new Date().getFullYear()} S-PAY · Zawadi Technologies LLC`;

export async function sendVerificationEmail(to: string, fullName: string, verifyUrl: string): Promise<void> {
  const firstName = fullName.split(" ")[0] || "there";
  await sendEmail(
    to,
    "Confirm your email — S-PAY",
    wrap({
      title: `Welcome to S-PAY, ${firstName}!`,
      preheader: "Confirm your email to secure your S-PAY account.",
      bodyHtml: `<p style="font-size:15px;line-height:1.6;margin:0;color:#334155;">Thanks for joining S-PAY. Confirm your email address to secure your account and unlock everything — wallets, transfers and the jobs board. This link is valid for <strong>24 hours</strong>.</p>`,
      ctaLabel: "Confirm my email",
      ctaUrl: verifyUrl,
    }),
    plain(
      [`Welcome to S-PAY, ${firstName}!`, "Confirm your email address to secure your account. This link is valid for 24 hours."],
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
    wrap({
      title: "Reset your password",
      preheader: "Use this link to choose a new S-PAY password (valid 1 hour).",
      bodyHtml: `<p style="font-size:15px;line-height:1.6;margin:0;color:#334155;">We received a request to reset your S-PAY password. Choose a new one using the button below — the link is valid for <strong>1 hour</strong>.</p>`,
      ctaLabel: "Choose a new password",
      ctaUrl: resetUrl,
      footerNote: "If you didn't request a password reset, you can safely ignore this email — your password stays the same.",
    }),
    plain(
      ["We received a request to reset your S-PAY password.", "Use the link below to choose a new one. It's valid for 1 hour."],
      "Choose a new password",
      resetUrl,
    ),
    resetUrl,
  );
}
