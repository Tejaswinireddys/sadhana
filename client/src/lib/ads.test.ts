import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adEligibility, adsAllowedOnPath } from "./ads";

const on = { enabled: true };
const off = { enabled: false };
const now = Date.parse("2026-11-01T17:00:00Z");
const freeEnt = { plan: "free", status: "active" };
const plusEnt = { plan: "plus", status: "active", cancelAtPeriodEnd: false, accessUntil: null };
const cancelScheduled = { plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil: "2026-12-01T17:00:00Z" };
const ended = { plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil: "2026-10-01T17:00:00Z" };

describe("adEligibility", () => {
  it("guests and free accounts see ads", () => {
    assert.equal(adEligibility({ ads: on, user: null, entitlement: freeEnt, now }), "show");
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: freeEnt, now }), "show");
  });

  it("Plus members never do — by account plan, or by an active entitlement", () => {
    assert.equal(adEligibility({ ads: on, user: { plan: "plus" }, entitlement: undefined, now }), "hide",
      "an account's own plan decides without waiting for billing");
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: plusEnt, now }), "hide");
    assert.equal(adEligibility({ ads: on, user: null, entitlement: plusEnt, now }), "hide");
  });

  it("a cancel-scheduled Plus member stays ad-free until the access date", () => {
    assert.equal(adEligibility({ ads: on, user: { plan: "plus" }, entitlement: cancelScheduled, now }), "hide");
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: cancelScheduled, now }), "hide");
  });

  it("once Plus has ended, the account is free and sees ads", () => {
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: ended, now }), "show");
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: { plan: "free", status: "canceled" }, now }), "show");
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: { plan: "plus", status: "refunded" }, now }), "show");
  });

  it("ADS_ENABLED false hides ads for everyone, before anything loads", () => {
    for (const user of [undefined, null, { plan: "free" }, { plan: "plus" }]) {
      assert.equal(adEligibility({ ads: off, user, entitlement: undefined, now }), "hide");
    }
  });

  it("is unknown (renders nothing) until both auth and entitlement are known, so nothing flashes", () => {
    assert.equal(adEligibility({ ads: on, user: undefined, entitlement: freeEnt, now }), "unknown");
    assert.equal(adEligibility({ ads: on, user: null, entitlement: undefined, now }), "unknown");
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: undefined, now }), "unknown");
  });

  it("an entitlement that cannot be read shows no ad rather than risk one to a member", () => {
    assert.equal(adEligibility({ ads: on, user: { plan: "free" }, entitlement: undefined, entitlementError: true, now }), "hide");
  });
});

describe("adsAllowedOnPath", () => {
  it("allows the three placements' pages", () => {
    for (const path of ["/", "/classes", "/classes/gentle-morning-wake-up", "/?ref=x"]) assert.equal(adsAllowedOnPath(path), true, path);
  });

  it("never on Plus, checkout, account, billing, sign-in, verify, kids or the players", () => {
    for (const path of ["/plus", "/plus?checkout=success", "/checkout", "/account", "/account/", "/billing", "/cancel", "/cancel/confirm",
      "/register", "/verify", "/kids", "/kids/tree", "/guided", "/practice", "/settings", "/welcome", "/privacy"]) {
      assert.equal(adsAllowedOnPath(path), false, path);
    }
    assert.equal(adsAllowedOnPath("/plusminus"), true, "prefix match is by path segment");
  });
});
