import type Stripe from "stripe";

/**
 * Cancellation state read from a Stripe subscription. Pure, so the webhook
 * mapping is pinned by unit tests.
 *
 * Production bug: a Customer Portal cancel under the API version this SDK
 * sends (`2026-07-29.dahlia`, no explicit pin) schedules the end with
 * `cancel_at` and leaves `cancel_at_period_end` false. The webhook read only
 * the boolean, so Stripe said "Cancels Dec 1, 2026" while the entitlement
 * said nothing was ending — /plus showed no pending cancel and the renewal
 * reminder would still have been emailed. Either field now means pending.
 */

/** Seconds → ISO, or null. */
function iso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Period end. Since API `2025-03-31.basil` it lives on subscription items, not
 * the subscription; the earliest item end is when the paid period closes.
 * Older payloads (and test fixtures) may still carry it at the top level.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription | undefined): number | null {
  if (!sub) return null;
  const itemEnds = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number");
  if (itemEnds.length) return Math.min(...itemEnds);
  const legacy = sub as unknown as { current_period_end?: unknown };
  return typeof legacy.current_period_end === "number" ? legacy.current_period_end : null;
}

export type SubscriptionCancellation = {
  cancelAtPeriodEnd: boolean;
  /** When access ends for a pending cancel: `cancel_at`, else period end. */
  accessUntil: string | null;
  canceledAt: string | null;
};

/**
 * Pending cancel = `cancel_at_period_end` OR `cancel_at` on a subscription
 * that has not ended yet. Un-cancelling in the portal clears both fields, and
 * this clears all three values with them.
 */
export function subscriptionCancellation(sub: Stripe.Subscription | undefined): SubscriptionCancellation {
  const ended = !sub || sub.status === "canceled" || sub.status === "incomplete_expired";
  const pending = !ended && (Boolean(sub.cancel_at_period_end) || typeof sub.cancel_at === "number");
  if (!pending) {
    return { cancelAtPeriodEnd: false, accessUntil: null, canceledAt: ended ? iso(sub?.canceled_at) : null };
  }
  return {
    cancelAtPeriodEnd: true,
    accessUntil: iso(sub.cancel_at) ?? iso(subscriptionPeriodEnd(sub)),
    canceledAt: iso(sub.canceled_at),
  };
}

/** Rebuild from Stripe at most this often on read, even with no webhook. */
export const ENTITLEMENT_RESYNC_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Should a read of this entitlement first re-check Stripe? Yes when it has a
 * Stripe customer and was never rebuilt by the current mapping (every row
 * written before `stripeSyncedAt` existed — which is how the bad production
 * rows get corrected), when the last rebuild is old, or when a pending cancel
 * date has passed (a missed `customer.subscription.deleted`).
 */
export function entitlementNeedsResync(
  row: { stripeCustomerId?: string | null; billingDetails?: { stripeSyncedAt?: string | null; cancelAtPeriodEnd?: boolean; accessUntil?: string | null } | null } | undefined,
  now = Date.now(),
): boolean {
  if (!row?.stripeCustomerId) return false;
  const details = row.billingDetails;
  const synced = details?.stripeSyncedAt ? Date.parse(details.stripeSyncedAt) : NaN;
  if (!Number.isFinite(synced) || now - synced > ENTITLEMENT_RESYNC_MAX_AGE_MS) return true;
  const ends = details?.cancelAtPeriodEnd && details.accessUntil ? Date.parse(details.accessUntil) : NaN;
  return Number.isFinite(ends) && ends <= now;
}
