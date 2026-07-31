/**
 * Stripe Checkout for Plus / Coach — only active when STRIPE_SECRET_KEY is set.
 * Clear pricing, easy cancel path, no dark patterns.
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { createRateLimiter } from "./security";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const pricePlusMonth = process.env.STRIPE_PRICE_PLUS_MONTHLY || "";
const pricePlusYear = process.env.STRIPE_PRICE_PLUS_YEARLY || "";
const priceCoachMonth = process.env.STRIPE_PRICE_COACH_MONTHLY || "";
const priceCoachYear = process.env.STRIPE_PRICE_COACH_YEARLY || "";

const stripe = stripeKey ? new Stripe(stripeKey) : null;

/** ownerId → plan entitlement (memory; Postgres entitlements table is for later). */
const entitlements = new Map<string, { plan: string; status: string; renewsAt: string | null }>();

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
      cancelUrl: "https://billing.stripe.com/p/login",
      note: stripe
        ? "Checkout is live. Cancel anytime from the Stripe customer portal."
        : "Set STRIPE_SECRET_KEY and price IDs to enable checkout.",
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
        error: "Billing is not configured",
        hint: "Payments stay off until STRIPE_SECRET_KEY is set — no surprise charges.",
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
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        success_url: `${origin}/#/plus?checkout=success`,
        cancel_url: `${origin}/#/plus?checkout=cancel`,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        subscription_data: {
          metadata: { sadhanaPlan: plan, ownerId: req.ownerId || "" },
        },
        metadata: { sadhanaPlan: plan, ownerId: req.ownerId || "" },
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "Checkout failed" });
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
      const ownerId = session.metadata?.ownerId || "";
      const plan = session.metadata?.sadhanaPlan || "plus";
      if (ownerId) {
        entitlements.set(ownerId, {
          plan,
          status: "active",
          renewsAt: null,
        });
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const ownerId = sub.metadata?.ownerId || "";
      if (ownerId) {
        entitlements.set(ownerId, { plan: "free", status: "canceled", renewsAt: null });
      }
    }
    res.json({ received: true });
  });
}
