/**
 * Stripe Checkout + subscription compliance (stricter than FTC/state ARL).
 * Two-tap cancel, renewal reminders, first-charge auto-refund, consent audit.
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { createRateLimiter } from "./security";
import {
  allEntitlements,
  appendConsentAudit,
  getEntitlement,
  getPendingConsent,
  issueCancelToken,
  needsRenewalReminder,
  purchasesForOwner,
  refundEligible,
  savePaywallSnapshot,
  savePurchase,
  setEntitlement,
  setPendingConsent,
  takePendingConsent,
  updatePurchase,
  verifyCancelToken,
  type BillingEntitlement,
  type BillingInterval,
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

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const pricePlusMonth = process.env.STRIPE_PRICE_PLUS_MONTHLY || "";
const pricePlusYear = process.env.STRIPE_PRICE_PLUS_YEARLY || "";
const priceCoachMonth = process.env.STRIPE_PRICE_COACH_MONTHLY || "";
const priceCoachYear = process.env.STRIPE_PRICE_COACH_YEARLY || "";

const stripe = stripeKey ? new Stripe(stripeKey) : null;

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

function priceId(plan: string, interval: string): string | null {
  if (plan === "plus" && interval === "month") return pricePlusMonth || null;
  if (plan === "plus" && interval === "year") return pricePlusYear || null;
  if (plan === "coach" && interval === "month") return priceCoachMonth || null;
  if (plan === "coach" && interval === "year") return priceCoachYear || null;
  return null;
}

/** Stripe SDK moved period end onto subscription items — support both shapes. */
function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") return itemEnd;
  const legacy = sub as unknown as { current_period_end?: number };
  return typeof legacy.current_period_end === "number" ? legacy.current_period_end : null;
}

function invoiceSubscriptionId(inv: Stripe.Invoice): string | undefined {
  const loose = inv as unknown as { subscription?: string | { id: string } | null };
  if (typeof loose.subscription === "string") return loose.subscription;
  if (loose.subscription && typeof loose.subscription === "object") return loose.subscription.id;
  return undefined;
}

function invoicePaymentIntentId(inv: Stripe.Invoice): string | undefined {
  const loose = inv as unknown as { payment_intent?: string | { id: string } | null };
  if (typeof loose.payment_intent === "string") return loose.payment_intent;
  if (loose.payment_intent && typeof loose.payment_intent === "object") return loose.payment_intent.id;
  return undefined;
}

function publicEntitlement(ownerId: string) {
  const row = getEntitlement(ownerId) || {
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
  const row = getEntitlement(ownerId);
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
  setEntitlement(ownerId, next);

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

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/config", (_req, res) => {
    res.json({
      enabled: Boolean(stripe),
      plans: ["free", "plus", "coach"],
      portalAvailable: Boolean(stripe),
      cancelTwoTap: true,
      firstChargeRefundDays: 14,
      renewalReminderDays: 3,
      termsVersion: BILLING_TERMS_VERSION,
      note: stripe
        ? "Checkout is live. Cancel in two taps from Home — no dark patterns."
        : "Core practice stays free. Paid checkout activates when Stripe keys are set — you will never be charged silently.",
    });
  });

  app.get("/api/billing/entitlement", (req, res) => {
    res.json(publicEntitlement(req.ownerId || ""));
  });

  /** Preview for the single confirmation screen (tap 2). */
  app.get("/api/billing/cancel-preview", (req, res) => {
    const ownerId = req.ownerId || "";
    const row = getEntitlement(ownerId);
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
    for (const [id, ent] of allEntitlements()) {
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
    for (const [id, ent] of allEntitlements()) {
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
  app.post("/api/billing/consent", billLimit, (req: Request, res: Response) => {
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
    const snapshotId = savePaywallSnapshot(paywallHtml);
    setPendingConsent(ownerId, {
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
    if (!stripe) {
      return res.status(503).json({
        error: "Billing is not configured on this deployment",
        hint: "Free practice stays available. Paid tiers turn on when Stripe keys are set — no surprise charges.",
      });
    }
    const plan = String(req.body?.plan || "");
    const interval = String(req.body?.interval || "month") === "year" ? "year" : "month";
    if (plan !== "plus" && plan !== "coach") {
      return res.status(400).json({ error: "Choose plus or coach" });
    }
    const price = priceId(plan, interval);
    if (!price) {
      return res.status(503).json({
        error: "Price IDs not configured",
        hint: `Set STRIPE_PRICE_${plan.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}`,
      });
    }
    const origin = appOrigin(req);
    const ownerId = req.ownerId || "";
    const existing = getEntitlement(ownerId);
    const pending = getPendingConsent(ownerId);

    // Require a consent + paywall snapshot so every purchase has an audit trail.
    if (!pending || pending.plan !== plan || pending.interval !== interval) {
      return res.status(400).json({
        error: "Consent snapshot required",
        hint: "Call POST /api/billing/consent with the rendered paywall HTML before checkout.",
      });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        success_url: `${origin}/plus?checkout=success`,
        cancel_url: `${origin}/plus?checkout=cancel`,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        customer_email: pending.email || undefined,
        customer: existing?.stripeCustomerId || undefined,
        client_reference_id: ownerId || undefined,
        subscription_data: {
          metadata: {
            sadhanaPlan: plan,
            ownerId,
            interval,
            paywallSnapshotId: pending.paywallSnapshotId,
          },
        },
        metadata: {
          sadhanaPlan: plan,
          ownerId,
          interval,
          paywallSnapshotId: pending.paywallSnapshotId,
          termsVersion: pending.termsVersion,
        },
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "Checkout failed" });
    }
  });

  /** Stripe Customer Portal — payment method updates only; cancel is in-app. */
  app.post("/api/billing/portal", billLimit, async (req: Request, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ error: "Billing is not configured on this deployment" });
    }
    const ownerId = req.ownerId || "";
    const row = getEntitlement(ownerId);
    if (!row?.stripeCustomerId) {
      return res.status(404).json({
        error: "No Stripe customer on file",
        hint: "Subscribe once, then Manage payment opens the portal.",
      });
    }
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: row.stripeCustomerId,
        return_url: `${appOrigin(req)}/plus`,
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "Portal unavailable" });
    }
  });

  /** First-charge refund — self-serve, auto-approved within 14 days. */
  app.post("/api/billing/refund-first-charge", billLimit, async (req: Request, res: Response) => {
    const ownerId = req.ownerId || "";
    const row = getEntitlement(ownerId);
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
    setEntitlement(ownerId, {
      ...row,
      refundedAt: now,
      plan: "free",
      status: "refunded",
      cancelAtPeriodEnd: false,
      accessUntil: now,
    });
    const purchases = purchasesForOwner(ownerId).filter((p) => p.isFirstCharge && !p.refundedAt);
    for (const p of purchases) updatePurchase(p.id, { refundedAt: now });

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
  app.post("/api/billing/demo-subscribe", billLimit, (req: Request, res: Response) => {
    const allow =
      process.env.BILLING_COMPLIANCE_DEMO === "1" || process.env.NODE_ENV !== "production";
    if (!allow) return res.status(404).json({ error: "Not found" });
    const ownerId = req.ownerId || "";
    const plan = String(req.body?.plan || "plus") === "coach" ? "coach" : "plus";
    const interval = String(req.body?.interval || "month") === "year" ? "year" : "month";
    const amount = catalogAmount(plan, interval);
    const renewsAt = new Date(Date.now() + (interval === "year" ? 365 : 30) * 86_400_000).toISOString();
    const email = String(req.body?.email || "demo@sadhana.app").trim().toLowerCase();
    const { hash } = issueCancelToken();
    setEntitlement(ownerId, {
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
    res.json({ ok: true, entitlement: publicEntitlement(ownerId) });
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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const ownerId = session.metadata?.ownerId || session.client_reference_id || "";
      const plan = session.metadata?.sadhanaPlan || "plus";
      const interval = (session.metadata?.interval === "year" ? "year" : "month") as BillingInterval;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (ownerId) {
        const pending = takePendingConsent(ownerId);
        const amount =
          pending?.amount ??
          (typeof session.amount_total === "number" ? session.amount_total / 100 : catalogAmount(plan, interval));
        const currency = (
          pending?.currency ||
          session.currency ||
          "usd"
        ).toUpperCase();
        const email =
          pending?.email ||
          session.customer_details?.email ||
          session.customer_email ||
          getEntitlement(ownerId)?.email;

        let renewsAt: string | null = null;
        if (stripe && subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const periodEnd = subscriptionPeriodEnd(sub);
            if (periodEnd) {
              renewsAt = new Date(periodEnd * 1000).toISOString();
            }
          } catch {
            /* ignore */
          }
        }

        const snapshotId =
          pending?.paywallSnapshotId ||
          session.metadata?.paywallSnapshotId ||
          savePaywallSnapshot("<!-- missing client snapshot; webhook placeholder -->");

        const audit = appendConsentAudit({
          ownerId,
          ip: pending?.ip || "stripe-webhook",
          userAgent: pending?.userAgent || "stripe-webhook",
          plan,
          interval,
          amount,
          currency,
          termsVersion: pending?.termsVersion || BILLING_TERMS_VERSION,
          priceDisplayed: pending?.priceDisplayed || priceLabel(amount, currency, interval),
          termsDisplayed: pending?.termsDisplayed || DEFAULT_TERMS_DISPLAYED,
          paywallSnapshotId: snapshotId,
          checkoutSessionId: session.id,
          stripeSubscriptionId: subscriptionId || null,
        });

        const prev = getEntitlement(ownerId);
        const isFirst = !prev?.firstChargedAt;
        const { hash } = issueCancelToken();
        // Issue a fresh token for reminder one-click links; raw is regenerated on reminder send.

        setEntitlement(ownerId, {
          plan,
          status: "active",
          renewsAt,
          stripeCustomerId: customerId || prev?.stripeCustomerId,
          stripeSubscriptionId: subscriptionId || prev?.stripeSubscriptionId,
          email: email || prev?.email,
          interval,
          amount,
          currency,
          accessUntil: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          firstChargedAt: prev?.firstChargedAt || new Date().toISOString(),
          firstChargeAmount: prev?.firstChargeAmount ?? amount,
          firstChargeCurrency: prev?.firstChargeCurrency ?? currency,
          refundedAt: null,
          cancelTokenHash: prev?.cancelTokenHash || hash,
          termsVersion: audit.termsVersion,
          paywallSnapshotId: snapshotId,
          consentAuditId: audit.id,
        });

        savePurchase({
          id: session.id,
          ownerId,
          plan,
          interval,
          amount,
          currency,
          chargedAt: new Date().toISOString(),
          paywallSnapshotId: snapshotId,
          consentAuditId: audit.id,
          stripeCheckoutSessionId: session.id,
          isFirstCharge: isFirst,
          refundedAt: null,
        });
      }
    }

    if (event.type === "invoice.paid") {
      const inv = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(inv);
      if (subId) {
        for (const [ownerId, ent] of allEntitlements()) {
          if (ent.stripeSubscriptionId !== subId) continue;
          const renewsAt = inv.lines?.data?.[0]?.period?.end
            ? new Date(inv.lines.data[0].period.end * 1000).toISOString()
            : ent.renewsAt;
          const pi = invoicePaymentIntentId(inv);
          setEntitlement(ownerId, {
            ...ent,
            renewsAt: renewsAt ?? ent.renewsAt,
            firstChargedAt: ent.firstChargedAt || new Date().toISOString(),
            firstChargeAmount:
              ent.firstChargeAmount ??
              (typeof inv.amount_paid === "number" ? inv.amount_paid / 100 : ent.amount),
            firstChargeCurrency: ent.firstChargeCurrency || (inv.currency || "usd").toUpperCase(),
            firstInvoiceId: ent.firstInvoiceId || inv.id,
            firstPaymentIntentId: ent.firstPaymentIntentId || pi || null,
            email: ent.email || inv.customer_email || undefined,
            cancelAtPeriodEnd: false,
          });
          break;
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      const plan = sub.metadata?.sadhanaPlan || getEntitlement(ownerId)?.plan || "plus";
      if (ownerId) {
        const prev = getEntitlement(ownerId);
        const periodEnd = subscriptionPeriodEnd(sub);
        const renewsAt = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : prev?.renewsAt ?? null;
        setEntitlement(ownerId, {
          plan:
            sub.status === "active" || sub.status === "trialing" || sub.cancel_at_period_end
              ? plan
              : "free",
          status: sub.status,
          renewsAt,
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : prev?.stripeCustomerId,
          stripeSubscriptionId: sub.id,
          email: prev?.email,
          interval: prev?.interval,
          amount: prev?.amount,
          currency: prev?.currency,
          accessUntil: sub.cancel_at_period_end ? renewsAt : null,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          canceledAt: sub.cancel_at_period_end ? prev?.canceledAt || new Date().toISOString() : null,
          firstChargedAt: prev?.firstChargedAt,
          firstChargeAmount: prev?.firstChargeAmount,
          firstChargeCurrency: prev?.firstChargeCurrency,
          firstInvoiceId: prev?.firstInvoiceId,
          firstPaymentIntentId: prev?.firstPaymentIntentId,
          refundedAt: prev?.refundedAt,
          cancelTokenHash: prev?.cancelTokenHash,
          termsVersion: prev?.termsVersion,
          paywallSnapshotId: prev?.paywallSnapshotId,
          consentAuditId: prev?.consentAuditId,
          lastReminderForRenewalAt: prev?.lastReminderForRenewalAt,
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      if (ownerId) {
        const prev = getEntitlement(ownerId);
        setEntitlement(ownerId, {
          plan: "free",
          status: "canceled",
          renewsAt: null,
          stripeCustomerId: prev?.stripeCustomerId,
          stripeSubscriptionId: prev?.stripeSubscriptionId,
          email: prev?.email,
          accessUntil: new Date().toISOString(),
          cancelAtPeriodEnd: false,
          canceledAt: prev?.canceledAt || new Date().toISOString(),
          firstChargedAt: prev?.firstChargedAt,
          firstChargeAmount: prev?.firstChargeAmount,
          firstChargeCurrency: prev?.firstChargeCurrency,
          refundedAt: prev?.refundedAt,
          cancelTokenHash: prev?.cancelTokenHash,
          paywallSnapshotId: prev?.paywallSnapshotId,
          consentAuditId: prev?.consentAuditId,
        });
        void storage.upsertEntitlement(ownerId, {
          plan: "free",
          status: "canceled",
          renewsAt: null,
          stripeCustomerId: prev?.stripeCustomerId ?? null,
          stripeSubscriptionId: prev?.stripeSubscriptionId ?? null,
        });
        let sessionsCompleted = 0;
        try {
          sessionsCompleted = (await storage.getSessions(ownerId)).length;
        } catch {
          /* ignore */
        }
        const subscribedMs = prev?.firstChargedAt ? Date.parse(prev.firstChargedAt) : NaN;
        const daysActive = Number.isFinite(subscribedMs)
          ? Math.max(0, Math.floor((Date.now() - subscribedMs) / 86_400_000))
          : 0;
        void captureServerEvent(ownerId, "subscription_cancelled", {
          days_active: daysActive,
          sessions_completed: sessionsCompleted,
        });
      }
    }

    res.json({ received: true });
  });
}

export async function dispatchRenewalReminders(origin: string): Promise<number> {
  let sent = 0;
  for (const [ownerId, ent] of allEntitlements()) {
    if (!needsRenewalReminder(ent)) continue;
    if (!ent.email || !ent.renewsAt) continue;
    const { raw, hash } = issueCancelToken();
    setEntitlement(ownerId, {
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
      setEntitlement(ownerId, { ...ent, cancelTokenHash: hash });
    }
    void ownerId;
  }
  return sent;
}

export function startBillingScheduler() {
  const tick = () => {
    const origin =
      process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || "https://sadhana-ou9m.onrender.com";
    void dispatchRenewalReminders(origin).then((n) => {
      if (n > 0) console.info(`[billing] sent ${n} renewal reminder(s)`);
    });
  };
  // Every 6 hours — covers the 3-day window without spam.
  setInterval(tick, 6 * 60 * 60 * 1000);
  setTimeout(tick, 45_000);
}

/**
 * Mirror `.data/billing-entitlements.json` rows into Postgres/memory storage.
 * Idempotent — skips owners that already have a storage row. Safe on every boot.
 */
export async function migrateBillingEntitlements(): Promise<number> {
  let imported = 0;
  try {
    for (const [ownerId, e] of allEntitlements()) {
      if (!ownerId) continue;
      if (await storage.getEntitlement(ownerId)) continue;
      await storage.upsertEntitlement(ownerId, {
        plan: e.plan,
        status: e.status,
        renewsAt: e.renewsAt ?? null,
        stripeCustomerId: e.stripeCustomerId ?? null,
        stripeSubscriptionId: e.stripeSubscriptionId ?? null,
      });
      imported++;
    }
  } catch (err) {
    console.warn("[billing] entitlement migration skipped:", (err as Error).message);
  }
  if (imported > 0) {
    console.log(`[billing] mirrored ${imported} entitlement(s) into durable storage`);
  }
  return imported;
}
