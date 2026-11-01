import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_POLL_INTERVAL_MS,
  checkoutPollInterval,
  formatAccessDate,
  hasPaidPlan,
  pendingCancellation,
  plusStatus,
  plusStatusMessage,
  type PlusStatusInput,
} from "./plusStatus";

const base: PlusStatusInput = {
  user: { plan: "free" },
  authFetching: false,
  entitlement: { plan: "free", status: "active", cancelAtPeriodEnd: false, accessUntil: null },
  entitlementFetching: false,
  returnedFromCheckout: false,
  awaitingConfirmation: false,
};
const plusUser = { plan: "plus" };
const activePlus = { plan: "plus", status: "active", cancelAtPeriodEnd: false, accessUntil: null, renewsAt: "2026-12-31T12:00:00.000Z" };

describe("plusStatus — pending cancellation", () => {
  it("a portal cancel at period end shows the date access ends, not plain Plus access", () => {
    const status = plusStatus({
      ...base,
      user: plusUser,
      entitlement: { ...activePlus, cancelAtPeriodEnd: true, accessUntil: "2026-12-31T12:00:00.000Z" },
    });
    assert.deepEqual(status, { kind: "plus-canceling", accessUntil: "2026-12-31T12:00:00.000Z" });
    assert.equal(
      plusStatusMessage(status, "en-US", "UTC"),
      "Your Plus plan is set to cancel on December 31, 2026. You keep access until then.",
    );
  });

  it("falls back to renewsAt, then to period-end wording, when no access date is stored", () => {
    const status = plusStatus({ ...base, user: plusUser, entitlement: { ...activePlus, cancelAtPeriodEnd: true } });
    assert.deepEqual(status, { kind: "plus-canceling", accessUntil: "2026-12-31T12:00:00.000Z" });
    assert.match(
      plusStatusMessage({ kind: "plus-canceling", accessUntil: null }),
      /set to cancel at the end of the billing period/,
    );
  });

  it("an active plan without a pending cancel still reads as Plus access", () => {
    const status = plusStatus({ ...base, user: plusUser, entitlement: activePlus });
    assert.equal(status.kind, "plus");
    assert.equal(plusStatusMessage(status), "Your account has Plus access.");
    assert.equal(pendingCancellation(plusUser, activePlus), false);
  });

  it("a refunded or free entitlement is not a pending cancellation", () => {
    const refunded = { ...activePlus, status: "refunded", cancelAtPeriodEnd: true };
    assert.equal(hasPaidPlan({ plan: "free" }, refunded), false);
    assert.equal(pendingCancellation({ plan: "free" }, refunded), false);
    assert.equal(plusStatus({ ...base, entitlement: refunded }).kind, "free");
  });
});

describe("plusStatus — never a stale signed-out state", () => {
  it("is loading before auth has answered", () => {
    assert.equal(plusStatus({ ...base, user: undefined }).kind, "loading");
  });

  it("is loading, not signed out, while a cached signed-out answer is being refetched", () => {
    assert.equal(plusStatus({ ...base, user: null, authFetching: true }).kind, "loading");
    assert.equal(plusStatus({ ...base, user: null, authFetching: false }).kind, "signed-out");
  });

  it("is loading, not 'no subscription', while the entitlement is in flight", () => {
    assert.equal(plusStatus({ ...base, entitlement: undefined }).kind, "loading");
    assert.equal(plusStatus({ ...base, entitlementFetching: true }).kind, "loading");
    assert.equal(plusStatus(base).kind, "free");
  });

  it("a signed-in Plus user stays Plus during a background refetch", () => {
    assert.equal(plusStatus({ ...base, user: plusUser, authFetching: true, entitlementFetching: true, entitlement: activePlus }).kind, "plus");
  });
});

describe("post-checkout confirmation", () => {
  it("waits while polling, then says to refresh once the window closes", () => {
    const waiting = plusStatus({ ...base, returnedFromCheckout: true, awaitingConfirmation: true });
    assert.equal(waiting.kind, "awaiting-confirmation");
    assert.match(plusStatusMessage(waiting), /Waiting for subscription confirmation/);
    const slow = plusStatus({ ...base, returnedFromCheckout: true, awaitingConfirmation: false });
    assert.equal(slow.kind, "confirmation-slow");
    assert.match(plusStatusMessage(slow), /Refresh if confirmation takes more than a minute/);
  });

  it("a success query string alone never grants Plus", () => {
    assert.notEqual(plusStatus({ ...base, returnedFromCheckout: true, awaitingConfirmation: true }).kind, "plus");
  });

  it("polls every 3s for up to 60s, and stops as soon as Plus is active", () => {
    const deadline = 60_000;
    assert.equal(checkoutPollInterval({ returnedFromCheckout: true, plan: "free", now: 0, deadline }), CHECKOUT_POLL_INTERVAL_MS);
    assert.equal(CHECKOUT_POLL_INTERVAL_MS, 3_000);
    assert.equal(checkoutPollInterval({ returnedFromCheckout: true, plan: "plus", now: 0, deadline }), false);
    assert.equal(checkoutPollInterval({ returnedFromCheckout: true, plan: "free", now: deadline, deadline }), false);
    assert.equal(checkoutPollInterval({ returnedFromCheckout: false, plan: "free", now: 0, deadline }), false);
  });
});

describe("formatAccessDate", () => {
  it("formats valid dates and rejects missing or junk ones", () => {
    assert.equal(formatAccessDate("2027-01-15T00:00:00.000Z", "en-US", "UTC"), "January 15, 2027");
    assert.equal(formatAccessDate(null), null);
    assert.equal(formatAccessDate("not a date"), null);
  });
});
