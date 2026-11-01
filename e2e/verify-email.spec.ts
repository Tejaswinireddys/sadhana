import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

// /verify used to sit on "Verifying…" after the server had already signed the
// user in. Every outcome now has its own screen, and the link's single-use
// token is sent exactly once.

const verifiedUser = { id: 7, email: "verify@example.com", displayName: "Asha", emailVerified: true, plan: "free" };
const link = "/verify?token=tok_abcdefghijklmnop&email=verify%40example.com";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
  }, LEGAL_VERSION);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null, deviceRows: 0 } }));
});

test("a valid link verifies once, says so, and continues to the account", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/auth/verify-email", async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ token: "tok_abcdefghijklmnop", email: "verify@example.com" });
    if (calls > 1) return route.fulfill({ status: 400, json: { error: "Verification code is invalid or expired" } });
    return route.fulfill({ json: { user: verifiedUser, claimed: 0 } });
  });
  await page.goto(link);
  await expect(page.getByTestId("verify-success")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await expect(page.getByTestId("verify-success")).toContainText("Welcome, Asha");
  await expect(page.getByTestId("verify-pending")).toHaveCount(0);
  await page.getByTestId("verify-continue").click();
  await expect(page).toHaveURL(/\/account$/);
  expect(calls).toBe(1);
});

test("an expired link explains itself and offers to resend", async ({ page }) => {
  await page.route("**/api/auth/verify-email", (route) =>
    route.fulfill({ status: 400, json: { error: "Verification code is invalid or expired" } }));
  let resent: unknown = null;
  await page.route("**/api/auth/resend-verification", (route) => {
    resent = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, message: "If that email still needs verification, we sent a new link." } });
  });
  await page.goto(link);
  await expect(page.getByTestId("verify-invalid")).toContainText("Verification code is invalid or expired");
  await page.getByTestId("verify-invalid-resend").click();
  await expect.poll(() => resent).toEqual({ email: "verify@example.com" });
  await expect(page.getByTestId("verify-success")).toHaveCount(0);
});

test("a network failure offers Try again, which re-sends and succeeds", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/auth/verify-email", (route) => {
    calls++;
    if (calls === 1) return route.abort("internetdisconnected");
    return route.fulfill({ json: { user: verifiedUser, claimed: 0 } });
  });
  await page.goto(link);
  await expect(page.getByTestId("verify-network-error")).toBeVisible();
  await expect(page.getByTestId("verify-invalid")).toHaveCount(0);
  await page.getByTestId("verify-retry").click();
  await expect(page.getByTestId("verify-success")).toBeVisible();
  expect(calls).toBe(2);
});
