import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test("today's limb shows Devanagari, IAST, and a practice link", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
    localStorage.setItem("sadhana.eightLimbs.start", "2026-11-01");
  }, LEGAL_VERSION);
  await page.goto("/eight-limbs");
  await expect(page.getByTestId("eight-limb-devanagari")).not.toBeEmpty();
  await expect(page.getByTestId("eight-limb-iast")).toContainText(/IAST:/);
  await expect(page.getByTestId("eight-limb-practice")).toBeVisible();
  await page.getByTestId("eight-limb-speak").click();
  await expect(page.getByTestId("eight-limb-voice-note")).toContainText(/computer voice|no computer voice/i);
});
