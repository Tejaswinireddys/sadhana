import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type Stripe from "stripe";
import {
  isStripeKeyForMode,
  matchesStripeMode,
  stripeConfig,
  stripeMode,
  stripeStartupErrors,
  stripeStartupMessage,
} from "./stripeConfig";
import { plusPrice } from "./stripePlus";
import { billingEnabled, publicConfig } from "./publicConfig";

function withEnv(vars: Record<string, string>, fn: () => void) {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith("STRIPE_") || key === "BILLING_ENABLED") delete process.env[key];
    Object.assign(process.env, vars);
    fn();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

/** What every existing deployment sets today: unprefixed test values. */
const CURRENT_TEST_ENV = {
  STRIPE_SECRET_KEY: "sk_test_current",
  STRIPE_WEBHOOK_SECRET: "whsec_current",
  STRIPE_PRICE_MONTHLY: "price_test_month",
  STRIPE_PRICE_YEARLY: "price_test_year",
};

const LIVE_ENV = {
  STRIPE_MODE: "live",
  STRIPE_LIVE_SECRET_KEY: "sk_live_abc",
  STRIPE_LIVE_PUBLISHABLE_KEY: "pk_live_abc",
  STRIPE_LIVE_WEBHOOK_SECRET: "whsec_live",
  STRIPE_LIVE_PRICE_MONTHLY: "price_live_month",
  STRIPE_LIVE_PRICE_YEARLY: "price_live_year",
};

test("mode defaults to test; only an explicit live is live", () => {
  assert.equal(stripeMode({}), "test");
  assert.equal(stripeMode({ STRIPE_MODE: "test" }), "test");
  assert.equal(stripeMode({ STRIPE_MODE: " LIVE " }), "live");
  assert.equal(stripeMode({ STRIPE_MODE: "production" }), "test", "unknown values never mean live");
});

test("test mode: today's unprefixed values keep working unchanged", () => {
  assert.deepEqual(stripeConfig(CURRENT_TEST_ENV), {
    mode: "test", secretKey: "sk_test_current", publishableKey: "", webhookSecret: "whsec_current",
    prices: { month: "price_test_month", year: "price_test_year" },
  });
  assert.deepEqual(stripeConfig({ STRIPE_PRICE_PLUS_MONTHLY: "price_legacy_m", STRIPE_PRICE_PLUS_YEARLY: "price_legacy_y" }).prices,
    { month: "price_legacy_m", year: "price_legacy_y" }, "legacy STRIPE_PRICE_PLUS_* aliases");
  assert.deepEqual(stripeStartupErrors(CURRENT_TEST_ENV), []);
  assert.deepEqual(stripeStartupErrors({}), [], "test mode with nothing set still boots (billing off)");
});

test("test mode: STRIPE_TEST_* wins over the unprefixed names", () => {
  const config = stripeConfig({
    ...CURRENT_TEST_ENV,
    STRIPE_TEST_SECRET_KEY: "sk_test_new", STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_new", STRIPE_TEST_WEBHOOK_SECRET: "whsec_new",
    STRIPE_TEST_PRICE_MONTHLY: "price_new_m", STRIPE_TEST_PRICE_YEARLY: "price_new_y",
  });
  assert.deepEqual(config, {
    mode: "test", secretKey: "sk_test_new", publishableKey: "pk_test_new", webhookSecret: "whsec_new",
    prices: { month: "price_new_m", year: "price_new_y" },
  });
});

test("live mode reads STRIPE_LIVE_* only, never the unprefixed test values", () => {
  assert.deepEqual(stripeConfig({ ...CURRENT_TEST_ENV, ...LIVE_ENV }), {
    mode: "live", secretKey: "sk_live_abc", publishableKey: "pk_live_abc", webhookSecret: "whsec_live",
    prices: { month: "price_live_month", year: "price_live_year" },
  });
  const missing = stripeConfig({ ...CURRENT_TEST_ENV, STRIPE_MODE: "live" });
  assert.deepEqual(missing, { mode: "live", secretKey: "", publishableKey: "", webhookSecret: "", prices: { month: "", year: "" } });
  assert.deepEqual(stripeStartupErrors({ ...CURRENT_TEST_ENV, ...LIVE_ENV }), []);
});

test("live mode lists every missing value at once", () => {
  assert.deepEqual(stripeStartupErrors({ ...CURRENT_TEST_ENV, STRIPE_MODE: "live" }), [
    "STRIPE_LIVE_SECRET_KEY is missing",
    "STRIPE_LIVE_PUBLISHABLE_KEY is missing",
    "STRIPE_LIVE_WEBHOOK_SECRET is missing",
    "STRIPE_LIVE_PRICE_MONTHLY is missing",
    "STRIPE_LIVE_PRICE_YEARLY is missing",
  ]);
  const { STRIPE_LIVE_WEBHOOK_SECRET: _omit, ...oneMissing } = LIVE_ENV;
  assert.deepEqual(stripeStartupErrors(oneMissing), ["STRIPE_LIVE_WEBHOOK_SECRET is missing"]);
  assert.deepEqual(stripeStartupErrors({ ...LIVE_ENV, STRIPE_LIVE_PRICE_YEARLY: "  " }), ["STRIPE_LIVE_PRICE_YEARLY is missing"], "blank is missing");
});

test("live mode rejects test-looking or malformed values", () => {
  assert.deepEqual(stripeStartupErrors({
    ...LIVE_ENV, STRIPE_LIVE_SECRET_KEY: "sk_test_oops", STRIPE_LIVE_PUBLISHABLE_KEY: "pk_test_oops",
    STRIPE_LIVE_WEBHOOK_SECRET: "secret", STRIPE_LIVE_PRICE_MONTHLY: "prod_123",
  }), [
    "STRIPE_LIVE_SECRET_KEY must be a live value (sk_live_… or rk_live_…)",
    "STRIPE_LIVE_PUBLISHABLE_KEY must be a live value (pk_live_…)",
    "STRIPE_LIVE_WEBHOOK_SECRET must be a live value (whsec_…)",
    "STRIPE_LIVE_PRICE_MONTHLY must be a live value (price_…)",
  ]);
  assert.deepEqual(stripeStartupErrors({ ...LIVE_ENV, STRIPE_LIVE_SECRET_KEY: "rk_live_restricted" }), [], "restricted live keys are fine");
  assert.deepEqual(stripeStartupErrors({ ...LIVE_ENV, STRIPE_LIVE_PRICE_YEARLY: "price_live_month" }),
    ["STRIPE_LIVE_PRICE_MONTHLY and STRIPE_LIVE_PRICE_YEARLY must be different prices"]);
});

test("an unknown STRIPE_MODE stops startup instead of guessing", () => {
  assert.deepEqual(stripeStartupErrors({ STRIPE_MODE: "production" }), ['STRIPE_MODE must be "test" or "live" (got "production")']);
  const message = stripeStartupMessage(stripeStartupErrors({ STRIPE_MODE: "live" }), { STRIPE_MODE: "live" });
  assert.match(message, /STRIPE_MODE=live\)\. The server will not start/);
  assert.match(message, /- STRIPE_LIVE_SECRET_KEY is missing/);
  assert.match(message, /STRIPE_MODE=test/);
});

test("keys and Stripe objects must belong to the configured mode", () => {
  assert.equal(isStripeKeyForMode("sk_test_x", "test"), true);
  assert.equal(isStripeKeyForMode("rk_test_x", "test"), true);
  assert.equal(isStripeKeyForMode("sk_live_x", "test"), false);
  assert.equal(isStripeKeyForMode("sk_live_x", "live"), true);
  assert.equal(isStripeKeyForMode("sk_test_x", "live"), false);
  assert.equal(isStripeKeyForMode("", "live"), false);
  assert.equal(matchesStripeMode(false, "test"), true);
  assert.equal(matchesStripeMode(true, "test"), false);
  assert.equal(matchesStripeMode(true, "live"), true);
  assert.equal(matchesStripeMode(false, "live"), false);
});

test("billing turns on only with a key of the configured mode, and the page is told the mode", () => {
  withEnv({ BILLING_ENABLED: "true", ...CURRENT_TEST_ENV }, () => {
    assert.equal(billingEnabled(), true, "today's test setup is unchanged");
    assert.equal(publicConfig().stripeMode, "test");
  });
  withEnv({ BILLING_ENABLED: "true", ...LIVE_ENV }, () => {
    assert.equal(billingEnabled(), true);
    assert.equal(publicConfig().stripeMode, "live");
  });
  withEnv({ BILLING_ENABLED: "true", ...LIVE_ENV, STRIPE_LIVE_SECRET_KEY: "sk_test_wrong_mode" }, () => {
    assert.equal(billingEnabled(), false, "a test key in live mode builds nothing");
  });
  withEnv({ BILLING_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_wrong_mode" }, () => {
    assert.equal(billingEnabled(), false, "a live key in test mode builds nothing");
  });
  withEnv({ ...LIVE_ENV }, () => assert.equal(billingEnabled(), false, "BILLING_ENABLED is still required"));
  const html = publicConfig();
  assert.equal(JSON.stringify(html).includes("sk_"), false, "no secret key in page settings");
});

test("plusPrice uses the mode's price ids and refuses prices from the other mode", async () => {
  const saved = { ...process.env };
  const price = (id: string, livemode: boolean) => ({
    id, active: true, livemode, currency: "usd", unit_amount: 5999, type: "recurring", billing_scheme: "per_unit",
    recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
  });
  const asked: string[] = [];
  const fake = (livemode: boolean) => ({ prices: { retrieve: async (id: string) => { asked.push(id); return price(id, livemode); } } }) as unknown as Stripe;
  try {
    Object.assign(process.env, CURRENT_TEST_ENV, LIVE_ENV);
    assert.deepEqual(await plusPrice(fake(true), "year"), { id: "price_live_year", amount: 59.99, currency: "USD" });
    await assert.rejects(plusPrice(fake(false), "year"), /active, fixed-amount live price/);
    process.env.STRIPE_MODE = "test";
    assert.deepEqual(await plusPrice(fake(false), "year"), { id: "price_test_year", amount: 59.99, currency: "USD" });
    await assert.rejects(plusPrice(fake(true), "year"), /active, fixed-amount test price/);
    assert.deepEqual(asked, ["price_live_year", "price_live_year", "price_test_year", "price_test_year"]);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("the server refuses to boot in live mode with missing values, naming them", () => {
  // Every live value set to "" so a developer's own .env cannot fill them in
  // (dotenv never overrides a variable that is already defined).
  const env = {
    ...process.env, NODE_ENV: "development", DATABASE_URL: "", PORT: "0", STRIPE_MODE: "live",
    STRIPE_LIVE_SECRET_KEY: "sk_live_present", STRIPE_LIVE_PUBLISHABLE_KEY: "", STRIPE_LIVE_WEBHOOK_SECRET: "",
    STRIPE_LIVE_PRICE_MONTHLY: "price_live_m", STRIPE_LIVE_PRICE_YEARLY: "",
  };
  const run = spawnSync(process.execPath, ["--import", "tsx", "server/index.ts"], { env, encoding: "utf8", timeout: 60_000 });
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /Stripe configuration is invalid \(STRIPE_MODE=live\)\. The server will not start/);
  assert.match(run.stderr, /STRIPE_LIVE_PUBLISHABLE_KEY is missing/);
  assert.match(run.stderr, /STRIPE_LIVE_WEBHOOK_SECRET is missing/);
  assert.match(run.stderr, /STRIPE_LIVE_PRICE_YEARLY is missing/);
  assert.doesNotMatch(run.stderr, /STRIPE_LIVE_SECRET_KEY is missing/);
  assert.doesNotMatch(run.stdout, /serving on/i, "it never started listening");
});
