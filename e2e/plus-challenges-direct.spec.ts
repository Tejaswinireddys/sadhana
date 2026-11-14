import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * QA reported /plus and /challenges looking like a 403 when typed in the
 * address bar. Server HTML is already 200; these assert the client paints the
 * real page on a cold load in a fresh context (no prior in-app navigation).
 *
 * Local "403 PERMISSION_DENIED" on port 5000 is macOS AirPlay Receiver, not
 * this app — see playwright.config.ts (use E2E_PORT=5055). Production SW
 * navigation is network-first to the SPA shell (client/public/sw.js); Vite
 * e2e does not install that SW, so shell fallback is covered by unit/source
 * pins and live probes.
 */

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

test("cold load of /plus paints the plans page (not a permission screen)", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);

  const res = await page.goto("/plus", { waitUntil: "domcontentloaded" });
  expect(res?.ok()).toBeTruthy();
  await expect(page.getByTestId("paywall-root")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
  await expect(page.getByText(/PERMISSION_DENIED|403|Access denied|Page not found/i)).toHaveCount(0);
  await expect(page.getByTestId("plus-upgrade-screen")).toHaveCount(0);

  // See-also third link must have a visible label (Cancel or Help).
  const seeAlso = page.getByTestId("plus-see-also");
  await expect(seeAlso).toBeVisible();
  await expect(seeAlso).not.toContainText("and .");
  const third =
    (await page.getByTestId("plus-see-help").count()) > 0
      ? page.getByTestId("plus-see-help")
      : page.getByTestId("plus-see-cancel");
  await expect(third).toBeVisible();
  await expect(third).not.toHaveText("");

  await page.reload();
  await expect(page.getByTestId("paywall-root")).toBeVisible();
  await context.close();
});

test("cold load of /challenges paints the challenges page (not a permission screen)", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);

  const res = await page.goto("/challenges", { waitUntil: "domcontentloaded" });
  expect(res?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Challenges" })).toBeVisible();
  await expect(page.getByTestId("buddy-code")).toBeVisible();
  await expect(page.getByText(/PERMISSION_DENIED|403|Access denied|Page not found/i)).toHaveCount(0);
  await expect(page.getByTestId("plus-upgrade-screen")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Challenges" })).toBeVisible();
  await context.close();
});
