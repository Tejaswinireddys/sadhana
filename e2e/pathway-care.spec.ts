import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test("prenatal week asks for the trimester and says to check with a provider", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
  await page.goto("/pathways/prenatal-gentle-week");
  await expect(page.getByTestId("pathway-provider")).toContainText(/provider/i);
  await expect(page.getByTestId("pathway-stop-if")).toBeVisible();
  await expect(page.getByTestId("trimester-note")).toContainText(/Choose one/);
  await page.getByTestId("trimester-third").click();
  await expect(page.getByTestId("trimester-note")).toContainText(/wall squat/i);
});
