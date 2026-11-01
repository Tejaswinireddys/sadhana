/**
 * What `/plus` says about the practitioner's account and subscription. Pure so
 * the states are unit-tested; `Plus.tsx` only renders them.
 *
 * Two production bugs motivated this: after a cancel in the Stripe portal the
 * page still said "Your account has Plus access." (the pending
 * `cancelAtPeriodEnd` was never read), and after returning from Checkout or
 * the portal it briefly showed "Sign in to subscribe" / "You don't have a
 * subscription" from a stale cache. A request in flight is now "loading",
 * never "signed out".
 */

export type PlusEntitlementView = {
  plan: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  accessUntil?: string | null;
  renewsAt?: string | null;
};

export type PlusStatusInput = {
  /** `undefined` while the first auth fetch is pending. */
  user: { plan?: string } | null | undefined;
  authFetching: boolean;
  entitlement: PlusEntitlementView | undefined;
  entitlementFetching: boolean;
  returnedFromCheckout: boolean;
  /** Still inside the post-checkout polling window. */
  awaitingConfirmation: boolean;
};

export type PlusStatus =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "awaiting-confirmation" }
  | { kind: "confirmation-slow" }
  | { kind: "plus" }
  | { kind: "plus-canceling"; accessUntil: string | null }
  | { kind: "free" };

/** Same rule as Home's cancel shortcut: a live or ending paid plan. */
export function hasPaidPlan(user: PlusStatusInput["user"], entitlement: PlusEntitlementView | undefined): boolean {
  if (user?.plan === "plus") return true;
  if (!entitlement || entitlement.plan === "free" || entitlement.status === "refunded") return false;
  return entitlement.status === "active" || entitlement.status === "trialing" || !!entitlement.cancelAtPeriodEnd;
}

/** A paid plan that Stripe will end at the close of the current period. */
export function pendingCancellation(user: PlusStatusInput["user"], entitlement: PlusEntitlementView | undefined) {
  return hasPaidPlan(user, entitlement) && !!entitlement?.cancelAtPeriodEnd;
}

export function plusStatus(input: PlusStatusInput): PlusStatus {
  const { user, authFetching, entitlement, entitlementFetching } = input;
  // Unknown or possibly-stale "signed out" while a refetch is in flight.
  if (user === undefined || (!user && authFetching)) return { kind: "loading" };
  if (!user) return { kind: "signed-out" };
  if (pendingCancellation(user, entitlement)) {
    return { kind: "plus-canceling", accessUntil: entitlement?.accessUntil || entitlement?.renewsAt || null };
  }
  if (hasPaidPlan(user, entitlement)) return { kind: "plus" };
  if (input.returnedFromCheckout) {
    return input.awaitingConfirmation ? { kind: "awaiting-confirmation" } : { kind: "confirmation-slow" };
  }
  if (entitlement === undefined || entitlementFetching) return { kind: "loading" };
  return { kind: "free" };
}

/** How often to re-check after Stripe Checkout, and for how long. */
export const CHECKOUT_POLL_INTERVAL_MS = 3_000;
export const CHECKOUT_POLL_WINDOW_MS = 60_000;

/** Poll interval for the checkout-success return, or `false` to stop. */
export function checkoutPollInterval(input: {
  returnedFromCheckout: boolean;
  plan: string | undefined;
  now: number;
  deadline: number;
}): number | false {
  if (!input.returnedFromCheckout || input.plan === "plus" || input.now >= input.deadline) return false;
  return CHECKOUT_POLL_INTERVAL_MS;
}

/** "December 31, 2026" — the date access ends, in the reader's locale. */
export function formatAccessDate(iso: string | null, locale?: string, timeZone?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric", timeZone });
}

/** Copy for the account-status line under the plans. */
export function plusStatusMessage(status: PlusStatus, locale?: string, timeZone?: string): string {
  switch (status.kind) {
    case "loading":
      return "Checking your account…";
    case "awaiting-confirmation":
      return "Waiting for subscription confirmation…";
    case "confirmation-slow":
      return "Waiting for subscription confirmation. Refresh if confirmation takes more than a minute.";
    case "plus":
      return "Your account has Plus access.";
    case "plus-canceling": {
      const date = formatAccessDate(status.accessUntil, locale, timeZone);
      return date
        ? `Your Plus plan is set to cancel on ${date}. You keep access until then.`
        : "Your Plus plan is set to cancel at the end of the billing period. You keep access until then.";
    }
    case "signed-out":
    case "free":
      return "Stripe test mode only — no live payments.";
  }
}
