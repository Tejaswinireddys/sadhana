import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

async function seedLegal(page: import("@playwright/test").Page) {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
  }, LEGAL_VERSION);
}

/** Rewrite the embedded public-config so /plus follows the simulated billing state. */
async function rewritePublicBilling(
  page: import("@playwright/test").Page,
  opts: { enabled: boolean; mode?: "test" | "live" },
) {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const res = await route.fetch();
    const html = (await res.text()).replace(
      /(<script type="application\/json" id="public-config">)([\s\S]*?)(<\/script>)/,
      (_m, open: string, json: string, close: string) =>
        open +
        JSON.stringify({
          ...JSON.parse(json),
          billingEnabled: opts.enabled,
          stripeMode: opts.mode ?? "test",
        }) +
        close,
    );
    return route.fulfill({ response: res, body: html });
  });
}

test.describe("when Stripe test billing is on", () => {
  test.beforeEach(async ({ page }) => {
    await seedLegal(page);
    await rewritePublicBilling(page, { enabled: true, mode: "test" });
    await page.route("**/api/billing/config", (route) => route.fulfill({ json: {
      enabled: true, portalAvailable: true, note: "Stripe test mode",
      prices: { month: { amount: 12, currency: "USD" }, year: { amount: 90, currency: "USD" } },
    } }));
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: {
      user: { id: 1, email: "test@example.com", emailVerified: true, plan: "free" }, deviceRows: 0,
    } }));
  });

  for (const [interval, amount] of [["month", 12], ["year", 90]] as const) {
    test(`Subscribe sends ${interval} and the displayed Stripe price`, async ({ page }) => {
      let consent: Record<string, unknown> = {};
      let checkout: Record<string, unknown> = {};
      await page.route("**/api/billing/consent", (route) => {
        consent = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      });
      await page.route("**/api/billing/checkout", (route) => {
        checkout = route.request().postDataJSON();
        return route.fulfill({ json: { url: "https://checkout.stripe.com/c/pay/test_session" } });
      });
      await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ body: "Stripe test Checkout" }));
      await page.goto("/plus");
      await page.getByTestId(`interval-${interval}`).click();
      await expect(page.getByTestId("plan-card-plus")).toContainText(`$${amount}`);
      await expect(page.getByTestId("plan-select-plus")).toBeEnabled();
      await page.getByTestId("plan-select-plus").click();
      await expect(page).toHaveURL("https://checkout.stripe.com/c/pay/test_session");
      expect(consent).toMatchObject({ plan: "plus", interval, amount, currency: "USD" });
      expect(checkout).toEqual({ plan: "plus", interval });
    });
  }

  test("Manage / cancel opens the account Customer Portal", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: {
      user: { id: 1, email: "test@example.com", emailVerified: true, plan: "plus" }, deviceRows: 0,
    } }));
    await page.route("**/api/billing/portal", (route) => route.fulfill({ json: { url: "https://billing.stripe.com/p/session/test" } }));
    await page.route("https://billing.stripe.com/**", (route) => route.fulfill({ body: "Stripe test portal" }));
    await page.goto("/plus");
    await expect(page.getByTestId("plus-account-status")).toHaveText("Your account has Plus access.");
    await page.getByTestId("billing-portal").click();
    await expect(page).toHaveURL("https://billing.stripe.com/p/session/test");
  });

  test("a success query string alone does not grant Plus access", async ({ page }) => {
    await page.goto("/plus?checkout=success");
    await expect(page.getByTestId("plus-account-status")).toContainText("Waiting for subscription confirmation");
    await expect(page.getByTestId("plus-account-status")).not.toContainText("has Plus access");
  });

  const plusMe = { user: { id: 1, email: "test@example.com", emailVerified: true, plan: "plus" }, deviceRows: 0 };

  test("a cancel at period end shows the end date and offers Manage subscription", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: plusMe }));
    await page.route("**/api/billing/entitlement", (route) => route.fulfill({ json: {
      plan: "plus", status: "active", renewsAt: "2026-12-31T12:00:00.000Z",
      cancelAtPeriodEnd: true, accessUntil: "2026-12-31T12:00:00.000Z", refundEligible: false,
    } }));
    await page.goto("/plus");
    await expect(page.getByTestId("plus-account-status")).toHaveText(
      /^Your Plus plan is set to cancel on .*2026\. You keep access until then\.$/,
    );
    await expect(page.getByTestId("billing-portal")).toHaveText("Manage subscription");
    await expect(page.getByTestId("plus-cancel-cta")).toHaveCount(0);
    await expect(page.getByTestId("plus-no-subscription")).toHaveCount(0);
  });

  test("an in-flight session fetch shows loading, never 'Sign in to subscribe'", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/auth/me", async (route) => {
      await gate;
      return route.fulfill({ json: plusMe });
    });
    await page.goto("/plus");
    await expect(page.getByTestId("plus-account-status")).toHaveAttribute("data-status", "loading");
    await expect(page.getByTestId("plus-sign-in")).toHaveCount(0);
    await expect(page.getByTestId("plus-no-subscription")).toHaveCount(0);
    release();
    await expect(page.getByTestId("plus-account-status")).toHaveText("Your account has Plus access.");
    await expect(page.getByTestId("plus-sign-in")).toHaveCount(0);
  });

  test("after Checkout, /plus polls until Plus is active and updates without a reload", async ({ page }) => {
    let meCalls = 0;
    let confirmed = false;
    await page.route("**/api/auth/me", (route) => {
      meCalls++;
      if (meCalls >= 3) confirmed = true;
      return route.fulfill({ json: { ...plusMe, user: { ...plusMe.user, plan: confirmed ? "plus" : "free" } } });
    });
    await page.route("**/api/billing/entitlement", (route) => route.fulfill({ json: confirmed
      ? { plan: "plus", status: "active", renewsAt: "2026-12-31T12:00:00.000Z", cancelAtPeriodEnd: false, accessUntil: null }
      : { plan: "free", status: "inactive", renewsAt: null, cancelAtPeriodEnd: false, accessUntil: null } }));
    await page.goto("/plus?checkout=success");
    await page.evaluate(() => { (window as unknown as { __noReload: boolean }).__noReload = true; });
    await expect(page.getByTestId("plus-account-status")).toContainText("Waiting for subscription confirmation");
    await expect(page.getByTestId("plus-account-status")).toHaveText("Your account has Plus access.", { timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    const settled = meCalls;
    await page.waitForTimeout(3_500);
    expect(meCalls, "polling stops once Plus is active").toBe(settled);
  });
});

test.describe("when purchasing is unavailable", () => {
  test.beforeEach(async ({ page }) => {
    await seedLegal(page);
    await rewritePublicBilling(page, { enabled: false });
    await page.route("**/api/billing/config", (route) =>
      route.fulfill({ json: { enabled: false, note: "Unavailable" } }),
    );
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null, deviceRows: 0 } }));
  });

  test("the Plus action is Coming soon and does not start checkout", async ({ page }) => {
    let billingWrites = 0;
    await page.route(/\/api\/billing\/(consent|checkout)$/, (route) => {
      billingWrites++;
      return route.fulfill({ status: 500 });
    });
    await page.goto("/plus");
    const select = page.getByTestId("plan-select-plus");
    await expect(select).toHaveText("Coming soon");
    await expect(select).toBeDisabled();
    await expect(page.getByTestId("plans-intro")).toContainText("Plus is coming soon");
    expect(billingWrites).toBe(0);
  });
});
