import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";
import { AI_TRAINER_LESSON_SLUGS } from "../client/src/data/aiTrainerLessons";

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

test("pose cards with an AI trainer lesson show an AI video badge", async ({ page }) => {
  await page.goto("/asanas");
  await expect(page.getByTestId("chip-pose-count")).toBeVisible();
  for (const slug of AI_TRAINER_LESSON_SLUGS) {
    // Ensure the card is in the progressive list (AI poses are early catalog entries).
    const card = page.getByTestId(`card-asana-${slug}`);
    if ((await card.count()) === 0) {
      await page.getByTestId("filter-ai-video").click();
    }
    await expect(page.getByTestId(`badge-ai-video-${slug}`)).toBeVisible();
  }
});

test("With AI video filter is a pressed toggle and syncs to ?ai=1", async ({ page }) => {
  await page.goto("/asanas");
  const toggle = page.getByTestId("filter-ai-video");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("ai")).toBe("1");

  const cards = page.locator('[data-testid^="card-asana-"]');
  await expect(cards).toHaveCount(AI_TRAINER_LESSON_SLUGS.length);
  for (const slug of AI_TRAINER_LESSON_SLUGS) {
    await expect(page.getByTestId(`card-asana-${slug}`)).toBeVisible();
  }

  await page.goto("/asanas?ai=1");
  await expect(page.getByTestId("filter-ai-video")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid^="card-asana-"]')).toHaveCount(
    AI_TRAINER_LESSON_SLUGS.length,
  );
});
