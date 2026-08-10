/**
 * Subscription compliance helpers — cancel confirmation + renewal reminder
 * copy, and pure policy checks. Stricter than FTC negative-option + state ARL.
 */
import {
  formatAccessDate,
  formatMoney,
  sendEmail,
  type EmailResult,
} from "./email";
import type { BillingEntitlement } from "./billingStore";

export const BILLING_TERMS_VERSION = "2026-08-10-strict-arl";

/** Catalog prices mirrored from client/src/lib/plans.ts (server must not import client). */
export const CATALOG_PRICES: Record<string, { month: number; year: number }> = {
  plus: { month: 9.99, year: 79 },
  coach: { month: 14.99, year: 149 },
};

export function catalogAmount(plan: string, interval: "month" | "year"): number {
  return CATALOG_PRICES[plan]?.[interval] ?? 0;
}

export const DEFAULT_TERMS_DISPLAYED = [
  "Subscription renews automatically until you cancel.",
  "Cancel anytime in two taps from the app home — no chat, phone, or email required.",
  "You keep access until the end of the paid period after canceling.",
  "We email a renewal reminder 3 days before every charge (monthly and annual).",
  "First charge: self-serve refund within 14 days, auto-approved.",
  "No retention interstitials, countdown discounts, or dark patterns.",
].join(" ");

export function priceLabel(amount: number, currency: string, interval: "month" | "year"): string {
  const money = formatMoney(amount, currency);
  return interval === "year" ? `${money}/yr` : `${money}/mo`;
}

export async function sendCancelConfirmationEmail(args: {
  to: string;
  plan: string;
  accessUntil: string;
  cancelUrl: string;
}): Promise<EmailResult> {
  const when = formatAccessDate(args.accessUntil);
  const subject = `Sadhana subscription canceled — access until ${when}`;
  const text = [
    "Your Sadhana subscription is canceled.",
    "",
    `You keep full access until ${when}.`,
    "No further charges will be made.",
    "",
    `Manage or review: ${args.cancelUrl}`,
    "",
    "— Sadhana (no retention pitches, ever)",
  ].join("\n");
  const html = `
    <p>Your <strong>Sadhana ${escapeHtml(args.plan)}</strong> subscription is canceled.</p>
    <p>You keep full access until <strong>${escapeHtml(when)}</strong>.</p>
    <p>No further charges will be made.</p>
    <p><a href="${escapeAttr(args.cancelUrl)}">Cancellation details</a></p>
    <p style="color:#666;font-size:12px">Sadhana — cancel in two taps from Home. No chat, phone, or retention screens.</p>
  `;
  return sendEmail({ to: args.to, subject, html, text, kind: "cancel_confirm" });
}

export async function sendRenewalReminderEmail(args: {
  to: string;
  plan: string;
  amount: number;
  currency: string;
  chargeDate: string;
  cancelUrl: string;
}): Promise<EmailResult> {
  const when = formatAccessDate(args.chargeDate);
  const money = formatMoney(args.amount, args.currency);
  const subject = `Reminder: Sadhana renews ${when} for ${money}`;
  const text = [
    "This is your renewal reminder (sent 3 days before every charge).",
    "",
    `Plan: Sadhana ${args.plan}`,
    `Amount: ${money}`,
    `Charge date: ${when}`,
    "",
    `Cancel in one click (no login maze): ${args.cancelUrl}`,
    "",
    "If you do nothing, your subscription renews on the charge date.",
  ].join("\n");
  const html = `
    <p>This is your <strong>renewal reminder</strong> — we send one 3 days before every charge.</p>
    <ul>
      <li>Plan: Sadhana ${escapeHtml(args.plan)}</li>
      <li>Amount: <strong>${escapeHtml(money)}</strong></li>
      <li>Charge date: <strong>${escapeHtml(when)}</strong></li>
    </ul>
    <p><a href="${escapeAttr(args.cancelUrl)}" style="display:inline-block;padding:12px 18px;background:#1f4d3a;color:#fff;text-decoration:none;border-radius:8px">Cancel subscription</a></p>
    <p style="color:#666;font-size:12px">One click. No chat. No phone. No “are you sure” maze.</p>
  `;
  return sendEmail({ to: args.to, subject, html, text, kind: "renewal_reminder" });
}

export async function sendRefundConfirmationEmail(args: {
  to: string;
  amount: number;
  currency: string;
}): Promise<EmailResult> {
  const money = formatMoney(args.amount, args.currency);
  const subject = `Sadhana refund approved — ${money}`;
  const text = [
    `Your first-charge refund of ${money} was auto-approved.`,
    "It typically appears on your statement within 5–10 business days.",
  ].join("\n");
  const html = `
    <p>Your first-charge refund of <strong>${escapeHtml(money)}</strong> was <strong>auto-approved</strong>.</p>
    <p>It typically appears on your statement within 5–10 business days.</p>
  `;
  return sendEmail({ to: args.to, subject, html, text, kind: "refund_confirm" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export function isPaidActive(ent: BillingEntitlement | undefined): boolean {
  if (!ent) return false;
  if (ent.plan === "free") return false;
  return ent.status === "active" || ent.status === "trialing" || ent.cancelAtPeriodEnd === true;
}

export function clientIp(req: { ip?: string; headers: Record<string, unknown> | { get(name: string): string | undefined } }): string {
  const get = (name: string) => {
    if (typeof (req.headers as { get?: (n: string) => string | undefined }).get === "function") {
      return (req.headers as { get: (n: string) => string | undefined }).get(name);
    }
    const h = req.headers as Record<string, unknown>;
    const v = h[name] ?? h[name.toLowerCase()];
    return typeof v === "string" ? v : Array.isArray(v) ? String(v[0]) : undefined;
  };
  const fwd = get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return (req.ip || "unknown").slice(0, 64);
}
