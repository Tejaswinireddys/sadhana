import type Stripe from "stripe";
import { z } from "zod";
import type { IStorage } from "./storage";
import { subscriptionPeriodEnd } from "./stripeSubscriptionState";

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

export class CheckoutVerificationError extends Error {
  constructor() {
    super("Verify your email address before subscribing to Plus.");
    this.name = "CheckoutVerificationError";
  }
}

/** Persist customer ownership before redirecting so the portal survives restarts. */
export async function checkoutForUser(stripe: Stripe, store: IStorage, userId: number,
  interval: "month" | "year", origin: string, metadata: Record<string, string>) {
  const user = await store.getUserById(userId);
  if (!user) throw new Error("Account not found");
  if (!user.emailVerified) throw new CheckoutVerificationError();
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

export class UnmatchedStripeUserError extends Error {
  constructor(public customerId?: string, public subscriptionId?: string) {
    super("Stripe event has no matching user/customer binding");
    this.name = "UnmatchedStripeUserError";
  }
}

export function stripeEventReferences(event: Stripe.Event): { customerId?: string; subscriptionId?: string } | null {
  const object = event.data.object;
  let subscription: string | { id: string } | null | undefined;
  let customer: string | { id: string } | null | undefined;
  if (event.type === "checkout.session.completed") {
    const session = object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return null;
    subscription = session.subscription;
    customer = session.customer;
  } else if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    const sub = object as Stripe.Subscription;
    subscription = sub.id;
    customer = sub.customer;
  } else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
    const invoice = object as Stripe.Invoice & { subscription?: string | { id: string } | null };
    subscription = invoice.parent?.subscription_details?.subscription || invoice.subscription;
    customer = invoice.customer;
  } else return null;
  return {
    customerId: typeof customer === "string" ? customer : customer?.id,
    subscriptionId: typeof subscription === "string" ? subscription : subscription?.id,
  };
}

/** Reconcile against a locked persisted customer binding, never metadata.ownerId. */
export async function syncPlusEvent(stripe: Stripe, store: IStorage, event: Stripe.Event) {
  return store.runInTransaction(async () => {
    if (event.livemode) throw new Error("Live-mode events are not accepted");
    const references = stripeEventReferences(event);
    if (!references) return undefined;
    return reconcileStripeCustomer(stripe, store, references);
  });
}

/**
 * Re-read one customer's subscriptions from Stripe and write plan, status and
 * period end. Shared by webhooks and `resyncStripeEntitlement`, so a resync
 * takes the same binding lock and ownership checks as an event.
 */
export async function reconcileStripeCustomer(stripe: Stripe, store: IStorage,
  references: { customerId?: string; subscriptionId?: string }) {
  return store.runInTransaction(async () => {
    let { customerId, subscriptionId } = references;
    if (!customerId && subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    }
    const stored = await store.findStripeEntitlement(customerId, subscriptionId);
    const match = stored && /^user:([1-9]\d*)$/.exec(stored.ownerId);
    if (!stored || !match || !customerId || stored.stripeCustomerId !== customerId) throw new UnmatchedStripeUserError(customerId, subscriptionId);
    const user = await store.getUserById(Number(match[1]), true);
    if (!user) throw new UnmatchedStripeUserError(customerId, subscriptionId);
    // The binding lock is held before these reads so different event IDs for
    // one customer cannot commit older Stripe state after newer state.
    const current = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : undefined;
    if (current?.livemode) throw new Error("Live-mode subscriptions are not accepted");
    if (current && (typeof current.customer === "string" ? current.customer : current.customer.id) !== customerId) throw new UnmatchedStripeUserError(customerId, subscriptionId);
    const prices = Object.values(plusPriceIds()).filter(Boolean);
    const subscriptions = await customerSubscriptions(stripe, customerId);
    const active = subscriptions.find((sub) => !sub.livemode &&
      ["active", "trialing"].includes(sub.status) &&
      (typeof sub.customer === "string" ? sub.customer : sub.customer.id) === customerId && sub.items.data.some((item) => prices.includes(item.price.id)));
    const source = active || current || subscriptions.find((sub) => sub.id === stored.stripeSubscriptionId);
    const plan = active ? "plus" : "free";
    const periodEnd = subscriptionPeriodEnd(source);
    await store.setUserPlan(user.id, plan);
    // entitlements.plan is retained for legacy/guest history, but webhook access
    // decisions and writes go only through users.plan.
    await store.updateStripeEntitlement(stored.ownerId, {
      status: source?.status || "inactive", stripeCustomerId: customerId,
      stripeSubscriptionId: source?.id || stored.stripeSubscriptionId,
      renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
    return { user: { ...user, plan }, ownerId: stored.ownerId, stored, source, plan } as const;
  });
}
