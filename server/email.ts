/**
 * Transactional email — Resend when RESEND_API_KEY is set, else optional
 * EMAIL_WEBHOOK_URL POST, else structured console log (dev / demos).
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Tag for logs / webhooks / Resend (verify, welcome, cancel_confirm, …). */
  kind: string;
};

export type SendEmailResult = {
  sent: boolean;
  mode: "resend" | "webhook" | "log";
  id?: string;
  error?: string;
};

/** Compatibility shape used by subscription-compliance helpers. */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
};

export type EmailResult = {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
};

/** Thin adapter for billingCompliance — same transport as sendAppEmail. */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const r = await sendAppEmail({
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    kind: msg.kind,
  });
  if (r.error && r.mode !== "log" && !r.sent) {
    return { ok: false, error: r.error, id: r.id };
  }
  return {
    ok: r.sent || r.mode === "log",
    id: r.id,
    skipped: r.mode === "log" && !r.sent,
    error: r.error,
  };
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Sadhana <onboarding@resend.dev>";
}

/** True when Resend or a webhook can actually deliver mail (not console-only). */
export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() || process.env.EMAIL_WEBHOOK_URL?.trim());
}

export function appBaseUrl(): string {
  if (process.env.PUBLIC_APP_URL?.trim()) {
    return process.env.PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }
  return process.env.NODE_ENV === "production"
    ? "https://sadhana-ou9m.onrender.com"
    : "http://localhost:5000";
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase() || "USD",
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export function formatAccessDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function wrapHtml(body: string): string {
  return `<div style="font-family:Georgia,serif;line-height:1.5;color:#1a2e28;max-width:560px">${body}<p style="color:#667;font-size:12px;margin-top:24px">Sadhana — guided yoga practice</p></div>`;
}

export async function sendAppEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { sent: false, mode: "log", error: "No recipient email" };
  }
  const html = input.html ?? input.text.replace(/\n/g, "<br/>");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [to],
          subject: input.subject,
          text: input.text,
          html,
          tags: [{ name: "kind", value: input.kind }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[email] Resend failed ${res.status}: ${body.slice(0, 300)}`);
      } else {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { sent: true, mode: "resend", id: data.id };
      }
    } catch (err) {
      console.error("[email] Resend request error", err);
    }
  }

  const webhook = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from: fromAddress(),
          subject: input.subject,
          text: input.text,
          html,
          kind: input.kind,
        }),
      });
      if (res.ok) {
        return { sent: true, mode: "webhook", id: `webhook-${Date.now()}` };
      }
      console.error(`[email] webhook failed ${res.status}`);
    } catch (err) {
      console.error("[email] webhook request error", err);
    }
  }

  console.info(`[email:${input.kind}] to=${to} subject=${JSON.stringify(input.subject)}\n${input.text}`);
  return { sent: false, mode: "log", id: `log-${Date.now()}` };
}

// ---- Auth ----

export async function sendVerificationEmail(opts: {
  to: string;
  token: string;
}): Promise<SendEmailResult> {
  const link = `${appBaseUrl()}/verify?token=${encodeURIComponent(opts.token)}&email=${encodeURIComponent(opts.to)}`;
  const text = [
    "Welcome to Sadhana.",
    "",
    "Confirm your email to finish creating your account:",
    link,
    "",
    "Or enter this verification code on the Verify page:",
    opts.token,
    "",
    "This link expires in 48 hours. If you did not create an account, you can ignore this message.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "verify",
    subject: "Verify your Sadhana email",
    text,
    html: wrapHtml(
      `<p>Welcome to Sadhana.</p><p><a href="${escapeAttr(link)}">Confirm your email</a> to finish creating your account.</p><p>Or enter this code on the Verify page:</p><p><code>${escapeHtml(opts.token)}</code></p><p style="color:#667;font-size:13px">This link expires in 48 hours.</p>`,
    ),
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  displayName?: string | null;
}): Promise<SendEmailResult> {
  const name = opts.displayName?.trim() || "friend";
  const home = `${appBaseUrl()}/`;
  const text = [
    `Hi ${name},`,
    "",
    "Your Sadhana email is verified and your account is ready.",
    "Your practice — streaks, journal, and saved sequences — can sync across devices.",
    "",
    `Start here: ${home}`,
    "",
    "Welcome.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "welcome",
    subject: "Welcome to Sadhana",
    text,
    html: wrapHtml(
      `<p>Hi ${escapeHtml(name)},</p><p>Your email is verified and your account is ready. Streaks, journal, and saved sequences can sync across devices.</p><p><a href="${escapeAttr(home)}">Open Sadhana</a></p>`,
    ),
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  token: string;
}): Promise<SendEmailResult> {
  const link = `${appBaseUrl()}/account?reset=1&email=${encodeURIComponent(opts.to)}`;
  const text = [
    "Reset your Sadhana password.",
    "",
    `Open ${link} and enter this reset code:`,
    opts.token,
    "",
    "The code expires in 60 minutes. If you did not request a reset, you can ignore this message.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "password_reset",
    subject: "Reset your Sadhana password",
    text,
    html: wrapHtml(
      `<p>Reset your Sadhana password.</p><p><a href="${escapeAttr(link)}">Open Account → Reset</a> and enter this code:</p><p><code>${escapeHtml(opts.token)}</code></p><p style="color:#667;font-size:13px">Expires in 60 minutes.</p>`,
    ),
  });
}

export async function sendPasswordChangedEmail(opts: {
  to: string;
}): Promise<SendEmailResult> {
  const account = `${appBaseUrl()}/account`;
  const text = [
    "Your Sadhana password was changed.",
    "",
    "If you made this change, no action is needed.",
    `If you did not, reset it immediately: ${account}`,
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "password_changed",
    subject: "Your Sadhana password was changed",
    text,
    html: wrapHtml(
      `<p>Your Sadhana password was changed.</p><p>If you made this change, no action is needed. If you did not, <a href="${escapeAttr(account)}">reset it immediately</a>.</p>`,
    ),
  });
}

export async function sendAccountDeletedEmail(opts: {
  to: string;
}): Promise<SendEmailResult> {
  const text = [
    "Your Sadhana account and synced practice data were deleted.",
    "",
    "Guest practice on a device may still exist locally until you clear that browser.",
    "If you did not request this, reply to this email so we can help.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "account_deleted",
    subject: "Your Sadhana account was deleted",
    text,
    html: wrapHtml(
      `<p>Your Sadhana account and synced practice data were deleted.</p><p style="color:#667;font-size:13px">Guest practice on a device may still exist locally until you clear that browser.</p>`,
    ),
  });
}

// ---- Billing ----

export async function sendSubscriptionStartedEmail(opts: {
  to: string;
  plan: string;
  manageUrl: string;
}): Promise<SendEmailResult> {
  const plan = opts.plan || "plus";
  const text = [
    `Your Sadhana ${plan} subscription is active.`,
    "",
    "Thank you for supporting the practice.",
    `Manage or cancel anytime: ${opts.manageUrl}`,
    "",
    "No dark patterns — cancel in the app or Stripe portal whenever you like.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "subscription_started",
    subject: `Sadhana ${plan} is active`,
    text,
    html: wrapHtml(
      `<p>Your <strong>Sadhana ${escapeHtml(plan)}</strong> subscription is active.</p><p>Thank you for supporting the practice.</p><p><a href="${escapeAttr(opts.manageUrl)}">Manage subscription</a></p>`,
    ),
  });
}

export async function sendCancelConfirmationEmail(opts: {
  to: string;
  plan: string;
  accessUntil?: string | null;
  manageUrl: string;
}): Promise<SendEmailResult> {
  const when = opts.accessUntil ? formatAccessDate(opts.accessUntil) : "the end of your paid period";
  const subject = opts.accessUntil
    ? `Sadhana subscription canceled — access until ${when}`
    : "Sadhana subscription canceled";
  const text = [
    "Your Sadhana subscription is canceled.",
    "",
    `You keep full access until ${when}.`,
    "No further charges will be made.",
    "",
    `Details: ${opts.manageUrl}`,
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "cancel_confirm",
    subject,
    text,
    html: wrapHtml(
      `<p>Your <strong>Sadhana ${escapeHtml(opts.plan)}</strong> subscription is canceled.</p><p>You keep full access until <strong>${escapeHtml(when)}</strong>.</p><p>No further charges will be made.</p><p><a href="${escapeAttr(opts.manageUrl)}">Cancellation details</a></p>`,
    ),
  });
}

export async function sendRenewalReminderEmail(opts: {
  to: string;
  plan: string;
  amount?: number;
  currency?: string;
  chargeDate: string;
  manageUrl: string;
}): Promise<SendEmailResult> {
  const when = formatAccessDate(opts.chargeDate);
  const money =
    opts.amount != null && opts.currency
      ? formatMoney(opts.amount, opts.currency)
      : null;
  const subject = money
    ? `Reminder: Sadhana renews ${when} for ${money}`
    : `Reminder: Sadhana renews ${when}`;
  const text = [
    "This is your renewal reminder (sent a few days before the next charge).",
    "",
    `Plan: Sadhana ${opts.plan}`,
    money ? `Amount: ${money}` : null,
    `Charge date: ${when}`,
    "",
    `Manage or cancel: ${opts.manageUrl}`,
    "",
    "If you do nothing, your subscription renews on the charge date.",
  ]
    .filter(Boolean)
    .join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "renewal_reminder",
    subject,
    text,
    html: wrapHtml(
      `<p>This is your <strong>renewal reminder</strong> — a few days before the next charge.</p><ul><li>Plan: Sadhana ${escapeHtml(opts.plan)}</li>${money ? `<li>Amount: <strong>${escapeHtml(money)}</strong></li>` : ""}<li>Charge date: <strong>${escapeHtml(when)}</strong></li></ul><p><a href="${escapeAttr(opts.manageUrl)}">Manage or cancel</a></p>`,
    ),
  });
}

export async function sendPaymentFailedEmail(opts: {
  to: string;
  plan: string;
  manageUrl: string;
}): Promise<SendEmailResult> {
  const text = [
    `We could not process the latest payment for Sadhana ${opts.plan}.`,
    "",
    "Update your payment method to keep Plus/Coach features uninterrupted:",
    opts.manageUrl,
    "",
    "Core practice stays free either way.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "payment_failed",
    subject: "Sadhana payment needs attention",
    text,
    html: wrapHtml(
      `<p>We could not process the latest payment for <strong>Sadhana ${escapeHtml(opts.plan)}</strong>.</p><p><a href="${escapeAttr(opts.manageUrl)}">Update payment method</a></p><p style="color:#667;font-size:13px">Core practice stays free either way.</p>`,
    ),
  });
}

export async function sendRefundConfirmationEmail(opts: {
  to: string;
  amount: number;
  currency: string;
}): Promise<SendEmailResult> {
  const money = formatMoney(opts.amount, opts.currency);
  const text = [
    `Your Sadhana refund of ${money} was approved.`,
    "It typically appears on your statement within 5–10 business days.",
  ].join("\n");
  return sendAppEmail({
    to: opts.to,
    kind: "refund_confirm",
    subject: `Sadhana refund approved — ${money}`,
    text,
    html: wrapHtml(
      `<p>Your Sadhana refund of <strong>${escapeHtml(money)}</strong> was approved.</p><p>It typically appears on your statement within 5–10 business days.</p>`,
    ),
  });
}
