import type Stripe from "stripe";
import { z } from "zod";
import type { IStorage } from "./storage";

export const checkoutRequestSchema = z.object({
  plan: z.literal("plus").default("plus"),
  interval: z.enum(["month", "year"]),
});

export function plusPriceIds() {
  return {
    month: process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_PLUS_MONTHLY || "",
    year: process.env.STRIPE_PRICE_YEARLY || process.env.STRIPE_PRICE_PLUS_YEARLY || "",
  };
}

/** Never instantiate a live-mode client, even when billing is enabled. */
export function isStripeTestKey(key: string): boolean {
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}

export async function plusPrice(stripe: Stripe, interval: "month" | "year") {
  const id = plusPriceIds()[interval];
  if (!id) throw new Error(`STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"} is required`);
  const price = await stripe.prices.retrieve(id);
  if (price.currency !== "usd" || price.livemode || !price.active || price.type !== "recurring" ||
      price.recurring?.interval !== interval || price.recurring.interval_count !== 1 ||
      price.unit_amount === null || price.billing_scheme !== "per_unit" || price.recurring.usage_type !== "licensed") {
    throw new Error("Configure an active, fixed-amount test price with the matching billing interval");
  }
  return { id: price.id, amount: price.unit_amount / 100, currency: price.currency.toUpperCase() };
}

async function customerSubscriptions(stripe: Stripe, customer: string) {
  const subscriptions: Stripe.Subscription[] = [];
  let starting_after: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({ customer, status: "all", limit: 100, starting_after });
    subscriptions.push(...page.data);
    if (!page.has_more) return subscriptions;
    starting_after = page.data.at(-1)?.id;
    if (!starting_after) throw new Error("Invalid Stripe pagination");
  }
}

/** Persist customer ownership before redirecting so the portal survives restarts. */
export async function checkoutForUser(stripe: Stripe, store: IStorage, userId: number,
  interval: "month" | "year", origin: string, metadata: Record<string, string>) {
  const user = await store.getUserById(userId);
  if (!user) throw new Error("Account not found");
  const ownerId = `user:${userId}`;
  const existing = await store.getEntitlement(ownerId);
  let customer = existing?.stripeCustomerId;
  if (!customer) {
    const created = await stripe.customers.create({ email: user.email, metadata: { userId: String(userId), ownerId } },
      { idempotencyKey: `sadhana-test-customer-${userId}` });
    if (created.livemode) throw new Error("Only Stripe test customers are allowed");
    customer = created.id;
    await store.upsertEntitlement(ownerId, {
      plan: "free", status: "inactive", renewsAt: null,
      stripeCustomerId: customer, stripeSubscriptionId: null,
    });
  }
  const subscriptions = await customerSubscriptions(stripe, customer);
  if (subscriptions.some((sub) => ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(sub.status))) {
    throw new Error("A subscription already exists. Use Manage subscription instead.");
  }
  const price = await plusPrice(stripe, interval);
  return stripe.checkout.sessions.create({
    mode: "subscription", customer,
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: ownerId,
    metadata: { ...metadata, ownerId, userId: String(userId), sadhanaPlan: "plus", interval },
    subscription_data: { metadata: { ...metadata, ownerId, userId: String(userId), sadhanaPlan: "plus", interval } },
    success_url: `${origin}/plus?checkout=success`,
    cancel_url: `${origin}/plus?checkout=cancel`,
  });
}

/** Reconcile current Stripe state: retries and delayed events cannot replay old access. */
export async function syncPlusEvent(stripe: Stripe, store: IStorage, event: Stripe.Event) {
  if (event.livemode) throw new Error("Live-mode events are not accepted");
  let subscriptionId: string | undefined;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return;
    subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  } else if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  } else return;
  if (!subscriptionId) throw new Error("Subscription reference missing");
  const current = await stripe.subscriptions.retrieve(subscriptionId);
  if (current.livemode) throw new Error("Live-mode subscriptions are not accepted");
  const ownerId = current.metadata.ownerId || "";
  const match = /^user:([1-9]\d*)$/.exec(ownerId);
  if (!match) return; // Legacy guest subscriptions cannot grant account access.
  const userId = Number(match[1]);
  if (!await store.getUserById(userId)) return;
  const customer = typeof current.customer === "string" ? current.customer : current.customer.id;
  const stored = await store.getEntitlement(ownerId);
  if (stored?.stripeCustomerId && stored.stripeCustomerId !== customer) throw new Error("Customer ownership mismatch");
  const prices = Object.values(plusPriceIds()).filter(Boolean);
  const subscriptions = await customerSubscriptions(stripe, customer);
  const active = subscriptions.find((sub) => !sub.livemode && sub.metadata.ownerId === ownerId &&
    ["active", "trialing"].includes(sub.status) && sub.items.data.some((item) => prices.includes(item.price.id)));
  const source = active || current;
  const periodEnd = source.items.data[0]?.current_period_end;
  const plan = active ? "plus" : "free";
  await store.upsertEntitlement(ownerId, {
    plan, status: source.status,
    stripeCustomerId: customer, stripeSubscriptionId: source.id,
    renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });
  await store.setUserPlan(userId, plan);
}
