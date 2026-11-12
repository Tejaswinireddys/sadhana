import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";
import { AI_TRAINER_LESSONS } from "../client/src/data/aiTrainerLessons";

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

const LESSONS = Object.values(AI_TRAINER_LESSONS);

test.describe("AI trainer pose lessons", () => {
  for (const lesson of LESSONS) {
    test(`${lesson.english} deep link renders video + English captions`, async ({ page }) => {
      await page.goto(`/asanas/${lesson.slug}`);

      await expect(page.getByTestId("text-asana-english")).toContainText(lesson.english);
      await expect(page.getByTestId("ai-trainer-lesson")).toBeVisible();
      await expect(page.getByTestId("ai-trainer-lesson-label")).toHaveText("AI trainer preview");

      const section = page.getByTestId("ai-trainer-lesson");
      const video = section.getByTestId("video-player-element");
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute("controls", "");
      await expect(video).toHaveAttribute("playsinline", "");
      await expect(video).toHaveAttribute("poster", lesson.poster);
      expect(await video.evaluate((node: HTMLVideoElement) => node.autoplay)).toBe(false);

      // Progressive same-origin lesson file (Mux not required for this pilot).
      await expect
        .poll(async () => video.evaluate((node: HTMLVideoElement) => node.currentSrc || node.src))
        .toContain(lesson.mp4);

      const track = video.locator("track");
      await expect(track).toHaveAttribute("kind", "captions");
      await expect(track).toHaveAttribute("srclang", "en");
      await expect(track).toHaveAttribute("src", lesson.captionsVtt);
    });

    test(`${lesson.english} media files are served with Range support`, async ({ request }) => {
      const full = await request.get(lesson.mp4);
      expect(full.status()).toBe(200);
      expect(full.headers()["content-type"] ?? "").toMatch(/video\/mp4|octet-stream/i);

      const ranged = await request.get(lesson.mp4, {
        headers: { Range: "bytes=0-1023" },
      });
      expect([200, 206]).toContain(ranged.status());
      if (ranged.status() === 206) {
        expect(ranged.headers()["content-range"] ?? "").toMatch(/^bytes 0-1023\//);
      }

      const captions = await request.get(lesson.captionsVtt);
      expect(captions.status()).toBe(200);
      const body = await captions.text();
      expect(body).toMatch(/^WEBVTT/m);
    });
  }
});
