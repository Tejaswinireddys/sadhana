import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  ENTITLEMENT_RESYNC_MAX_AGE_MS,
  entitlementNeedsResync,
  subscriptionCancellation,
  subscriptionPeriodEnd,
} from "./stripeSubscriptionState";

const PERIOD_END = 1_796_083_200; // 2026-12-01T00:00:00Z
const CANCEL_AT = 1_795_000_000;
const CANCELED_AT = 1_793_000_000;
const iso = (s: number) => new Date(s * 1000).toISOString();

function sub(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_1", status: "active", cancel_at_period_end: false, cancel_at: null, canceled_at: null,
    items: { data: [{ current_period_end: PERIOD_END }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("subscriptionCancellation", () => {
  it("cancel via cancel_at_period_end: access runs to the period end", () => {
    assert.deepEqual(subscriptionCancellation(sub({ cancel_at_period_end: true, canceled_at: CANCELED_AT })), {
      cancelAtPeriodEnd: true, accessUntil: iso(PERIOD_END), canceledAt: iso(CANCELED_AT),
    });
  });

  it("cancel via cancel_at (newer portal behaviour, boolean left false): access runs to cancel_at", () => {
    assert.deepEqual(subscriptionCancellation(sub({ cancel_at: CANCEL_AT, canceled_at: CANCELED_AT })), {
      cancelAtPeriodEnd: true, accessUntil: iso(CANCEL_AT), canceledAt: iso(CANCELED_AT),
    });
  });

  it("cancel_at wins over the period end when both are present", () => {
    assert.equal(subscriptionCancellation(sub({ cancel_at_period_end: true, cancel_at: CANCEL_AT })).accessUntil, iso(CANCEL_AT));
  });

  it("reactivation (both fields empty again) clears everything", () => {
    assert.deepEqual(subscriptionCancellation(sub()), { cancelAtPeriodEnd: false, accessUntil: null, canceledAt: null });
  });

  it("an ended subscription is not pending, but keeps when it was cancelled", () => {
    assert.deepEqual(subscriptionCancellation(sub({ status: "canceled", cancel_at: CANCEL_AT, canceled_at: CANCELED_AT })), {
      cancelAtPeriodEnd: false, accessUntil: null, canceledAt: iso(CANCELED_AT),
    });
    assert.deepEqual(subscriptionCancellation(undefined), { cancelAtPeriodEnd: false, accessUntil: null, canceledAt: null });
  });
});

describe("subscriptionPeriodEnd", () => {
  it("reads items (API 2025-03-31.basil and later), using the earliest item", () => {
    assert.equal(subscriptionPeriodEnd(sub({ items: { data: [{ current_period_end: PERIOD_END }, { current_period_end: CANCEL_AT }] } })), CANCEL_AT);
  });

  it("falls back to the legacy top-level field", () => {
    assert.equal(subscriptionPeriodEnd(sub({ items: { data: [] }, current_period_end: PERIOD_END })), PERIOD_END);
    assert.equal(subscriptionPeriodEnd(sub({ items: { data: [] } })), null);
  });
});

describe("entitlementNeedsResync", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  it("rows never rebuilt by the current mapping are resynced once", () => {
    assert.equal(entitlementNeedsResync({ stripeCustomerId: "cus_1", billingDetails: { cancelAtPeriodEnd: false } }, now), true);
    assert.equal(entitlementNeedsResync({ stripeCustomerId: "cus_1", billingDetails: null }, now), true);
  });

  it("fresh rows are left alone; old ones are re-checked", () => {
    const fresh = new Date(now - 60_000).toISOString();
    const old = new Date(now - ENTITLEMENT_RESYNC_MAX_AGE_MS - 1).toISOString();
    assert.equal(entitlementNeedsResync({ stripeCustomerId: "cus_1", billingDetails: { stripeSyncedAt: fresh } }, now), false);
    assert.equal(entitlementNeedsResync({ stripeCustomerId: "cus_1", billingDetails: { stripeSyncedAt: old } }, now), true);
  });

  it("a pending cancel whose date has passed is re-checked even if recently synced", () => {
    const fresh = new Date(now - 60_000).toISOString();
    assert.equal(entitlementNeedsResync({ stripeCustomerId: "cus_1", billingDetails: {
      stripeSyncedAt: fresh, cancelAtPeriodEnd: true, accessUntil: new Date(now - 1).toISOString(),
    } }, now), true);
  });

  it("nothing to read from without a Stripe customer", () => {
    assert.equal(entitlementNeedsResync({ stripeCustomerId: null }, now), false);
    assert.equal(entitlementNeedsResync(undefined, now), false);
  });
});
