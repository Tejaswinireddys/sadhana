import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Class player v2: chapters, pose cue, speed, end screen, and Progress.
 * Mux hosts are blocked and media events are fired on <mux-player> with a
 * stubbed clock (Playwright's Chromium cannot decode H.264). Sessions and the
 * journal are the real API.
 */
const SLUG = "desk-back-relief";
const NEXT = "gentle-morning-wake-up";
const CHAPTERS = [
  { startSec: 0, title: "Arrive" },
  { startSec: 60, title: "Mountain", poseSlug: "tadasana" },
  { startSec: 120, title: "Downward dog", poseSlug: "adho-mukha-svanasana" },
];

async function seed(page: Page, withChapters = true) {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
  }, LEGAL_VERSION);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io)\//, (route) => route.abort());
  if (withChapters) {
    // The real detail, with chapters added (placeholders have none).
    await page.route(new RegExp(`/api/classes/${SLUG}$`), async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.class.chapters = CHAPTERS;
      await route.fulfill({ response: res, json: body });
    });
  }
}

/** Give <mux-player> a controllable clock, then fire media events against it. */
async function stubClock(page: Page, duration = 900) {
  await page.locator("mux-player").evaluate((el, duration) => {
    const state = { t: 0, rate: 1 };
    (window as unknown as { __clock: typeof state }).__clock = state;
    Object.defineProperty(el, "currentTime", { configurable: true, get: () => state.t, set: (v: number) => { state.t = v; } });
    Object.defineProperty(el, "duration", { configurable: true, get: () => duration });
    Object.defineProperty(el, "paused", { configurable: true, get: () => true });
    Object.defineProperty(el, "play", { configurable: true, value: () => { el.dispatchEvent(new Event("play")); return Promise.resolve(); } });
  }, duration);
}
const clock = (page: Page) => page.evaluate(() => (window as unknown as { __clock: { t: number } }).__clock.t);
async function fire(page: Page, type: string, at?: number) {
  await page.locator("mux-player").evaluate((el, [type, at]) => {
    const state = (window as unknown as { __clock: { t: number } }).__clock;
    if (typeof at === "number") state.t = at;
    el.dispatchEvent(new Event(type as string));
  }, [type, at] as const);
}
/** Play from `from` to `to` in 0.5s steps (each a timeupdate), as real playback would. */
async function playThrough(page: Page, from: number, to: number) {
  await page.locator("mux-player").evaluate((el, [from, to]) => {
    const state = (window as unknown as { __clock: { t: number } }).__clock;
    el.dispatchEvent(new Event("play"));
    for (let t = from; t <= to; t += 0.5) { state.t = t; el.dispatchEvent(new Event("timeupdate")); }
  }, [from, to] as const);
}

test("chapters list jumps, marks the current chapter, and the pose cue links to the pose", async ({ page }) => {
  await seed(page);
  await page.goto(`/classes/${SLUG}`);
  await expect(page.getByTestId("class-chapters")).toBeVisible();
  await stubClock(page);

  await page.getByTestId("class-chapter-2").click();
  expect(await clock(page)).toBe(120);
  await expect(page.getByTestId("class-chapter-2")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("class-chapter-0")).not.toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("class-chapter-2")).toHaveAccessibleName(/Downward dog, at 2:00.*playing now/);

  // Playing inside "Mountain": the cue names the pose and opens its page in a new tab.
  await playThrough(page, 61, 63);
  await expect(page.getByTestId("class-chapter-1")).toHaveAttribute("aria-current", "true");
  const cue = page.getByTestId("class-pose-cue");
  await expect(cue).toHaveText("Mountain Pose");
  await expect(cue).toHaveAttribute("href", "/asanas/tadasana");
  await expect(cue).toHaveAttribute("target", "_blank");
  await fire(page, "pause");
  await expect(cue).toHaveCount(0);

  // Keyboard: arrows skip 10s from the page.
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("ArrowRight");
  expect(await clock(page)).toBe(73);
  await page.keyboard.press("ArrowLeft");
  expect(await clock(page)).toBe(63);
});

test("speed is chosen with accessible buttons and remembered on this device", async ({ page }) => {
  await seed(page, false);
  await page.goto(`/classes/${SLUG}`);
  await expect(page.getByTestId("class-speed-1")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("class-speed-1.25").click();
  await expect(page.getByTestId("class-speed-1.25")).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("mux-player").evaluate((el) => (el as unknown as { playbackRate: number }).playbackRate)).toBe(1.25);
  await page.reload();
  await expect(page.getByTestId("class-speed-1.25")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("class-speed-1")).toHaveAttribute("aria-pressed", "false");
  await page.goto(`/classes/${NEXT}`);
  await expect(page.getByTestId("class-speed-1.25")).toHaveAttribute("aria-pressed", "true");
});

test("the end screen logs the class to Progress, takes an effort rating, and its countdown can be cancelled", async ({ page }) => {
  await seed(page);
  const posts: string[] = [];
  page.on("request", (req) => {
    if (["POST", "PATCH"].includes(req.method()) && /\/api\/(sessions|journal)(\/\d+)?$/.test(new URL(req.url()).pathname)) {
      posts.push(`${req.method()} ${new URL(req.url()).pathname}`);
    }
  });
  await page.goto(`/classes/${SLUG}`);
  await stubClock(page, 900);
  await playThrough(page, 0, 95);
  await fire(page, "ended", 900);

  const end = page.getByTestId("class-end");
  await expect(end.getByRole("heading", { name: "Class complete" })).toBeFocused();
  await expect(page.getByTestId("class-end-time")).toHaveText("2 min practised · added to Progress.");
  expect(posts).toEqual(expect.arrayContaining(["POST /api/sessions", "POST /api/journal"]));

  await expect(page.getByTestId("class-end-countdown")).toContainText(/Next class starts in \d+s/);
  await page.getByTestId("class-end-cancel").click();
  await expect(page.getByTestId("class-end-countdown-cancelled")).toBeVisible();
  await page.waitForTimeout(11_000);
  await expect(page).toHaveURL(new RegExp(`/classes/${SLUG}$`));

  await page.getByTestId("class-rpe-7").click();
  await expect(page.getByTestId("class-rpe-7")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("class-rpe-save").click();
  await expect(page.getByTestId("class-rpe-save")).toHaveText("Effort saved");
  await expect.poll(() => posts.some((p) => /^PATCH \/api\/sessions\/\d+$/.test(p))).toBe(true);

  // Progress (/journal) and Today both count it.
  await page.goto("/journal");
  await expect(page.getByText("Back relief for desk days · 2 min")).toBeVisible();
  const sessions = await (await page.request.get("/api/sessions")).json();
  expect(sessions.some((s: { label?: string; durationMinutes: number; rpe?: number }) =>
    s.durationMinutes === 2 && s.rpe === 7)).toBe(true);
});

test("without a cancel, the countdown moves on to the next class", async ({ page }) => {
  await seed(page);
  await page.goto(`/classes/${SLUG}`);
  await stubClock(page, 900);
  await playThrough(page, 0, 70);
  await fire(page, "ended", 900);
  await expect(page.getByTestId("class-end-countdown")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/classes/${NEXT}$`), { timeout: 15_000 });
});

test("skipping straight to the end shows the end screen but adds nothing to Progress", async ({ page }) => {
  await seed(page);
  const posts: string[] = [];
  page.on("request", (req) => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/sessions") posts.push("session"); });
  await page.goto(`/classes/${SLUG}`);
  await stubClock(page, 900);
  await fire(page, "play", 0);
  await fire(page, "ended", 900);
  await expect(page.getByTestId("class-end-time")).toContainText("isn't added to Progress");
  await page.getByTestId("class-end-cancel").click();
  expect(posts).toEqual([]);
});
