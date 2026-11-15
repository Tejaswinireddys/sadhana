import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

async function seed(page: import("@playwright/test").Page, experience?: string) {
  await page.addInitScript(
    ([version, level]) => {
      localStorage.setItem(
        "sadhana.legalAck",
        JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
      );
      localStorage.setItem("sadhana.welcome.seen", "1");
      localStorage.setItem("sadhana.onboarding.done", "1");
      if (level) localStorage.setItem("sadhana.experience.level", level);
    },
    [LEGAL_VERSION, experience ?? ""] as const,
  );
}

test.describe("Breathing library", () => {
  test("Dirga is a timer with steps and a safety note, and no invented recording", async ({ page }) => {
    await seed(page);
    await page.goto("/breathing?slug=dirga");
    await expect(page.getByTestId("text-active-technique")).toHaveText("Dirga");
    await expect(page.getByTestId("breath-steps")).toContainText(/belly/i);
    await expect(page.getByTestId("safety-dirga")).toContainText(/dizzy/i);
    await expect(page.getByTestId("avoid-dirga")).toBeVisible();
    await expect(page.getByTestId("breath-no-recording")).toBeVisible();
    await expect(page.getByTestId("button-breath-start")).toBeVisible();
  });

  test("Kapalabhati stays closed for a new practitioner", async ({ page }) => {
    await seed(page, "new");
    await page.goto("/breathing?slug=kapalabhati");
    await expect(page.getByTestId("breath-locked")).toBeVisible();
    await expect(page.getByTestId("button-breath-start")).toHaveCount(0);
    await expect(page.getByTestId("avoid-kapalabhati")).toContainText(/pregnant/i);
  });

  test("Bhastrika opens once experience is regular, with the stop-immediately note", async ({ page }) => {
    await seed(page, "regular");
    await page.goto("/breathing?slug=bhastrika");
    await expect(page.getByTestId("breath-locked")).toHaveCount(0);
    await expect(page.getByTestId("button-breath-start")).toBeVisible();
    await expect(page.getByTestId("safety-bhastrika")).toContainText(/Stop immediately/i);
  });
});
