/**
 * Pins the live-mode readiness contract: env-only switch, mode-driven copy,
 * webhook path, and the operator checklist in docs/STRIPE_GO_LIVE.md.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { billingCopy, billingState } from "../client/src/lib/billingCopy";
import { stripeConfig, stripeMode, stripeStartupErrors } from "./stripeConfig";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Stripe live switch is env-only", () => {
  it("reads only STRIPE_LIVE_* when STRIPE_MODE=live", () => {
    const env = {
      STRIPE_MODE: "live",
      STRIPE_LIVE_SECRET_KEY: "sk_live_abc",
      STRIPE_LIVE_PUBLISHABLE_KEY: "pk_live_abc",
      STRIPE_LIVE_WEBHOOK_SECRET: "whsec_abc",
      STRIPE_LIVE_PRICE_MONTHLY: "price_month",
      STRIPE_LIVE_PRICE_YEARLY: "price_year",
      // Test leftovers must never win in live mode.
      STRIPE_SECRET_KEY: "sk_test_should_not_win",
      STRIPE_PRICE_MONTHLY: "price_test_month",
    };
    assert.equal(stripeMode(env), "live");
    assert.deepEqual(stripeConfig(env), {
      mode: "live",
      secretKey: "sk_live_abc",
      publishableKey: "pk_live_abc",
      webhookSecret: "whsec_abc",
      prices: { month: "price_month", year: "price_year" },
    });
    assert.deepEqual(stripeStartupErrors(env), []);
  });

  it("refuses to boot live mode without every live value", () => {
    const errors = stripeStartupErrors({ STRIPE_MODE: "live" });
    for (const name of [
      "STRIPE_LIVE_SECRET_KEY",
      "STRIPE_LIVE_PUBLISHABLE_KEY",
      "STRIPE_LIVE_WEBHOOK_SECRET",
      "STRIPE_LIVE_PRICE_MONTHLY",
      "STRIPE_LIVE_PRICE_YEARLY",
    ]) {
      assert.ok(errors.some((e) => e.includes(name)), name);
    }
  });
});

describe("test banners are mode-driven", () => {
  it("live copy never mentions test cards or no real charges", () => {
    const copy = billingCopy(billingState(true, "live"));
    assert.equal(copy.badge, null);
    assert.doesNotMatch(
      Object.values(copy).filter((v): v is string => typeof v === "string").join("\n"),
      /test mode|test card|no real charges/i,
    );
  });

  it("test copy still warns about test cards", () => {
    const copy = billingCopy(billingState(true, "test"));
    assert.match(copy.statusNote, /test mode/i);
    assert.match(copy.plansIntro, /no real charges/i);
  });
});

describe("docs/STRIPE_GO_LIVE.md", () => {
  const doc = read("docs/STRIPE_GO_LIVE.md");

  it("lists the Render webhook URL and the five event types", () => {
    assert.match(doc, /https:\/\/sadhana-ou9m\.onrender\.com\/api\/billing\/webhook/);
    for (const event of [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ]) {
      assert.match(doc, new RegExp(event.replace(/\./g, "\\.")));
    }
  });

  it("lists every STRIPE_LIVE_* env var and STRIPE_MODE=live", () => {
    assert.match(doc, /STRIPE_MODE/);
    for (const name of [
      "STRIPE_LIVE_SECRET_KEY",
      "STRIPE_LIVE_PUBLISHABLE_KEY",
      "STRIPE_LIVE_WEBHOOK_SECRET",
      "STRIPE_LIVE_PRICE_MONTHLY",
      "STRIPE_LIVE_PRICE_YEARLY",
      "BILLING_CANCEL_TOKEN_SECRET",
      "BILLING_ENABLED",
      "PUBLIC_APP_URL",
    ]) {
      assert.match(doc, new RegExp(name));
    }
  });

  it("webhook handler claims events for idempotency and matches mode", () => {
    const webhook = read("server/stripeWebhook.ts");
    assert.match(webhook, /claimStripeEvent/);
    assert.match(webhook, /matchesStripeMode\(event\.livemode\)/);
    const billing = read("server/billing.ts");
    assert.match(billing, /\/api\/billing\/webhook/);
    assert.match(billing, /\/api\/billing\/portal/);
    assert.match(billing, /\/api\/billing\/cancel/);
  });
});
