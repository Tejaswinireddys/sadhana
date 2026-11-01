import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ENDED_NOTICE_DAYS, subscriptionNotice, subscriptionNoticeCopy } from "./subscriptionNotice";

const now = Date.parse("2026-11-01T17:00:00Z");
const dec1 = "2026-12-01T17:00:00.000Z";

describe("subscriptionNotice", () => {
  it("a Plus plan set to cancel at period end gets one 'ends on' notice, not 'canceled'", () => {
    const notice = subscriptionNotice({ plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil: dec1 }, now);
    assert.deepEqual(notice, { kind: "ending", accessUntil: dec1 });
    const copy = subscriptionNoticeCopy(notice!, "en-US");
    assert.equal(copy.title, "Your Plus plan ends on December 1, 2026.");
    assert.equal(copy.body, "You keep access until then. No further charges.");
    assert.doesNotMatch(`${copy.title} ${copy.body}`, /canceled/i);
  });

  it("says 'Subscription canceled' only once access has actually ended", () => {
    const after = Date.parse("2026-12-02T00:00:00Z");
    const notice = subscriptionNotice({ plan: "free", status: "canceled", cancelAtPeriodEnd: true, accessUntil: dec1 }, after);
    assert.deepEqual(notice, { kind: "ended", accessUntil: dec1 });
    assert.equal(subscriptionNoticeCopy(notice!, "en-US").title, "Subscription canceled");
    assert.match(subscriptionNoticeCopy(notice!, "en-US").body, /ended on December 1, 2026/);
    // Still marked Plus at the instant of expiry (webhook not yet in): ended, not "ends on".
    assert.equal(subscriptionNotice({ plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil: dec1 }, Date.parse(dec1))?.kind, "ended");
  });

  it("stops mentioning an ended plan after a while", () => {
    const later = Date.parse(dec1) + (ENDED_NOTICE_DAYS + 1) * 86_400_000;
    assert.equal(subscriptionNotice({ plan: "free", status: "canceled", cancelAtPeriodEnd: true, accessUntil: dec1 }, later), null);
  });

  it("an active plan with no cancel scheduled gets the two-tap cancel entry, nothing else", () => {
    assert.deepEqual(subscriptionNotice({ plan: "plus", status: "active", cancelAtPeriodEnd: false, accessUntil: null }, now), { kind: "cancel-cta" });
    assert.deepEqual(subscriptionNotice({ plan: "plus", status: "trialing" }, now), { kind: "cancel-cta" });
  });

  it("free, refunded, or unknown entitlements get no notice", () => {
    assert.equal(subscriptionNotice(undefined, now), null);
    assert.equal(subscriptionNotice({ plan: "free", status: "active" }, now), null);
    assert.equal(subscriptionNotice({ plan: "plus", status: "refunded", cancelAtPeriodEnd: true, accessUntil: dec1 }, now), null);
    assert.equal(subscriptionNotice({ plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil: "not a date" }, now), null,
      "a pending cancel with no readable date says nothing rather than guessing");
  });
});
