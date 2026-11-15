import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test.use({ reducedMotion: "reduce" });

test("Today stays readable when the system asks for less motion", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
  await page.goto("/");
  const card = page.getByTestId("today-practice");
  await expect(card).toBeVisible();
  const opacity = await card.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.9);
});
