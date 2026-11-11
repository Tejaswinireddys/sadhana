/**
 * The Plus subscription E2E touches the real Stripe API and a real Postgres,
 * so what it refuses to run against matters more than what it does. These
 * run in `npm test`, on machines with no Stripe keys at all.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { plusE2ePreflight } from "../e2e/support/plusSubscriptionPreflight";

const ready = {
  STRIPE_TEST_SECRET_KEY: "sk_test_abc123",
  STRIPE_TEST_PRICE_MONTHLY: "price_month",
  STRIPE_TEST_PRICE_YEARLY: "price_year",
  PLUS_E2E_DATABASE_URL: "postgresql://tester:pw@127.0.0.1:5432/postgres",
};
const reason = (env: Record<string, string | undefined>) => {
  const result = plusE2ePreflight(env);
  assert.equal(result.ok, false);
  return result.ok ? "" : result.reason;
};

describe("Plus subscription E2E preflight", () => {
  it("skips, naming exactly what is missing, when there are no Stripe test keys", () => {
    const text = reason({});
    assert.match(text, /needs real Stripe TEST keys and an isolated local database/);
    for (const name of ["STRIPE_TEST_SECRET_KEY", "STRIPE_TEST_PRICE_MONTHLY", "STRIPE_TEST_PRICE_YEARLY", "PLUS_E2E_DATABASE_URL"]) assert.match(text, new RegExp(name));
    assert.match(reason({ ...ready, STRIPE_TEST_PRICE_YEARLY: "" }), /missing STRIPE_TEST_PRICE_YEARLY/);
  });

  it("runs with test keys and a loopback database", () => {
    const result = plusE2ePreflight({ ...ready, STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_public" });
    assert.deepEqual(result, { ok: true, config: {
      stripeSecretKey: "sk_test_abc123", stripePublishableKey: "pk_test_public",
      priceMonthly: "price_month", priceYearly: "price_year",
      adminDatabaseUrl: "postgresql://tester:pw@127.0.0.1:5432/postgres",
    } });
    assert.equal(plusE2ePreflight({ ...ready, STRIPE_TEST_SECRET_KEY: "rk_test_restricted" }).ok, true);
    assert.equal(plusE2ePreflight({ ...ready, PLUS_E2E_DATABASE_URL: undefined, BILLING_TEST_DATABASE_URL: "postgresql://localhost/billing_test" }).ok, true, "CI's variable");
  });

  it("refuses a live Stripe key, whichever variable it arrives in", () => {
    for (const env of [
      { ...ready, STRIPE_TEST_SECRET_KEY: "sk_live_real" },
      { ...ready, STRIPE_TEST_SECRET_KEY: "rk_live_real" },
      { ...ready, STRIPE_TEST_SECRET_KEY: undefined, STRIPE_SECRET_KEY: "sk_live_real" },
      { ...ready, STRIPE_TEST_PUBLISHABLE_KEY: "pk_live_real" },
    ]) assert.match(reason(env), /LIVE Stripe key/);
    assert.match(reason({ ...ready, STRIPE_TEST_SECRET_KEY: "whsec_not_a_key" }), /not a Stripe test-mode secret key/);
  });

  it("never reads STRIPE_LIVE_* or DATABASE_URL", () => {
    const live = { STRIPE_MODE: "live", STRIPE_LIVE_SECRET_KEY: "sk_live_real", STRIPE_LIVE_PRICE_MONTHLY: "price_live_m", STRIPE_LIVE_PRICE_YEARLY: "price_live_y" };
    assert.match(reason({ ...live, DATABASE_URL: "postgresql://localhost/app" }), /missing STRIPE_TEST_SECRET_KEY/);
    const result = plusE2ePreflight({ ...ready, ...live, DATABASE_URL: "postgresql://u:p@db.prod.example:5432/app" });
    assert.equal(result.ok && result.config.stripeSecretKey, "sk_test_abc123");
    assert.equal(result.ok && result.config.adminDatabaseUrl, "postgresql://tester:pw@127.0.0.1:5432/postgres");
  });

  it("refuses any database that is not on this machine, without echoing its credentials", () => {
    for (const url of [
      "postgresql://postgres:s3cret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
      "postgresql://app:s3cret@db.internal:5432/app_test",
      "postgresql://app:s3cret@10.0.0.5/test",
    ]) {
      const text = reason({ ...ready, PLUS_E2E_DATABASE_URL: url });
      assert.match(text, /is not this machine/);
      assert.doesNotMatch(text, /s3cret/);
    }
    assert.match(reason({ ...ready, PLUS_E2E_DATABASE_URL: "mysql://localhost/test" }), /not a postgres:\/\/ URL/);
    assert.match(reason({ ...ready, PLUS_E2E_DATABASE_URL: "not a url" }), /not a valid URL/);
  });

  it("refuses price ids that are not prices, or are the same price twice", () => {
    assert.match(reason({ ...ready, STRIPE_TEST_PRICE_MONTHLY: "prod_123" }), /not a Stripe price id/);
    assert.match(reason({ ...ready, STRIPE_TEST_PRICE_YEARLY: "price_month" }), /same price/);
  });
});
