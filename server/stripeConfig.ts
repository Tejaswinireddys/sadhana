/**
 * Which Stripe account mode the server runs in, and the keys, webhook secret
 * and Plus price ids for that mode.
 *
 * `STRIPE_MODE=test` (the default) reads `STRIPE_TEST_*`, falling back to the
 * unprefixed names every existing deployment already sets (`STRIPE_SECRET_KEY`,
 * `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`/`_YEARLY` and the legacy
 * `STRIPE_PRICE_PLUS_*`), so nothing changes until someone opts in.
 *
 * `STRIPE_MODE=live` reads `STRIPE_LIVE_*` only — never the unprefixed names,
 * which hold test values today — and the server refuses to boot until every
 * live value is present and looks like a live value (`stripeStartupErrors`).
 *
 * The mode is also the guard the code used to hard-wire as "test only": a
 * client is only built from a key of the configured mode, and events,
 * customers, prices and subscriptions from the other mode are rejected. So a
 * test key in live mode (or a live key in test mode) never charges anyone.
 */
export type StripeMode = "test" | "live";

export type StripeConfig = {
  mode: StripeMode;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  prices: { month: string; year: string };
};

type Env = Record<string, string | undefined>;

const first = (...values: Array<string | undefined>) => values.map((v) => v?.trim() ?? "").find(Boolean) ?? "";

/** `STRIPE_MODE`, defaulting to test. Anything other than test/live is reported by `stripeStartupErrors`. */
export function stripeMode(env: Env = process.env): StripeMode {
  return env.STRIPE_MODE?.trim().toLowerCase() === "live" ? "live" : "test";
}

/** Read the values for the configured mode. Never throws; missing values are "". */
export function stripeConfig(env: Env = process.env): StripeConfig {
  const mode = stripeMode(env);
  if (mode === "live") {
    return {
      mode,
      secretKey: first(env.STRIPE_LIVE_SECRET_KEY),
      publishableKey: first(env.STRIPE_LIVE_PUBLISHABLE_KEY),
      webhookSecret: first(env.STRIPE_LIVE_WEBHOOK_SECRET),
      prices: { month: first(env.STRIPE_LIVE_PRICE_MONTHLY), year: first(env.STRIPE_LIVE_PRICE_YEARLY) },
    };
  }
  return {
    mode,
    secretKey: first(env.STRIPE_TEST_SECRET_KEY, env.STRIPE_SECRET_KEY),
    publishableKey: first(env.STRIPE_TEST_PUBLISHABLE_KEY, env.STRIPE_PUBLISHABLE_KEY),
    webhookSecret: first(env.STRIPE_TEST_WEBHOOK_SECRET, env.STRIPE_WEBHOOK_SECRET),
    prices: {
      month: first(env.STRIPE_TEST_PRICE_MONTHLY, env.STRIPE_PRICE_MONTHLY, env.STRIPE_PRICE_PLUS_MONTHLY),
      year: first(env.STRIPE_TEST_PRICE_YEARLY, env.STRIPE_PRICE_YEARLY, env.STRIPE_PRICE_PLUS_YEARLY),
    },
  };
}

/** A secret (or restricted) key that belongs to `mode`. */
export function isStripeKeyForMode(key: string, mode: StripeMode): boolean {
  return key.startsWith(`sk_${mode}_`) || key.startsWith(`rk_${mode}_`);
}

/** True when a Stripe object's `livemode` flag belongs to the configured mode. */
export function matchesStripeMode(livemode: boolean | null | undefined, mode: StripeMode = stripeMode()): boolean {
  return Boolean(livemode) === (mode === "live");
}

/**
 * Why the server must not start, or [] when it may. Test mode keeps today's
 * behaviour (an unset or non-test key just leaves billing off), so only a
 * malformed `STRIPE_MODE` can stop it. Live mode needs every value, each in
 * its live form; every problem is listed at once so one fix-and-redeploy
 * cycle is enough.
 */
export function stripeStartupErrors(env: Env = process.env): string[] {
  const raw = env.STRIPE_MODE?.trim().toLowerCase();
  if (raw && raw !== "test" && raw !== "live") return [`STRIPE_MODE must be "test" or "live" (got "${env.STRIPE_MODE}")`];
  if (stripeMode(env) !== "live") return [];
  const config = stripeConfig(env);
  const checks: Array<[name: string, value: string, ok: (v: string) => boolean, shape: string]> = [
    ["STRIPE_LIVE_SECRET_KEY", config.secretKey, (v) => isStripeKeyForMode(v, "live"), "sk_live_… or rk_live_…"],
    ["STRIPE_LIVE_PUBLISHABLE_KEY", config.publishableKey, (v) => v.startsWith("pk_live_"), "pk_live_…"],
    ["STRIPE_LIVE_WEBHOOK_SECRET", config.webhookSecret, (v) => v.startsWith("whsec_"), "whsec_…"],
    ["STRIPE_LIVE_PRICE_MONTHLY", config.prices.month, (v) => v.startsWith("price_"), "price_…"],
    ["STRIPE_LIVE_PRICE_YEARLY", config.prices.year, (v) => v.startsWith("price_"), "price_…"],
  ];
  const errors: string[] = [];
  for (const [name, value, ok, shape] of checks) {
    if (!value) errors.push(`${name} is missing`);
    else if (!ok(value)) errors.push(`${name} must be a live value (${shape})`);
  }
  if (config.prices.month && config.prices.month === config.prices.year) {
    errors.push("STRIPE_LIVE_PRICE_MONTHLY and STRIPE_LIVE_PRICE_YEARLY must be different prices");
  }
  return errors;
}

/** One message for the boot log: what is wrong and what to set. */
export function stripeStartupMessage(errors: string[], env: Env = process.env): string {
  return [
    `[billing] Stripe configuration is invalid (STRIPE_MODE=${env.STRIPE_MODE?.trim() || "test"}). The server will not start:`,
    ...errors.map((e) => `  - ${e}`),
    "Set the STRIPE_LIVE_* variables (see README → Stripe), or set STRIPE_MODE=test.",
  ].join("\n");
}
