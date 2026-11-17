import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test("a meditation shows the AI-written note, captions, and a timer", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
  await page.goto("/meditation?slug=body-scan");
  await expect(page.getByRole("heading", { level: 1, name: "Meditation" })).toBeVisible();
  await expect(page.getByTestId("meditation-ai-note")).toContainText(/AI-written/);
  await expect(page.getByTestId("meditation-safety")).toBeVisible();
  await expect(page.getByTestId("meditation-caption")).toContainText(/Press start/);
  await page.getByTestId("button-meditation-start").click();
  await expect(page.getByTestId("meditation-caption")).toContainText(/Settle/);
  await expect(page.getByTestId("meditation-remaining")).toBeVisible();
  await page.getByTestId("button-meditation-timer").click();
  await expect(page.getByTestId("meditation-ai-note")).toHaveCount(0);
  await expect(page.getByTestId("meditation-bell-300")).toHaveAttribute("aria-pressed", "true");
});
