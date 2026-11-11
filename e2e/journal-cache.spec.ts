import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

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

test("journal list updates after save and delete without a refresh", async ({ page }) => {
  await page.goto("/journal");
  await expect(page.getByTestId("button-new-entry")).toBeVisible();

  await page.getByTestId("button-new-entry").click();
  await page.getByTestId("input-entry-title").fill("Cache check");
  await page.getByTestId("input-entry-body").fill("Appears in the list immediately.");
  await page.getByTestId("button-save-entry").click();

  const card = page.locator("[data-testid^='card-journal-']").filter({ hasText: "Cache check" });
  await expect(card).toBeVisible();
  await expect(page.getByText("Your journal is empty")).toHaveCount(0);

  const deleteBtn = card.locator("[data-testid^='button-delete-']");
  await deleteBtn.click();
  await page.getByTestId("button-confirm-delete").click();
  await expect(card).toHaveCount(0);
});
