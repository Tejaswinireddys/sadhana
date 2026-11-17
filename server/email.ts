import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { publicAppOrigin } from "./publicUrl";

/**
 * Transactional email — SMTP (incl. Gmail App Password) when configured, else
 * Resend when RESEND_API_KEY is set, else optional EMAIL_WEBHOOK_URL POST,
 * else structured console log (dev / demos).
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Tag for logs / webhooks / Resend (verify, welcome, cancel_confirm, …). */
  kind: string;
};

export type EmailTransportMode = "smtp" | "resend" | "webhook" | "log";

/** Public mail-status provider — never includes credentials or addresses. */
export type MailProvider = "smtp" | "resend" | "webhook" | "none";

export type SendEmailResult = {
  sent: boolean;
  mode: EmailTransportMode;
  id?: string;
  error?: string;
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
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

const SMTP_TIMEOUT_MS = 8_000;
/** Whole send, including a hung SMTP socket or a Resend request that never returns. */
const SEND_DEADLINE_MS = 8_000;

/**
 * Resolve `work`, or `fallback` if it is still pending after `ms`.
 * Password reset waits on this. The browser gives up at 15s, so a provider
 * that never answers must not be allowed to run that long.
 */
export function settleWithin<T>(ms: number, work: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

let smtpTransporter: Transporter | null = null;
let smtpTransporterKey: string | null = null;

/** Test hook: replace SMTP sendMail without opening a real socket. */
let smtpSendMailForTests:
  | ((mail: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }) => Promise<{ messageId?: string }>)
  | null = null;

function closeSmtpTransporter(): void {
  if (smtpTransporter && typeof smtpTransporter.close === "function") {
    try {
      smtpTransporter.close();
    } catch {
      /* ignore */
    }
  }
  smtpTransporter = null;
  smtpTransporterKey = null;
}

/** @internal Reset pooled transporter and SMTP test overrides between tests. */
export function __resetSmtpTransporterForTests(): void {
  closeSmtpTransporter();
  smtpSendMailForTests = null;
}

/** @internal Inject a fake SMTP send for unit tests (no network). */
export function __setSmtpSendMailForTests(
  fn: typeof smtpSendMailForTests,
): void {
  smtpSendMailForTests = fn;
}

/**
 * Resolve SMTP settings. `GMAIL_USER` + `GMAIL_APP_PASSWORD` is a shortcut for
 * smtp.gmail.com:465 with TLS. Explicit `SMTP_*` wins when `SMTP_HOST` is set.
 */
export function resolveSmtpConfig(
  env: Record<string, string | undefined> = process.env,
): SmtpConfig | null {
  const smtpHost = env.SMTP_HOST?.trim();
  if (smtpHost) {
    const user = env.SMTP_USER?.trim();
    const pass = env.SMTP_PASS?.trim();
    if (!user || !pass) return null;
    const portRaw = env.SMTP_PORT?.trim();
    const port = portRaw ? Number(portRaw) : 465;
    if (!Number.isFinite(port) || port <= 0) return null;
    const secureRaw = env.SMTP_SECURE?.trim().toLowerCase();
    const secure =
      secureRaw === undefined || secureRaw === ""
        ? port === 465
        : !(secureRaw === "0" || secureRaw === "false" || secureRaw === "no");
    return { host: smtpHost, port, secure, user, pass };
  }

  const gmailUser = env.GMAIL_USER?.trim();
  const gmailPass = env.GMAIL_APP_PASSWORD?.trim();
  if (gmailUser && gmailPass) {
    return {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: gmailUser,
      pass: gmailPass,
    };
  }
  return null;
}

/**
 * Highest-precedence configured transport. Used by `/api/auth/mail-status`
 * and `emailDeliveryConfigured`. Order: SMTP/Gmail → Resend → webhook.
 */
export function resolveMailProvider(
  env: Record<string, string | undefined> = process.env,
): MailProvider {
  if (resolveSmtpConfig(env)) return "smtp";
  if (env.RESEND_API_KEY?.trim()) return "resend";
  if (env.EMAIL_WEBHOOK_URL?.trim()) return "webhook";
  return "none";
}

/** Payload for GET /api/auth/mail-status — no secrets, no from-address. */
export function mailStatusPayload(
  env: Record<string, string | undefined> = process.env,
): {
  emailEnabled: boolean;
  provider: MailProvider;
  deliverable: boolean;
  requireVerification: boolean;
} {
  const provider = resolveMailProvider(env);
  return {
    emailEnabled: provider !== "none",
    provider,
    deliverable: emailReallyDeliverable(env),
    requireVerification: requireEmailVerification(env),
  };
}

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

/**
 * From-address for outbound mail. Explicit `EMAIL_FROM` wins. When SMTP/Gmail
 * is active and EMAIL_FROM is unset, default to `Sadhana <user>` — Gmail
 * rewrites any other From to the authenticated account anyway.
 */
export function fromAddress(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  const smtp = resolveSmtpConfig(env);
  if (smtp) return `Sadhana <${smtp.user}>`;
  return "Sadhana <onboarding@resend.dev>";
}

/** True when SMTP, Resend, or a webhook can actually deliver mail (not console-only). */
export function emailDeliveryConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return resolveMailProvider(env) !== "none";
}

/**
 * True when outbound mail should reach a real inbox (transport present and not
 * a known-broken Resend sandbox From). Used by soft verification and mail-status.
 */
export function emailReallyDeliverable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return emailDeliveryConfigured(env) && !emailConfigWarning(env);
}

/**
 * Whether login must block unverified accounts.
 *
 * Soft by default when mail cannot deliver. When mail works, set
 * REQUIRE_EMAIL_VERIFICATION=false to keep soft sign-in (banner + resend)
 * instead of a hard 403. Password reset still needs a working inbox.
 */
export function requireEmailVerification(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!emailReallyDeliverable(env)) return false;
  if (env.REQUIRE_EMAIL_VERIFICATION?.trim() === "false") return false;
  return true;
}

/**
 * Why verification mail will not reach a real inbox, or null when the config
 * can. The Resend sandbox address (`onboarding@resend.dev`) only delivers to
 * the Resend account owner — a key without `EMAIL_FROM` looks configured and
 * then fails every send. Skipped entirely when SMTP/Gmail is active (it takes
 * precedence over Resend).
 */
export function emailConfigWarning(env: Record<string, string | undefined> = process.env): string | null {
  if (resolveSmtpConfig(env)) return null;
  if (!env.RESEND_API_KEY?.trim()) return null;
  const from = env.EMAIL_FROM?.trim() || "";
  if (!from || /onboarding@resend\.dev/i.test(from) || /@resend\.dev>?$/i.test(from)) {
    return "[email] RESEND_API_KEY is set but EMAIL_FROM is missing or is a Resend sandbox address. Resend only delivers onboarding@resend.dev to the account owner, so verification and password-reset mail will not arrive. Set EMAIL_FROM to an address on a domain verified in Resend, and PUBLIC_APP_URL to the public origin those links should use. Or set GMAIL_USER + GMAIL_APP_PASSWORD (or SMTP_*) to send via SMTP instead.";
  }
  return null;
}

function smtpTransporterCacheKey(cfg: SmtpConfig): string {
  return `${cfg.host}|${cfg.port}|${cfg.secure ? 1 : 0}|${cfg.user}|${cfg.pass}`;
}

function getSmtpTransporter(cfg: SmtpConfig): Transporter {
  const key = smtpTransporterCacheKey(cfg);
  if (smtpTransporter && smtpTransporterKey === key) return smtpTransporter;
  closeSmtpTransporter();
  smtpTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  smtpTransporterKey = key;
  return smtpTransporter;
}

async function sendViaSmtp(
  cfg: SmtpConfig,
  mail: { from: string; to: string; subject: string; text: string; html: string },
): Promise<SendEmailResult> {
  try {
    if (smtpSendMailForTests) {
      const info = await smtpSendMailForTests(mail);
      return { sent: true, mode: "smtp", id: info.messageId };
    }
    const transporter = getSmtpTransporter(cfg);
    const info = await transporter.sendMail(mail);
    return { sent: true, mode: "smtp", id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[email] SMTP send error", message);
    return { sent: false, mode: "smtp", error: `SMTP failed: ${message}` };
  }
}

export function appBaseUrl(): string {
  return publicAppOrigin();
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

export function sendAppEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = resolveMailProvider();
  const mode: EmailTransportMode =
    provider === "smtp" ? "smtp" : provider === "resend" ? "resend" : provider === "webhook" ? "webhook" : "log";
  return settleWithin(SEND_DEADLINE_MS, deliverEmail(input), {
    sent: false,
    mode,
    error: "Email send timed out",
  });
}

async function deliverEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { sent: false, mode: "log", error: "No recipient email" };
  }
  const html = input.html ?? input.text.replace(/\n/g, "<br/>");
  const from = fromAddress();
  const smtp = resolveSmtpConfig();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhook = process.env.EMAIL_WEBHOOK_URL?.trim();
  let providerError: string | undefined;
  let failedMode: EmailTransportMode | undefined;

  if (smtp) {
    const smtpResult = await sendViaSmtp(smtp, {
      from,
      to,
      subject: input.subject,
      text: input.text,
      html,
    });
    if (smtpResult.sent) return smtpResult;
    providerError = smtpResult.error ?? "SMTP failed";
    failedMode = "smtp";
  }

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(SEND_DEADLINE_MS),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: input.subject,
          text: input.text,
          html,
          tags: [{ name: "kind", value: input.kind }],
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { sent: true, mode: "resend", id: data.id };
      }
      const body = await res.text().catch(() => "");
      providerError = providerError ?? `Resend failed (${res.status})`;
      failedMode = failedMode ?? "resend";
      console.error(`[email] Resend failed ${res.status}: ${body.slice(0, 300)}`);
    } catch (err) {
      providerError = providerError ?? "Resend request failed";
      failedMode = failedMode ?? "resend";
      console.error("[email] Resend request error", err);
    }
  }

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        signal: AbortSignal.timeout(SEND_DEADLINE_MS),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from,
          subject: input.subject,
          text: input.text,
          html,
          kind: input.kind,
        }),
      });
      if (res.ok) {
        return { sent: true, mode: "webhook", id: `webhook-${Date.now()}` };
      }
      providerError = providerError ?? `webhook failed (${res.status})`;
      failedMode = failedMode ?? "webhook";
      console.error(`[email] webhook failed ${res.status}`);
    } catch (err) {
      providerError = providerError ?? "webhook request failed";
      failedMode = failedMode ?? "webhook";
      console.error("[email] webhook request error", err);
    }
  }

  // A configured provider that failed must not look like "email is off"
  // (mode "log"). Callers tell the practitioner the message was not sent —
  // including Resend verification email, which surfaces SMTP errors the same way.
  if (smtp || apiKey || webhook) {
    console.error(`[email] ${input.kind} was not delivered: ${providerError ?? "unknown error"}`);
    return {
      sent: false,
      mode: failedMode ?? (smtp ? "smtp" : apiKey ? "resend" : "webhook"),
      error: providerError ?? "Email was not delivered",
    };
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
