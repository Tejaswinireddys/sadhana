import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

// Regression: `fetchPriority` (camelCase) is unknown to React 18, so Today
// logged "React does not recognize the `fetchPriority` prop" as a console
// error on every load in development. The attributes must still be set.

test("Today renders pose images without React's unknown-prop warning", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
  const warnings: string[] = [];
  page.on("console", (m) => { if (/does not recognize the .* prop/.test(m.text())) warnings.push(m.text()); });
  await page.goto("/");
  await expect(page.locator("main img").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(warnings).toEqual([]);
  // Every pose image says how it should be fetched, as a real DOM attribute.
  const attrs = await page.locator("main picture img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("fetchpriority")));
  expect(attrs.length).toBeGreaterThan(0);
  expect(attrs.every((a) => a === "high" || a === "auto")).toBe(true);
});

test("the welcome page's first pose image is fetched with high priority", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
  }, LEGAL_VERSION);
  await page.goto("/welcome");
  await expect(page.locator('img[fetchpriority="high"]').first()).toBeAttached();
});
