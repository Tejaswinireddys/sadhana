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
    user: { id: 1, email: "test@example.com", plan: "free" }, deviceRows: 0,
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
    user: { id: 1, email: "test@example.com", plan: "plus" }, deviceRows: 0,
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
