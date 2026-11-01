import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
});

const video = {
  // Existing tiny clip is a test transport fixture, not published teaching media.
  hls: null, mp4: "/videos/poses/tadasana.mp4", playbackId: "testFixture", provider: "mux",
  poster: "/poses/tadasana.png", captions: "/captions/test-fixture.vtt",
};

test("pose preview has controls/captions and yields to the existing teaching stage", async ({ page }) => {
  await page.route("**/api/poses/tadasana/media", (route) => route.fulfill({ json: { video, audio: null } }));
  await page.route("**/captions/test-fixture.vtt", (route) => route.fulfill({ contentType: "text/vtt", body: "WEBVTT\n\n00:00.000 --> 00:02.000\nCaption fixture\n" }));
  await page.goto("/asanas/tadasana");
  const player = page.getByTestId("video-player-element");
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute("controls", "");
  await expect(player.locator("track")).toHaveAttribute("kind", "captions");
  await expect(player.locator("track")).toHaveAttribute("srclang", "en");
  expect(await player.evaluate((node: HTMLVideoElement) => node.autoplay)).toBe(false);
  await page.getByTestId("button-watch-demo-tadasana").click();
  await expect(page.getByTestId("lesson-live-cue")).toBeVisible();
  await expect(page.getByTestId("video-player-element")).toHaveCount(0);
  await expect(page.getByTestId("pose-lesson-static-reference")).toBeVisible();
});

test("ClassPlayer plays class media, otherwise retains the current image", async ({ page }) => {
  await page.route("**/api/classes/front-splits/media", (route) => route.fulfill({ json: { video } }));
  await page.goto("/pathways/front-splits");
  await expect(page.getByTestId("class-player")).toBeVisible();
  await expect(page.getByTestId("video-player-element")).toBeVisible();
  await page.route("**/api/classes/foundations-beginner/media", (route) => route.fulfill({ json: { video: null } }));
  await page.goto("/pathways/foundations-beginner");
  await expect(page.getByTestId("class-player")).toBeVisible();
  await expect(page.getByTestId("video-player-element")).toHaveCount(0);
  await expect(page.getByTestId("pathway-detail-hero-foundations-beginner")).toBeVisible();
});

test("HLS failure restores the pose image without a blocking spinner", async ({ page }) => {
  await page.route("**/api/poses/tadasana/media", (route) => route.fulfill({ json: {
    video: { ...video, hls: "https://stream.mux.com/failedFixture.m3u8", mp4: null }, audio: null,
  } }));
  await page.route("https://stream.mux.com/**", (route) => route.abort("failed"));
  const requested = page.waitForRequest("https://stream.mux.com/failedFixture.m3u8");
  await page.goto("/asanas/tadasana");
  await requested;
  await expect(page.getByTestId("demo-hero-tadasana")).toBeVisible();
  await expect(page.getByTestId("video-player-element")).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId("demo-hero-tadasana")).toBeVisible();
});

test("class media API preserves a nullable video payload and JSON 404", async ({ request }) => {
  const response = await request.get("/api/classes/front-splits/media");
  expect(response.status()).toBe(200);
  expect(await response.json()).toHaveProperty("video");
  const missing = await request.get("/api/classes/not-a-real-class/media");
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({ error: "Class not found" });
});
