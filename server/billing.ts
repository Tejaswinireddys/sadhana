/**
 * Stripe Checkout for Plus / Coach — only active when STRIPE_SECRET_KEY is set.
 * Clear pricing, Billing Portal cancel path, no dark patterns.
 * Sends transactional billing emails when a recipient address is known.
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { createRateLimiter } from "./security";
import { loadMap, saveMap } from "./jsonStore";
import { storage } from "./storage";
import {
  appBaseUrl,
  sendCancelConfirmationEmail,
  sendPaymentFailedEmail,
  sendRenewalReminderEmail,
  sendSubscriptionStartedEmail,
} from "./email";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const pricePlusMonth = process.env.STRIPE_PRICE_PLUS_MONTHLY || "";
const pricePlusYear = process.env.STRIPE_PRICE_PLUS_YEARLY || "";
const priceCoachMonth = process.env.STRIPE_PRICE_COACH_MONTHLY || "";
const priceCoachYear = process.env.STRIPE_PRICE_COACH_YEARLY || "";

const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Billing must never run with signature verification disabled. The webhook route
// fails closed without this secret; surface the misconfiguration loudly at boot.
if (stripe && !webhookSecret) {
  console.error(
    "[billing] STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing. " +
      "Webhooks will be rejected until a signing secret is configured.",
  );
}

type Entitlement = {
  plan: string;
  status: string;
  renewsAt: string | null;
  stripeCustomerId?: string;
  /** Best-known billing contact (Stripe customer / checkout / account). */
  email?: string;
  cancelAtPeriodEnd?: boolean;
  /** ISO day we last sent a renewal reminder (dedupe). */
  lastRenewalReminderAt?: string;
};

const STORE = "billing-entitlements";
const entitlements = loadMap<Entitlement>(STORE);

function persist() {
  saveMap(STORE, entitlements);
}

const billLimit = createRateLimiter({ windowMs: 60_000, max: 20 });

function appOrigin(req: Request): string {
  const env = process.env.PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:5000";
  return `${proto}://${host}`;
}

function manageUrl(): string {
  return `${appBaseUrl()}/plus`;
}

function priceId(plan: string, interval: string): string | null {
  if (plan === "plus" && interval === "month") return pricePlusMonth || null;
  if (plan === "plus" && interval === "year") return pricePlusYear || null;
  if (plan === "coach" && interval === "month") return priceCoachMonth || null;
  if (plan === "coach" && interval === "year") return priceCoachYear || null;
  return null;
}

async function emailForOwner(ownerId: string, fallback?: string | null): Promise<string | undefined> {
  const trimmed = fallback?.trim().toLowerCase();
  if (trimmed && trimmed.includes("@")) return trimmed;
  const existing = entitlements.get(ownerId)?.email;
  if (existing) return existing;
  const match = /^user:(\d+)$/.exec(ownerId);
  if (!match) return undefined;
  const user = await storage.getUserById(Number(match[1]));
  return user?.email;
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  // Newer Stripe APIs expose period bounds on subscription items, not the sub root.
  const ends = (sub.items?.data || [])
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const end = ends.length ? Math.max(...ends) : (sub.cancel_at ?? null);
  if (!end) return null;
  return new Date(end * 1000).toISOString();
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") return parentSub;
  if (parentSub && typeof parentSub === "object" && "id" in parentSub) {
    return (parentSub as { id: string }).id;
  }
  return undefined;
}

/** Email anyone whose renewsAt falls within the next 3 days (once per charge window). */
export async function dispatchRenewalReminders(now = new Date()): Promise<number> {
  const horizon = now.getTime() + 3 * 86_400_000;
  let sent = 0;
  for (const [ownerId, row] of entitlements) {
    if (!row.email || !row.renewsAt) continue;
    if (row.plan === "free") continue;
    if (row.status !== "active" && row.status !== "trialing") continue;
    if (row.cancelAtPeriodEnd) continue;
    const renewMs = new Date(row.renewsAt).getTime();
    if (Number.isNaN(renewMs) || renewMs < now.getTime() || renewMs > horizon) continue;
    const dayKey = row.renewsAt.slice(0, 10);
    if (row.lastRenewalReminderAt === dayKey) continue;
    await sendRenewalReminderEmail({
      to: row.email,
      plan: row.plan,
      chargeDate: row.renewsAt,
      manageUrl: manageUrl(),
    });
    entitlements.set(ownerId, { ...row, lastRenewalReminderAt: dayKey });
    sent += 1;
  }
  if (sent) persist();
  return sent;
}

export function startBillingScheduler() {
  // Light touch — same spirit as push reminders; safe when Stripe is off.
  const tick = () => {
    void dispatchRenewalReminders().catch((err) => {
      console.error("[billing] renewal reminder dispatch failed", err);
    });
  };
  setInterval(tick, 6 * 60 * 60_000);
  setTimeout(tick, 45_000);
}

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/config", (_req, res) => {
    res.json({
      enabled: Boolean(stripe),
      plans: ["free", "plus", "coach"],
      portalAvailable: Boolean(stripe),
      note: stripe
        ? "Checkout is live. Cancel anytime from Manage subscription — no dark patterns."
        : "Core practice stays free. Paid checkout activates when the operator configures Stripe — you will never be charged silently.",
    });
  });

  app.get("/api/billing/entitlement", (req, res) => {
    const row = entitlements.get(req.ownerId || "") || {
      plan: "free",
      status: "active",
      renewsAt: null,
    };
    res.json({
      plan: row.plan,
      status: row.status,
      renewsAt: row.renewsAt,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
    });
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
    const existing = entitlements.get(ownerId);
    let customerEmail: string | undefined;
    if (req.userId) {
      const user = await storage.getUserById(req.userId);
      customerEmail = user?.email;
    }
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        success_url: `${origin}/plus?checkout=success`,
        cancel_url: `${origin}/plus?checkout=cancel`,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        customer: existing?.stripeCustomerId || undefined,
        customer_email: existing?.stripeCustomerId ? undefined : customerEmail,
        client_reference_id: ownerId || undefined,
        subscription_data: {
          metadata: { sadhanaPlan: plan, ownerId },
        },
        metadata: { sadhanaPlan: plan, ownerId },
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "Checkout failed" });
    }
  });

  /** Stripe Customer Portal — real cancel / update payment path. */
  app.post("/api/billing/portal", billLimit, async (req: Request, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ error: "Billing is not configured on this deployment" });
    }
    const ownerId = req.ownerId || "";
    const row = entitlements.get(ownerId);
    if (!row?.stripeCustomerId) {
      return res.status(404).json({
        error: "No Stripe customer on file",
        hint: "Subscribe once, then Manage subscription opens the cancel portal.",
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

  /** Operator / cron hook for renewal reminders (also runs in-process). */
  app.post("/api/billing/dispatch-renewal-reminders", async (req, res) => {
    const secret = process.env.BILLING_DISPATCH_SECRET || process.env.PUSH_DISPATCH_SECRET;
    if (secret && req.get("x-billing-secret") !== secret && req.get("x-push-secret") !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const sent = await dispatchRenewalReminders();
    res.json({ ok: true, sent });
  });

  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    if (!stripe) return res.status(503).end();
    // Never trust an unsigned body. If billing is on but no webhook secret is
    // configured, reject rather than accepting a forgeable event as truth.
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
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const email = await emailForOwner(
        ownerId,
        session.customer_details?.email || session.customer_email,
      );
      if (ownerId) {
        const prev = entitlements.get(ownerId);
        entitlements.set(ownerId, {
          plan,
          status: "active",
          renewsAt: prev?.renewsAt ?? null,
          stripeCustomerId: customerId || prev?.stripeCustomerId,
          email: email || prev?.email,
          cancelAtPeriodEnd: false,
        });
        persist();
        if (email) {
          void sendSubscriptionStartedEmail({ to: email, plan, manageUrl: manageUrl() });
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      const prev = ownerId ? entitlements.get(ownerId) : undefined;
      const plan = sub.metadata?.sadhanaPlan || prev?.plan || "plus";
      if (ownerId) {
        const renewsAt = periodEndIso(sub);
        const email = await emailForOwner(ownerId, prev?.email);
        const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
        entitlements.set(ownerId, {
          plan: sub.status === "active" || sub.status === "trialing" ? plan : "free",
          status: sub.status,
          renewsAt,
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : prev?.stripeCustomerId,
          email,
          cancelAtPeriodEnd,
          lastRenewalReminderAt: prev?.lastRenewalReminderAt,
        });
        persist();
        // Fire cancel confirmation once when cancel-at-period-end flips on.
        if (cancelAtPeriodEnd && !prev?.cancelAtPeriodEnd && email) {
          void sendCancelConfirmationEmail({
            to: email,
            plan,
            accessUntil: renewsAt,
            manageUrl: manageUrl(),
          });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      if (ownerId) {
        const prev = entitlements.get(ownerId);
        const email = await emailForOwner(ownerId, prev?.email);
        entitlements.set(ownerId, {
          plan: "free",
          status: "canceled",
          renewsAt: null,
          stripeCustomerId: prev?.stripeCustomerId,
          email: email || prev?.email,
          cancelAtPeriodEnd: false,
        });
        persist();
        // If they canceled immediately (not via period-end flag), still notify.
        if (email && !prev?.cancelAtPeriodEnd) {
          void sendCancelConfirmationEmail({
            to: email,
            plan: prev?.plan || "plus",
            accessUntil: null,
            manageUrl: manageUrl(),
          });
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(invoice);
      let ownerId = "";
      let plan = "plus";
      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          ownerId = sub.metadata?.ownerId || "";
          plan = sub.metadata?.sadhanaPlan || entitlements.get(ownerId)?.plan || "plus";
          if (ownerId) {
            const prev = entitlements.get(ownerId);
            entitlements.set(ownerId, {
              ...(prev || { plan, status: "past_due", renewsAt: null }),
              plan: prev?.plan || plan,
              status: "past_due",
              renewsAt: periodEndIso(sub),
              stripeCustomerId:
                typeof sub.customer === "string" ? sub.customer : prev?.stripeCustomerId,
              email: prev?.email,
              cancelAtPeriodEnd: prev?.cancelAtPeriodEnd,
              lastRenewalReminderAt: prev?.lastRenewalReminderAt,
            });
            persist();
          }
        } catch {
          // fall through with invoice customer email only
        }
      }
      const email = await emailForOwner(ownerId, invoice.customer_email);
      if (email) {
        void sendPaymentFailedEmail({ to: email, plan, manageUrl: manageUrl() });
      }
    }

    res.json({ received: true });
  });
}
