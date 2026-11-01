import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
  }, LEGAL_VERSION);
  await page.route("**/api/billing/config", (route) => route.fulfill({ json: {
    enabled: true, portalAvailable: true, note: "Stripe test mode",
    prices: { month: { amount: 12, currency: "USD" }, year: { amount: 90, currency: "USD" } },
  } }));
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: {
    user: { id: 1, email: "test@example.com", emailVerified: true, plan: "free" }, deviceRows: 0,
  } }));
});

for (const [interval, label, amount] of [["month", "Monthly", 12], ["year", "Yearly", 90]] as const) {
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
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByTestId("plan-card-plus")).toContainText(`$${amount}`);
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


for (const guest of [true, false]) {
  test(`Subscribe sends ${guest ? "guests to signup" : "unverified accounts to verification"}`, async ({ page }) => {
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: {
      user: guest ? null : { id: 1, email: "unverified@example.com", emailVerified: false, plan: "free" }, deviceRows: 0,
    } }));
    // Account prerequisites remain actionable even before billing is configured.
    await page.route("**/api/billing/config", (route) => route.fulfill({ json: { enabled: false, note: "Unavailable" } }));
    let billingWrites = 0;
    await page.route(/\/api\/billing\/(consent|checkout)$/, (route) => {
      billingWrites++;
      return route.fulfill({ status: 500 });
    });
    await page.goto("/plus");
    await page.getByTestId("plan-select-plus").click();
    await expect(page).toHaveURL(guest ? /\/account\?tab=create$/ : /\/verify\?email=unverified%40example.com$/);
    if (guest) {
      await expect(page.getByTestId("signup-email")).toBeVisible();
    } else {
      await expect(page.getByTestId("verify-email")).toHaveValue("unverified@example.com");
      await expect(page.getByTestId("verify-token")).toBeVisible();
    }
    expect(billingWrites).toBe(0);
  });
}

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
    // The webhook lands a few polls after the redirect back from Stripe.
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
