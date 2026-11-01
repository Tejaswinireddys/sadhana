import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

// With BILLING_ENABLED unset (the default), Plus is waitlist-only: the cancel
// pages must say so, link to the waitlist, and never call billing endpoints
// that can only answer 404 because no subscription can exist.

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
});

function billingRequests(page: import("@playwright/test").Page): string[] {
  const seen: string[] = [];
  page.on("request", (req) => {
    const path = new URL(req.url()).pathname;
    if (path.startsWith("/api/billing/cancel")) seen.push(path);
  });
  return seen;
}

test.describe("cancel pages while Plus is waitlist-only", () => {
  test("/cancel says Plus is not available and links to the waitlist", async ({ page }) => {
    await page.goto("/cancel");
    const notice = page.getByTestId("plus-not-available");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("not available yet");
    await expect(notice).toContainText("nothing to refund");
    await expect(page.getByTestId("link-plus-waitlist")).toHaveAttribute("href", "/plus#waitlist");
    // No refund or two-tap instructions for a plan nobody can buy.
    await expect(page.getByText("First-charge refund")).toHaveCount(0);
    await expect(page.getByTestId("cancel-start-two-tap")).toHaveCount(0);
  });

  test("/cancel/confirm does not request cancel-preview", async ({ page }) => {
    const calls = billingRequests(page);
    await page.goto("/cancel/confirm");
    await expect(page.getByTestId("plus-not-available")).toBeVisible();
    await expect(page.getByText("No active paid subscription found on this device")).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    expect(calls).toEqual([]);
  });

  test("a cancel link with a token does not call cancel-token", async ({ page }) => {
    const calls = billingRequests(page);
    await page.goto("/cancel?token=stale-email-link");
    await expect(page.getByTestId("plus-not-available")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(calls).toEqual([]);
    await expect(page.getByTestId("cancel-done")).toHaveCount(0);
  });

  test("the legacy waitlist link now opens subscription choices", async ({ page }) => {
    await page.goto("/cancel");
    await page.getByTestId("link-plus-waitlist").click();
    await expect(page).toHaveURL(/\/plus#waitlist$/);
    await expect(page.getByTestId("plan-select-plus")).toHaveText("Subscribe");
    await expect(page.getByTestId("plan-select-plus")).toBeEnabled();
    await expect(page.getByTestId("plus-account-status")).toContainText("test mode");
    await expect(page.getByTestId("plus-waitlist")).toHaveCount(0);
  });

  test("the waitlist rejects an address that is not one", async ({ request }) => {
    const res = await request.post("/api/plus-waitlist", { data: { email: "not-an-email" } });
    expect(res.status()).toBe(400);
  });

  test("the server serves /cancel as a page, not a 404", async ({ request }) => {
    const res = await request.get("/cancel");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
  });
});
