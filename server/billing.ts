import { CheckoutVerificationError, checkoutForUser, checkoutRequestSchema, isStripeTestKey, plusPrice } from "./stripePlus";
import { processStripeWebhook, type StripeWebhookOptions } from "./stripeWebhook";
import { publicAppOrigin } from "./publicUrl";
import { billingEnabled } from "./publicConfig";
/**
 * Stripe Checkout + subscription compliance (stricter than FTC/state ARL).
 * Two-tap cancel, renewal reminders, first-charge auto-refund, consent audit.
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { createRateLimiter } from "./security";
import {
  allEntitlements,
  getEntitlement,
  getPendingConsent,
  issueCancelToken,
  needsRenewalReminder,
  purchasesForOwner,
  refundEligible,
  savePaywallSnapshot,
  setEntitlement,
  setPendingConsent,
  updatePurchase,
  verifyCancelToken,
  type BillingEntitlement,
} from "./billingStore";
import {
  BILLING_TERMS_VERSION,
  DEFAULT_TERMS_DISPLAYED,
  catalogAmount,
  clientIp,
  isPaidActive,
  priceLabel,
  sendCancelConfirmationEmail,
  sendRefundConfirmationEmail,
  sendRenewalReminderEmail,
} from "./billingCompliance";
import { captureServerEvent } from "./productAnalytics";
import { storage } from "./storage";
import {
  appBaseUrl,
  sendPaymentFailedEmail,
  sendSubscriptionStartedEmail,
} from "./email";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = isStripeTestKey(stripeKey) ? new Stripe(stripeKey) : null;

if (stripe && !webhookSecret) {
  console.error(
    "[billing] STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing. " +
      "Webhooks will be rejected until a signing secret is configured.",
  );
}

const billLimit = createRateLimiter({ windowMs: 60_000, max: 30 });

function appOrigin(req: Request): string {
  const env = process.env.PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:5000";
  return `${proto}://${host}`;
}

/** Stripe SDK moved period end onto subscription items — support both shapes. */
function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") return itemEnd;
  const legacy = sub as unknown as { current_period_end?: number };
  return typeof legacy.current_period_end === "number" ? legacy.current_period_end : null;
}

function invoicePaymentIntentId(inv: Stripe.Invoice): string | undefined {
  const loose = inv as unknown as { payment_intent?: string | { id: string } | null };
  if (typeof loose.payment_intent === "string") return loose.payment_intent;
  if (loose.payment_intent && typeof loose.payment_intent === "object") return loose.payment_intent.id;
  return undefined;
}

async function publicEntitlement(ownerId: string) {
  const row = await getEntitlement(ownerId) || {
    plan: "free",
    status: "active",
    renewsAt: null,
  };
  return {
    plan: row.plan,
    status: row.status,
    renewsAt: row.renewsAt,
    accessUntil: row.accessUntil ?? null,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    canceledAt: row.canceledAt ?? null,
    interval: row.interval ?? null,
    amount: row.amount ?? null,
    currency: row.currency ?? "USD",
    refundEligible: refundEligible(row),
    firstChargedAt: row.firstChargedAt ?? null,
    refundedAt: row.refundedAt ?? null,
    email: row.email ? "[on file]" : null,
    termsVersion: row.termsVersion ?? null,
  };
}

async function performCancel(
  ownerId: string,
  origin: string,
): Promise<{ ok: true; accessUntil: string } | { ok: false; status: number; error: string }> {
  const row = await getEntitlement(ownerId);
  if (!isPaidActive(row) || !row) {
    return { ok: false, status: 404, error: "No active paid subscription" };
  }
  if (row.cancelAtPeriodEnd && row.accessUntil) {
    return { ok: true, accessUntil: row.accessUntil };
  }

  let accessUntil =
    row.renewsAt ||
    new Date(Date.now() + (row.interval === "year" ? 365 : 30) * 86_400_000).toISOString();

  if (stripe && row.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.update(row.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      const periodEnd = subscriptionPeriodEnd(sub);
      if (periodEnd) {
        accessUntil = new Date(periodEnd * 1000).toISOString();
      }
    } catch (e) {
      return {
        ok: false,
        status: 502,
        error: (e as Error).message || "Stripe cancel failed",
      };
    }
  }

  const { raw, hash } = issueCancelToken();
  const next: BillingEntitlement = {
    ...row,
    cancelAtPeriodEnd: true,
    canceledAt: new Date().toISOString(),
    accessUntil,
    renewsAt: accessUntil,
    cancelTokenHash: hash,
    // Keep plan paid until period end so access continues.
    status: row.status === "trialing" ? "trialing" : "active",
  };
  await setEntitlement(ownerId, next);

  const cancelUrl = `${origin}/cancel?token=${encodeURIComponent(raw)}`;
  if (row.email) {
    void sendCancelConfirmationEmail({
      to: row.email,
      plan: row.plan,
      accessUntil,
      cancelUrl: `${origin}/cancel`,
    });
  }

  // Token URL is for one-click from reminders; confirmation email uses /cancel.
  void cancelUrl;

  return { ok: true, accessUntil };
}

export function registerBillingRoutes(app: Express, stripeClient: Stripe | null = stripe, webhookOptions: StripeWebhookOptions = {}) {
  const stripe = stripeClient;
  app.get("/api/billing/config", async (_req, res) => {
    let prices;
    try {
      if (stripe && billingEnabled()) prices = { month: await plusPrice(stripe, "month"), year: await plusPrice(stripe, "year") };
    } catch { /* Missing or invalid prices keep checkout disabled. */ }
    res.json({
      enabled: Boolean(stripe) && billingEnabled() && Boolean(prices) && Boolean(webhookSecret),
      testMode: true,
      prices,
      plans: ["free", "plus"],
      portalAvailable: Boolean(stripe) && billingEnabled(),
      cancelTwoTap: true,
      firstChargeRefundDays: 14,
      renewalReminderDays: 3,
      termsVersion: BILLING_TERMS_VERSION,
      note: stripe && prices && webhookSecret
        ? "Stripe test mode — use test cards only. Manage or cancel anytime."
        : "Stripe test billing is not configured. Free practice stays available.",
    });
  });

  app.get("/api/billing/entitlement", async (req, res) => {
    res.json(await publicEntitlement(req.ownerId || ""));
  });

  /** Preview for the single confirmation screen (tap 2). */
  app.get("/api/billing/cancel-preview", async (req, res) => {
    const ownerId = req.ownerId || "";
    const row = await getEntitlement(ownerId);
    if (!isPaidActive(row) || !row) {
      return res.status(404).json({ error: "No active paid subscription to cancel" });
    }
    const accessUntil =
      row.accessUntil ||
      row.renewsAt ||
      new Date(Date.now() + (row.interval === "year" ? 365 : 30) * 86_400_000).toISOString();
    res.json({
      plan: row.plan,
      accessUntil,
      alreadyCanceling: Boolean(row.cancelAtPeriodEnd),
      amount: row.amount ?? null,
      currency: row.currency ?? "USD",
      interval: row.interval ?? "month",
    });
  });

  /**
   * In-app cancel — one confirmation already shown client-side.
   * No retention interstitial, no survey, no chat.
   */
  app.post("/api/billing/cancel", billLimit, async (req: Request, res: Response) => {
    const result = await performCancel(req.ownerId || "", appOrigin(req));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({
      ok: true,
      accessUntil: result.accessUntil,
      message: "Canceled. You keep access until the date shown — no further charges.",
    });
  });

  /** One-click cancel from renewal reminder email (token in query or body). */
  app.post("/api/billing/cancel-token", billLimit, async (req: Request, res: Response) => {
    const token = String(req.body?.token || req.query?.token || "");
    if (!token) return res.status(400).json({ error: "Missing cancel token" });
    let ownerId = "";
    for (const [id, ent] of await allEntitlements()) {
      if (verifyCancelToken(token, ent.cancelTokenHash)) {
        ownerId = id;
        break;
      }
    }
    if (!ownerId) return res.status(404).json({ error: "Invalid or expired cancel link" });
    const result = await performCancel(ownerId, appOrigin(req));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true, accessUntil: result.accessUntil });
  });

  app.get("/api/billing/cancel-token", billLimit, async (req: Request, res: Response) => {
    const token = String(req.query?.token || "");
    if (!token) return res.status(400).json({ error: "Missing cancel token" });
    let ownerId = "";
    for (const [id, ent] of await allEntitlements()) {
      if (verifyCancelToken(token, ent.cancelTokenHash)) {
        ownerId = id;
        break;
      }
    }
    if (!ownerId) return res.status(404).json({ error: "Invalid or expired cancel link" });
    const result = await performCancel(ownerId, appOrigin(req));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    // Browser one-click: redirect to public cancel page with confirmation.
    res.redirect(302, `${appOrigin(req)}/cancel?done=1&until=${encodeURIComponent(result.accessUntil)}`);
  });

  /** Capture consent + exact paywall HTML before Stripe Checkout. */
  app.post("/api/billing/consent", billLimit, async (req: Request, res: Response) => {
    const ownerId = req.ownerId || "";
    const plan = String(req.body?.plan || "");
    const interval = String(req.body?.interval || "month") === "year" ? "year" : "month";
    if (plan !== "plus" && plan !== "coach") {
      return res.status(400).json({ error: "Choose plus or coach" });
    }
    const amount =
      typeof req.body?.amount === "number" && Number.isFinite(req.body.amount)
        ? req.body.amount
        : catalogAmount(plan, interval);
    const currency = String(req.body?.currency || "USD").toUpperCase().slice(0, 8);
    const priceDisplayed =
      String(req.body?.priceDisplayed || "").slice(0, 64) || priceLabel(amount, currency, interval);
    const termsDisplayed =
      String(req.body?.termsDisplayed || "").slice(0, 4000) || DEFAULT_TERMS_DISPLAYED;
    const termsVersion = String(req.body?.termsVersion || BILLING_TERMS_VERSION).slice(0, 64);
    const paywallHtml = String(req.body?.paywallHtml || "");
    if (!paywallHtml || paywallHtml.length < 40) {
      return res.status(400).json({ error: "paywallHtml snapshot required" });
    }
    const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 200) || undefined;
    const snapshotId = await savePaywallSnapshot(paywallHtml);
    await setPendingConsent(ownerId, {
      ownerId,
      plan,
      interval,
      amount,
      currency,
      termsVersion,
      priceDisplayed,
      termsDisplayed,
      paywallSnapshotId: snapshotId,
      email,
      createdAt: new Date().toISOString(),
      ip: clientIp(req),
      userAgent: String(req.get("user-agent") || "").slice(0, 300),
    });
    res.json({ ok: true, paywallSnapshotId: snapshotId, termsVersion });
  });

  app.post("/api/billing/checkout", billLimit, async (req: Request, res: Response) => {
    if (!req.userId) return res.status(401).json({ error: "Sign in to subscribe" });
    const user = await storage.getUserById(req.userId);
    if (!user) return res.status(401).json({ error: "Sign in to subscribe" });
    if (!user.emailVerified) return res.status(403).json({ error: new CheckoutVerificationError().message, code: "EMAIL_NOT_VERIFIED" });
    if (!stripe || !billingEnabled() || !webhookSecret) {
      return res.status(503).json({
        error: "Billing is not configured on this deployment",
        hint: "Configure a Stripe test key, webhook signing secret, and Plus price IDs.",
      });
    }
    const parsed = checkoutRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose Plus monthly or yearly" });
    const { plan, interval } = parsed.data;
    const origin = publicAppOrigin();
    const ownerId = `user:${req.userId}`;
    const pending = await getPendingConsent(ownerId);

    // Require a consent + paywall snapshot so every purchase has an audit trail.
    if (!pending || pending.plan !== plan || pending.interval !== interval) {
      return res.status(400).json({
        error: "Consent snapshot required",
        hint: "Call POST /api/billing/consent with the rendered paywall HTML before checkout.",
      });
    }

    try {
      const price = await plusPrice(stripe, interval);
      if (pending.amount !== price.amount || pending.currency.toUpperCase() !== price.currency) {
        return res.status(400).json({ error: "Price changed. Refresh the plans page and confirm again." });
      }
      const session = await checkoutForUser(stripe, storage, req.userId, interval, origin, {
        paywallSnapshotId: pending.paywallSnapshotId, termsVersion: pending.termsVersion,
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(e instanceof CheckoutVerificationError ? 403 : 502).json({ error: (e as Error).message || "Checkout failed" });
    }
  });

  /** Stripe Customer Portal for subscription management and cancellation. */
  app.post("/api/billing/portal", billLimit, async (req: Request, res: Response) => {
    if (!stripe || !billingEnabled()) {
      return res.status(503).json({ error: "Billing is not configured on this deployment" });
    }
    if (!req.userId) return res.status(401).json({ error: "Sign in to manage your subscription" });
    const ownerId = `user:${req.userId}`;
    const row = await storage.getEntitlement(ownerId);
    if (!row?.stripeCustomerId) {
      return res.status(404).json({
        error: "No Stripe customer on file",
        hint: "Subscribe once, then Manage payment opens the portal.",
      });
    }
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: row.stripeCustomerId,
        return_url: `${publicAppOrigin()}/plus`,
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "Portal unavailable" });
    }
  });

  /** First-charge refund — self-serve, auto-approved within 14 days. */
  app.post("/api/billing/refund-first-charge", billLimit, async (req: Request, res: Response) => {
    const ownerId = req.ownerId || "";
    const row = await getEntitlement(ownerId);
    if (!row || !refundEligible(row)) {
      return res.status(400).json({
        error: "Refund not available",
        hint: "Self-serve first-charge refunds are available for 14 days after your first payment.",
      });
    }

    if (stripe && (row.firstInvoiceId || row.firstPaymentIntentId || row.stripeCustomerId)) {
      try {
        if (row.firstPaymentIntentId) {
          await stripe.refunds.create({ payment_intent: row.firstPaymentIntentId });
        } else if (row.firstInvoiceId) {
          const inv = await stripe.invoices.retrieve(row.firstInvoiceId);
          const pi = invoicePaymentIntentId(inv);
          if (!pi) throw new Error("No payment intent on first invoice");
          await stripe.refunds.create({ payment_intent: pi });
        } else {
          return res.status(502).json({ error: "Missing charge reference for refund" });
        }
      } catch (e) {
        return res.status(502).json({ error: (e as Error).message || "Refund failed" });
      }
    }

    const amount = row.firstChargeAmount ?? row.amount ?? 0;
    const currency = row.firstChargeCurrency ?? row.currency ?? "USD";
    const now = new Date().toISOString();
    await setEntitlement(ownerId, {
      ...row,
      refundedAt: now,
      plan: "free",
      status: "refunded",
      cancelAtPeriodEnd: false,
      accessUntil: now,
    });
    if (req.userId) await storage.setUserPlan(req.userId, "free");
    const purchases = (await purchasesForOwner(ownerId)).filter((p) => p.isFirstCharge && !p.refundedAt);
    for (const p of purchases) await updatePurchase(p.id, { refundedAt: now });

    if (row.email) {
      void sendRefundConfirmationEmail({ to: row.email, amount, currency });
    }

    res.json({
      ok: true,
      refunded: true,
      amount,
      currency,
      message: "Refund auto-approved. Access ends immediately; funds return in 5–10 business days.",
    });
  });

  /**
   * Local/demo helper: seed a paid entitlement so the two-tap cancel path can be
   * exercised without Stripe. Disabled in production unless BILLING_COMPLIANCE_DEMO=1.
   */
  app.post("/api/billing/demo-subscribe", billLimit, async (req: Request, res: Response) => {
    const allow =
      process.env.BILLING_COMPLIANCE_DEMO === "1" || process.env.NODE_ENV !== "production";
    if (!allow) return res.status(404).json({ error: "Not found" });
    const ownerId = req.ownerId || "";
    const plan = String(req.body?.plan || "plus") === "coach" ? "coach" : "plus";
    const interval = String(req.body?.interval || "month") === "year" ? "year" : "month";
    const amount = catalogAmount(plan, interval);
    const renewsAt = new Date(Date.now() + (interval === "year" ? 365 : 30) * 86_400_000).toISOString();
    // example.com is reserved and undeliverable — renewal/cancel emails for a
    // demo entitlement must never reach a real mailbox.
    const email = String(req.body?.email || "demo@example.com").trim().toLowerCase();
    const { hash } = issueCancelToken();
    await setEntitlement(ownerId, {
      plan,
      status: "active",
      renewsAt,
      email,
      interval,
      amount,
      currency: "USD",
      firstChargedAt: new Date().toISOString(),
      firstChargeAmount: amount,
      firstChargeCurrency: "USD",
      cancelTokenHash: hash,
      termsVersion: BILLING_TERMS_VERSION,
    });
    res.json({ ok: true, entitlement: await publicEntitlement(ownerId) });
  });

  /** Cron / scheduler entry — also called from in-process timer. */
  app.post("/api/billing/dispatch-renewal-reminders", async (req: Request, res: Response) => {
    const secret = process.env.PUSH_DISPATCH_SECRET || process.env.BILLING_DISPATCH_SECRET || "";
    if (secret && req.get("x-billing-secret") !== secret && req.get("x-push-secret") !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const sent = await dispatchRenewalReminders(appOrigin(req));
    res.json({ ok: true, sent });
  });

  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    if (!stripe) return res.status(503).end();
    if (!webhookSecret) {
      console.error(
        "[billing] Rejected webhook: STRIPE_WEBHOOK_SECRET is not set. Unsigned events are never accepted.",
      );
      return res.status(500).send("Webhook secret not configured");
    }
    let event: Stripe.Event;
    try {
      const sig = req.get("stripe-signature") || "";
      event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
    } catch (e) {
      return res.status(400).send(`Webhook Error: ${(e as Error).message}`);
    }

    if (event.livemode) return res.status(400).json({ error: "Only Stripe test-mode events are accepted" });

    try {
      const result = await processStripeWebhook(stripe, storage, event, {
        ...webhookOptions,
        notify: webhookOptions.notify || (async (notification) => {
          const { ownerId, plan, email } = notification;
          if (notification.kind === "purchase_completed") await captureServerEvent(ownerId, "purchase_completed", { flow_id: "plus_page", plan, amount: notification.amount || 0, currency: notification.currency || "USD" });
          if (notification.kind === "subscription_started") await sendSubscriptionStartedEmail({ to: email, plan, manageUrl: `${appBaseUrl()}/plus` });
          if (notification.kind === "payment_failed") await sendPaymentFailedEmail({ to: email, plan, manageUrl: `${appBaseUrl()}/plus` });
          if (notification.kind === "subscription_cancelled") await captureServerEvent(ownerId, "subscription_cancelled", { days_active: notification.daysActive || 0, sessions_completed: notification.sessionsCompleted || 0 });
        }),
      });
      res.json(result);
    } catch {
      // No event marker or partial account changes survive; Stripe can retry.
      res.status(503).json({ error: "Stripe webhook could not be reconciled; retry later" });
    }
  });
}

export async function dispatchRenewalReminders(origin: string): Promise<number> {
  let sent = 0;
  for (const [ownerId, ent] of await allEntitlements()) {
    if (!needsRenewalReminder(ent)) continue;
    if (!ent.email || !ent.renewsAt) continue;
    const { raw, hash } = issueCancelToken();
    await setEntitlement(ownerId, {
      ...ent,
      cancelTokenHash: hash,
      lastReminderForRenewalAt: ent.renewsAt,
    });
    const cancelUrl = `${origin}/api/billing/cancel-token?token=${encodeURIComponent(raw)}`;
    const result = await sendRenewalReminderEmail({
      to: ent.email,
      plan: ent.plan,
      amount: ent.amount ?? 0,
      currency: ent.currency ?? "USD",
      chargeDate: ent.renewsAt,
      cancelUrl,
    });
    if (result.ok) sent += 1;
    else {
      // Roll back reminder marker so we retry.
      await setEntitlement(ownerId, { ...ent, cancelTokenHash: hash });
    }
    void ownerId;
  }
  return sent;
}

export function startBillingScheduler() {
  const tick = () => {
    const origin =
      publicAppOrigin();
    void dispatchRenewalReminders(origin).then((n) => {
      if (n > 0) console.info(`[billing] sent ${n} renewal reminder(s)`);
    }).catch(() => console.warn("[billing] Renewal reminder dispatch failed; will retry next tick"));
  };
  // Every 6 hours — covers the 3-day window without spam.
  setInterval(tick, 6 * 60 * 60 * 1000);
  setTimeout(tick, 45_000);
}

/** Compatibility entry point for explicit legacy entitlement imports. */
export async function migrateBillingEntitlements(): Promise<number> {
  const { importLegacyBillingData } = await import("./billingMigration");
  return (await importLegacyBillingData(storage, { onlyEntitlements: true })).entitlements;
}
