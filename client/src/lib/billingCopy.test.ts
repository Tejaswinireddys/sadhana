import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_PLUS_PRICES,
  billingCopy,
  billingState,
  plusPrices,
  priceSentence,
  usd,
  type BillingCopy,
} from "./billingCopy";
import { PLANS } from "./plans";
import { plusStatusMessage } from "./plusStatus";
import { CLASS_FORMAT_DISCLOSURE, CLASS_FORMAT_SHORT, PLUS_CLASSES_BULLET } from "../data/classFormat";

const allText = (copy: BillingCopy) =>
  Object.entries(copy).filter(([k]) => k !== "state").map(([, v]) => v ?? "").join(" \n ");

describe("billingState", () => {
  it("is disabled whenever billing is off, whatever the mode", () => {
    assert.equal(billingState(false, "test"), "disabled");
    assert.equal(billingState(false, "live"), "disabled");
  });
  it("is live only for an explicit live mode", () => {
    assert.equal(billingState(true, "live"), "live");
    assert.equal(billingState(true, "test"), "test");
    assert.equal(billingState(true, undefined), "test");
    assert.equal(billingState(true, "production"), "test");
  });
});

describe("prices", () => {
  it("uses the configured $9.99/month and $59.99/year", () => {
    assert.deepEqual(CATALOG_PLUS_PRICES, { month: 9.99, year: 59.99 });
    assert.equal(priceSentence(CATALOG_PLUS_PRICES), "$9.99/month or $59.99/year");
  });
  it("prefers the server's Stripe prices and falls back to the catalog", () => {
    assert.deepEqual(plusPrices({ prices: { month: { amount: 12 }, year: { amount: 90 } } }), { month: 12, year: 90 });
    assert.deepEqual(plusPrices(undefined), CATALOG_PLUS_PRICES);
    assert.deepEqual(plusPrices({}), CATALOG_PLUS_PRICES);
  });
  it("formats whole and fractional amounts", () => {
    assert.equal(usd(9.99), "$9.99");
    assert.equal(usd(9.9), "$9.90");
    assert.equal(usd(90), "$90");
  });
});

describe("billing disabled", () => {
  const copy = billingCopy("disabled");
  it("says purchasing is unavailable on every surface", () => {
    for (const line of [copy.landingPlus, copy.plansIntro, copy.statusNote, copy.freeAccount, copy.gateNote, copy.help]) {
      assert.match(line, /unavailable/i, line);
    }
    assert.equal(copy.manageNote, null);
  });
  it("never invites a purchase or mentions test checkout", () => {
    const text = allText(copy);
    assert.doesNotMatch(text, /test mode|test card|test checkout|upgrade to plus/i);
  });
  it("does not describe Plus as planned or waitlisted", () => {
    assert.doesNotMatch(allText(copy), /planned|waitlist|coming soon/i);
  });
});

describe("billing enabled in test mode", () => {
  const copy = billingCopy("test");
  it("labels checkout as test and promises no real charges everywhere money is mentioned", () => {
    for (const line of [copy.landingPlus, copy.plansIntro, copy.statusNote, copy.freeAccount, copy.gateNote, copy.help]) {
      assert.match(line, /test/i, line);
      assert.match(line, /no real charges/i, line);
    }
    assert.equal(copy.badge, "Test checkout");
    assert.match(copy.subscribeLabel, /test checkout/i);
    assert.match(copy.manageNote ?? "", /test-mode portal/);
  });
  it("shows the configured prices and never says purchasing is unavailable", () => {
    assert.match(copy.landingPlus, /\$9\.99\/month or \$59\.99\/year/);
    assert.match(copy.help, /\$9\.99\/month or \$59\.99\/year/);
    assert.doesNotMatch(allText(copy), /unavailable|planned|waitlist|not on sale/i);
  });
});

describe("billing enabled in live mode", () => {
  const copy = billingCopy("live", { month: 9.99, year: 59.99 });
  it("uses normal upgrade wording with the configured prices", () => {
    assert.equal(copy.badge, null);
    assert.equal(copy.subscribeLabel, "Subscribe");
    assert.equal(copy.gateCta, "Upgrade to Plus");
    assert.match(copy.landingPlus, /\$9\.99\/month or \$59\.99\/year/);
    assert.match(copy.help, /^Yes\./);
  });
  it("never mentions test mode, unavailability or a waitlist", () => {
    assert.doesNotMatch(allText(copy), /test|no real charges|unavailable|planned|waitlist|not on sale/i);
  });
});

describe("account status line follows billing state", () => {
  for (const kind of ["free", "signed-out"] as const) {
    it(`${kind}`, () => {
      assert.match(plusStatusMessage({ kind }, undefined, undefined, "disabled"), /unavailable/);
      assert.match(plusStatusMessage({ kind }, undefined, undefined, "test"), /test mode — no real charges/);
      assert.equal(plusStatusMessage({ kind }, undefined, undefined, "live"), "You're on the free plan.");
      assert.match(plusStatusMessage({ kind }), /unavailable/, "default never implies Plus is for sale");
    });
  }
});

describe("video class format copy", () => {
  it("names AI-generated motion, narration, captions and chapters", () => {
    for (const line of [CLASS_FORMAT_SHORT, CLASS_FORMAT_DISCLOSURE, PLUS_CLASSES_BULLET]) {
      assert.match(line, /AI/, line);
      assert.match(line, /narration/, line);
      assert.match(line, /captions/, line);
      assert.match(line, /chapters/, line);
    }
  });
  it("says no human instructor filmed or reviewed the classes, and never implies one did", () => {
    assert.match(CLASS_FORMAT_DISCLOSURE, /No human instructor was filmed for them or has reviewed them/);
    for (const line of [CLASS_FORMAT_SHORT, PLUS_CLASSES_BULLET]) {
      assert.doesNotMatch(line, /filmed|reviewed|teacher|human/i, line);
    }
  });
  it("Plus bullets list only what Plus unlocks", () => {
    const plus = PLANS.find((p) => p.id === "plus")!;
    assert.ok(plus.bullets.includes(PLUS_CLASSES_BULLET));
    assert.doesNotMatch(plus.bullets.join(" "), /filmed|offline/i);
  });
});
