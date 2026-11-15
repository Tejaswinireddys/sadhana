import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test("settings can save the queued practice for offline", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
  await page.goto("/settings");
  await expect(page.getByText("Offline practice")).toBeVisible();
  await expect(page.getByTestId("settings-offline-download")).toHaveText(/Save for offline/);
  await expect(page.getByText(/can open while you are offline/)).toBeVisible();
});
