/**
 * Decides whether the Plus subscription E2E (`plus-subscription.spec.ts`) may
 * run, from the environment alone. Pure, so the refusals are unit-tested
 * (`script/plusSubscriptionPreflight.test.ts`) even on a machine with no keys.
 *
 * The test talks to the real Stripe API and writes to a real Postgres, so the
 * rules are deliberately one-sided — when in doubt, do not run:
 *
 * - **Stripe TEST mode only.** The secret key must be `sk_test_…`/`rk_test_…`.
 *   A live key anywhere in the variables this test reads is a refusal, not a
 *   warning, and `STRIPE_LIVE_*` is never read or passed on.
 * - **Never production data.** The database comes only from
 *   `PLUS_E2E_DATABASE_URL` (or CI's `BILLING_TEST_DATABASE_URL`) and must be a
 *   loopback Postgres. `DATABASE_URL` — which a developer's `.env` points at a
 *   hosted database — is ignored entirely. The spec then creates its own
 *   throwaway database on that server and drops it afterwards.
 * - **No pretending.** Anything missing is a skip that names what is missing.
 */
export type PlusE2eConfig = {
  stripeSecretKey: string;
  /** Optional; only ever a `pk_test_…`, which is public by design. */
  stripePublishableKey: string | null;
  priceMonthly: string;
  priceYearly: string;
  /** The loopback server to create the throwaway database on. */
  adminDatabaseUrl: string;
};

export type PlusE2ePreflight = { ok: true; config: PlusE2eConfig } | { ok: false; reason: string };

type Env = Record<string, string | undefined>;

const first = (...values: Array<string | undefined>) => values.map((v) => v?.trim() ?? "").find(Boolean) ?? "";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LIVE_KEY = /^(sk|rk|pk)_live_/;

export function plusE2ePreflight(env: Env = process.env): PlusE2ePreflight {
  // The same test-mode names the server reads (server/stripeConfig.ts).
  const secret = first(env.STRIPE_TEST_SECRET_KEY, env.STRIPE_SECRET_KEY);
  const publishable = first(env.STRIPE_TEST_PUBLISHABLE_KEY, env.STRIPE_PUBLISHABLE_KEY);
  const month = first(env.STRIPE_TEST_PRICE_MONTHLY, env.STRIPE_PRICE_MONTHLY, env.STRIPE_PRICE_PLUS_MONTHLY);
  const year = first(env.STRIPE_TEST_PRICE_YEARLY, env.STRIPE_PRICE_YEARLY, env.STRIPE_PRICE_PLUS_YEARLY);
  const database = first(env.PLUS_E2E_DATABASE_URL, env.BILLING_TEST_DATABASE_URL);

  // Refusals first: a live key is never "close enough".
  if (LIVE_KEY.test(secret) || LIVE_KEY.test(publishable)) {
    return { ok: false, reason: "refusing to run: a LIVE Stripe key is set where a test key belongs. This test only ever uses Stripe test mode." };
  }
  if (secret && !/^(sk|rk)_test_/.test(secret)) {
    return { ok: false, reason: "refusing to run: STRIPE_TEST_SECRET_KEY is not a Stripe test-mode secret key (sk_test_… or rk_test_…)." };
  }

  const missing: string[] = [];
  if (!secret) missing.push("STRIPE_TEST_SECRET_KEY (sk_test_…)");
  if (!month) missing.push("STRIPE_TEST_PRICE_MONTHLY (price_…)");
  if (!year) missing.push("STRIPE_TEST_PRICE_YEARLY (price_…)");
  if (!database) missing.push("PLUS_E2E_DATABASE_URL (a local Postgres, e.g. postgresql://localhost:5432/postgres)");
  if (missing.length) {
    return { ok: false, reason: `needs real Stripe TEST keys and an isolated local database; missing ${missing.join(", ")}.` };
  }

  for (const [name, value] of [["STRIPE_TEST_PRICE_MONTHLY", month], ["STRIPE_TEST_PRICE_YEARLY", year]] as const) {
    if (!value.startsWith("price_")) return { ok: false, reason: `refusing to run: ${name} is not a Stripe price id (price_…).` };
  }
  if (month === year) return { ok: false, reason: "refusing to run: the monthly and yearly price ids are the same price." };

  let url: URL;
  try { url = new URL(database); } catch { return { ok: false, reason: "refusing to run: PLUS_E2E_DATABASE_URL is not a valid URL." }; }
  if (!/^postgres(ql)?:$/.test(url.protocol)) return { ok: false, reason: "refusing to run: PLUS_E2E_DATABASE_URL is not a postgres:// URL." };
  if (!LOOPBACK.has(url.hostname)) {
    // Host only — never echo credentials from a connection string.
    return { ok: false, reason: `refusing to run: the test database host "${url.hostname}" is not this machine. Only a loopback Postgres (localhost / 127.0.0.1) is accepted, so a production or shared database can never be used.` };
  }

  return {
    ok: true,
    config: {
      stripeSecretKey: secret,
      stripePublishableKey: publishable.startsWith("pk_test_") ? publishable : null,
      priceMonthly: month,
      priceYearly: year,
      adminDatabaseUrl: url.toString(),
    },
  };
}
