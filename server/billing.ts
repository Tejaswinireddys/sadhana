/**
 * Stripe Checkout for Plus / Coach — only active when STRIPE_SECRET_KEY is set.
 * Clear pricing, Billing Portal cancel path, no dark patterns.
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { createRateLimiter } from "./security";
import { loadMap, saveMap } from "./jsonStore";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const pricePlusMonth = process.env.STRIPE_PRICE_PLUS_MONTHLY || "";
const pricePlusYear = process.env.STRIPE_PRICE_PLUS_YEARLY || "";
const priceCoachMonth = process.env.STRIPE_PRICE_COACH_MONTHLY || "";
const priceCoachYear = process.env.STRIPE_PRICE_COACH_YEARLY || "";

const stripe = stripeKey ? new Stripe(stripeKey) : null;

type Entitlement = {
  plan: string;
  status: string;
  renewsAt: string | null;
  stripeCustomerId?: string;
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

function priceId(plan: string, interval: string): string | null {
  if (plan === "plus" && interval === "month") return pricePlusMonth || null;
  if (plan === "plus" && interval === "year") return pricePlusYear || null;
  if (plan === "coach" && interval === "month") return priceCoachMonth || null;
  if (plan === "coach" && interval === "year") return priceCoachYear || null;
  return null;
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
    res.json(row);
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
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        success_url: `${origin}/#/plus?checkout=success`,
        cancel_url: `${origin}/#/plus?checkout=cancel`,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        customer: existing?.stripeCustomerId || undefined,
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
        return_url: `${appOrigin(req)}/#/plus`,
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "Portal unavailable" });
    }
  });

  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    if (!stripe) return res.status(503).end();
    let event: Stripe.Event;
    try {
      if (webhookSecret) {
        const sig = req.get("stripe-signature") || "";
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
        event = req.body as Stripe.Event;
      }
    } catch (e) {
      return res.status(400).send(`Webhook Error: ${(e as Error).message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const ownerId = session.metadata?.ownerId || session.client_reference_id || "";
      const plan = session.metadata?.sadhanaPlan || "plus";
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (ownerId) {
        entitlements.set(ownerId, {
          plan,
          status: "active",
          renewsAt: null,
          stripeCustomerId: customerId || entitlements.get(ownerId)?.stripeCustomerId,
        });
        persist();
      }
    }
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      const plan = sub.metadata?.sadhanaPlan || entitlements.get(ownerId)?.plan || "plus";
      if (ownerId) {
        entitlements.set(ownerId, {
          plan: sub.status === "active" || sub.status === "trialing" ? plan : "free",
          status: sub.status,
          renewsAt: null,
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : entitlements.get(ownerId)?.stripeCustomerId,
        });
        persist();
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      if (ownerId) {
        const prev = entitlements.get(ownerId);
        entitlements.set(ownerId, {
          plan: "free",
          status: "canceled",
          renewsAt: null,
          stripeCustomerId: prev?.stripeCustomerId,
        });
        persist();
      }
    }
    res.json({ received: true });
  });
}
