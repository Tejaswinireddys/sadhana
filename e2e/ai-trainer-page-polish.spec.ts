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

test.describe("AI trainer page polish", () => {
  for (const slug of AI_TRAINER_LESSON_SLUGS) {
    test(`${slug} hides the static-reference fallback under the AI trainer`, async ({ page }) => {
      await page.goto(`/asanas/${slug}`);
      await expect(page.getByTestId("ai-trainer-lesson")).toBeVisible();
      await expect(page.getByTestId("lesson-media-disclosure")).toHaveCount(0);
      await expect(page.getByTestId("pose-lesson-media-label")).toHaveCount(0);
    });
  }

  test("starting the pose lesson pauses the AI trainer video", async ({ page }) => {
    await page.goto("/asanas/tadasana");
    const aiVideo = page.getByTestId("ai-trainer-lesson").getByTestId("video-player-element");
    await expect(aiVideo).toBeVisible();
    await aiVideo.evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect.poll(async () => aiVideo.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);

    await page.getByTestId("button-watch-demo-tadasana").click();
    await expect(page.getByTestId("lesson-live-cue")).toBeVisible();
    await expect.poll(async () => aiVideo.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });
});

test("asanas grid cards show illustrations, not blank placeholders", async ({ page }) => {
  await page.goto("/asanas");
  await expect(page.getByTestId("chip-pose-count")).toBeVisible();
  // Library cards pass an explicit testId (asana-thumb-*), not the PoseCardVideo default.
  const cards = page.locator('[data-testid^="asana-thumb-"]');
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(20);
  // Sample the first 24 cards — each must show a decoded illustration or the
  // intentional withheld/error fallback (never an empty cream box).
  for (let i = 0; i < Math.min(24, count); i++) {
    const card = cards.nth(i);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveAttribute("data-media", "illustration");
    const fallback = card.locator(
      '[data-testid^="pose-image-withheld-"], [data-testid^="pose-image-fallback-"]',
    );
    if ((await fallback.count()) > 0) {
      await expect(fallback.first()).toBeVisible();
      continue;
    }
    const img = card.locator("img[alt]").first();
    await expect(img).toBeVisible();
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0))
      .toBe(true);
  }
  await expect(page.locator('[data-testid^="pose-card-placeholder-"]')).toHaveCount(0);
});
