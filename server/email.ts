/**
 * Transactional email for account recovery.
 *
 * Provider-agnostic and secret-gated so it works with whatever the operator
 * configures without bundling a heavy SMTP client:
 *   - RESEND_API_KEY        → send via the Resend HTTP API
 *   - EMAIL_WEBHOOK_URL     → POST the message JSON to a relay (SMTP bridge, etc.)
 *   - neither               → no send; the caller keeps its log/dev-token fallback
 *
 * The recipient address is never logged.
 */

/** Keep in sync with resetTokenExpiry() in auth. */
export const RESET_EXPIRY_MIN = 60;

export type OutboundEmail = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailResult = { delivered: boolean; provider: "resend" | "webhook" | "none"; error?: string };

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "Sadhana <no-reply@sadhana.local>";
}

export function emailProvider(): "resend" | "webhook" | "none" {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.EMAIL_WEBHOOK_URL) return "webhook";
  return "none";
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

export function buildPasswordResetEmail(to: string, token: string): OutboundEmail {
  const subject = "Your Sadhana password reset code";
  const text =
    `Use this code to reset your Sadhana password:\n\n${token}\n\n` +
    `It expires in ${RESET_EXPIRY_MIN} minutes and can be used once. ` +
    `If you didn't request this, ignore this email — your password won't change.`;
  const html =
    `<p>Use this code to reset your Sadhana password:</p>` +
    `<p style="font-size:22px;font-weight:600;letter-spacing:3px">${escapeHtml(token)}</p>` +
    `<p>It expires in ${RESET_EXPIRY_MIN} minutes and can be used once. ` +
    `If you didn't request this, ignore this email — your password won't change.</p>`;
  return { to, from: emailFrom(), subject, text, html };
}

export async function sendEmail(msg: OutboundEmail): Promise<EmailResult> {
  const provider = emailProvider();
  try {
    if (provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: msg.from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      if (!res.ok) return { delivered: false, provider, error: `Resend responded ${res.status}` };
      return { delivered: true, provider };
    }
    if (provider === "webhook") {
      const res = await fetch(process.env.EMAIL_WEBHOOK_URL as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      if (!res.ok) return { delivered: false, provider, error: `Webhook responded ${res.status}` };
      return { delivered: true, provider };
    }
    return { delivered: false, provider: "none" };
  } catch (e) {
    return { delivered: false, provider, error: (e as Error).message };
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<EmailResult> {
  return sendEmail(buildPasswordResetEmail(to, token));
}
