import Stripe from "stripe";
import type { IStorage } from "./storage";
import { isStripeTestKey } from "./stripePlus";
import { recordAccountCancellation, type AccountCancellation } from "./billingStore";

export type AccountDeletionStripe = Pick<Stripe, "subscriptions">;

function configuredStripe(): AccountDeletionStripe | null {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return isStripeTestKey(key) ? new Stripe(key) : null;
}

/** Confirm immediate cancellation before any account/session data can be deleted. */
export async function cancelSubscriptionsForAccountDeletion(
  userId: number,
  store: IStorage,
  stripe: AccountDeletionStripe | null = configuredStripe(),
  record: (event: AccountCancellation) => void | Promise<void> = recordAccountCancellation,
): Promise<void> {
  const ownerId = `user:${userId}`;
  const entitlement = await store.getEntitlement(ownerId);
  if (!entitlement?.stripeSubscriptionId && !entitlement?.stripeCustomerId) return;
  if (!stripe) throw new Error("Stripe is unavailable; cancellation cannot be confirmed");
  const subscriptions = new Map<string, Stripe.Subscription>();
  if (entitlement.stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(entitlement.stripeSubscriptionId);
    subscriptions.set(sub.id, sub);
  }
  // Covers Checkout completed before its webhook and more than one active subscription.
  if (entitlement.stripeCustomerId) {
    let starting_after: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({ customer: entitlement.stripeCustomerId, status: "all", limit: 100, starting_after });
      for (const sub of page.data) subscriptions.set(sub.id, sub);
      if (!page.has_more) break;
      starting_after = page.data.at(-1)?.id;
      if (!starting_after) throw new Error("Invalid Stripe pagination");
    }
  }
  let canceled = false;
  for (const sub of subscriptions.values()) {
    if (sub.livemode) throw new Error("Only Stripe test mode is supported");
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (entitlement.stripeCustomerId && customerId !== entitlement.stripeCustomerId) throw new Error("Stripe customer does not match the account");
    const result = sub.status === "active" || sub.status === "trialing"
      ? await stripe.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false })
      : sub;
    if ((sub.status === "active" || sub.status === "trialing") && (result.status !== "canceled" || result.id !== sub.id)) throw new Error("Stripe did not confirm cancellation");
    if (result.status === "canceled") {
      await record({ stripeSubscriptionId: result.id, canceledAt: new Date((result.canceled_at || Date.now() / 1000) * 1000).toISOString(), reason: "account_deletion" });
      canceled = true;
    }
  }
  if (canceled) {
    await store.upsertEntitlement(ownerId, { ...entitlement, plan: "free", status: "canceled", renewsAt: null });
    await store.setUserPlan(userId, "free");
  }
}
