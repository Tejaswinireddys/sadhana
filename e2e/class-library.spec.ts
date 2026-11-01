import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Video class library against the in-memory placeholder seed (3 free, 3 Plus).
 *
 * Playwright's Chromium has no H.264/AAC, and CI must not depend on Mux's
 * CDN, so Mux hosts are blocked and "playing" is driven by firing the media
 * events the player listens to on <mux-player>, with currentTime/duration
 * stubbed on that element. That exercises the real wiring — resume start
 * time, saves on pause/timeupdate, completion at 90% — not the decoder.
 */

const TEST_PLAYBACK_ID = "EcHgOK9coz5K4rjSwOkoE7Y7O01201YMIC200RI6lNxnhs";
const FREE = ["gentle-morning-wake-up", "desk-back-relief", "unwind-before-sleep"];
const PLUS = ["steady-strength-flow", "deep-hamstring-release", "full-practice-stress-reset"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
  }, LEGAL_VERSION);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io)\//, (route) => route.abort());
});

/** Fire a media event on <mux-player> as if the video were at `seconds` of `duration`. */
async function playerEvent(page: Page, type: "timeupdate" | "pause" | "ended", seconds: number, duration: number) {
  await page.locator("mux-player").evaluate((el, [type, seconds, duration]) => {
    Object.defineProperty(el, "currentTime", { configurable: true, get: () => seconds, set: () => undefined });
    Object.defineProperty(el, "duration", { configurable: true, get: () => duration });
    el.dispatchEvent(new Event(type as string));
  }, [type, seconds, duration] as const);
}

function progressPost(page: Page, slug: string) {
  return page.waitForRequest((req) => req.method() === "POST" && req.url().endsWith(`/api/classes/${slug}/progress`));
}

test("Classes is in the main nav and the library shows free and Plus rows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByTestId("nav-classes").click();
  await expect(page).toHaveURL(/\/classes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Video classes" })).toBeVisible();
  for (const slug of FREE) {
    await expect(page.getByTestId("class-library-free").getByTestId(`class-card-${slug}`)).toHaveAttribute("data-locked", "false");
  }
  for (const slug of PLUS) {
    const card = page.getByTestId("class-library-plus").getByTestId(`class-card-${slug}`);
    await expect(card).toHaveAttribute("data-locked", "true");
    await expect(card).toHaveAttribute("href", "/plus");
    await expect(page.getByTestId(`class-card-lock-${slug}`)).toBeVisible();
  }
  await expect(page.getByTestId("class-card-gentle-morning-wake-up")).toContainText("10 min");
  await expect(page.getByTestId("class-card-gentle-morning-wake-up")).toContainText("Beginner");
  await expect(page.getByTestId("class-library-continue")).toHaveCount(0);
});

test("filter chips narrow the library and are keyboard operable", async ({ page }) => {
  await page.goto("/classes");
  const count = page.getByTestId("class-library-count");
  await expect(count).toHaveText("6 classes");

  await page.getByTestId("class-library-level-beginner").click();
  await expect(count).toContainText("3 classes match these filters");
  await expect(page.getByTestId("class-library-plus-empty")).toHaveText("No Plus classes match these filters.");

  await page.getByTestId("class-library-focus-back-pain").click();
  await expect(count).toContainText("1 class matches these filters");
  await expect(page.getByTestId("class-card-desk-back-relief")).toBeVisible();

  await page.getByTestId("class-library-clear").click();
  await expect(count).toHaveText("6 classes");

  // Keyboard: focus a chip and toggle it with Space, then Enter.
  const longChip = page.getByTestId("class-library-duration-30-plus");
  await longChip.focus();
  await page.keyboard.press("Space");
  await expect(longChip).toHaveAttribute("aria-pressed", "true");
  await expect(count).toContainText("1 class matches these filters");
  await expect(page.getByTestId("class-card-full-practice-stress-reset")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(longChip).toHaveAttribute("aria-pressed", "false");
  await expect(count).toHaveText("6 classes");
});

test("playing saves progress, resumes from it, surfaces Continue, and completes at 90%", async ({ page }) => {
  const slug = "desk-back-relief";
  await page.goto("/classes");
  // Keyboard path into a class.
  await page.getByTestId(`class-card-${slug}`).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/classes/${slug}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Back relief for desk days" })).toBeVisible();
  await expect(page.getByTestId("class-player-resume")).toHaveText("Starting from the beginning.");
  await expect(page.getByTestId("class-player-description")).toContainText("lower back");
  await expect(page.getByTestId("class-player-focus")).toContainText("back pain");
  await expect(page.getByTestId("class-player-next")).toBeVisible();
  const player = page.locator("mux-player");
  await expect(player).toHaveCount(1);
  expect(await player.evaluate((el) => (el as unknown as { playbackId: string }).playbackId)).toBe(TEST_PLAYBACK_ID);

  // Watch to 1:35 and pause → one save with that position.
  const saved = progressPost(page, slug);
  await playerEvent(page, "pause", 95.4, 900);
  expect((await saved).postDataJSON()).toEqual({ secondsWatched: 95, durationSeconds: 900 });

  // Library and Today both offer to continue it.
  await page.getByTestId("class-player-back").click();
  await expect(page.getByTestId("class-library-continue").getByTestId(`class-card-${slug}`)).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("home-continue-class")).toContainText("Continue your class");
  await expect(page.getByTestId("home-continue-class")).toContainText("from 1:35");
  await page.getByTestId("home-continue-class").click();

  // Resume where we left off.
  await expect(page).toHaveURL(new RegExp(`/classes/${slug}$`));
  await expect(page.getByTestId("class-player-resume")).toContainText("Resuming from 1:35.");
  expect(await page.locator("mux-player").evaluate((el) => (el as unknown as { startTime: number }).startTime)).toBe(95);

  // Crossing 90% saves immediately as complete.
  const done = progressPost(page, slug);
  await playerEvent(page, "timeupdate", 811, 900);
  expect((await done).postDataJSON()).toEqual({ secondsWatched: 811, durationSeconds: 900, completed: true });
  await expect(page.getByTestId("class-player-complete")).toHaveText("Class complete");

  await page.getByTestId("class-player-back").click();
  // Wait for the refetched library first: asserting "no Continue row" before
  // it loads passed vacuously and then met the cached, pre-completion row.
  await expect(page.getByTestId("class-library-free").getByTestId(`class-card-${slug}`)).toContainText("Completed");
  await expect(page.getByTestId("class-library-continue")).toHaveCount(0);
});

test("a free viewer's Plus class leads to /plus and never gets playback", async ({ page }) => {
  const slug = PLUS[0];
  const api = await page.request.get(`/api/classes/${slug}`);
  expect(api.status()).toBe(200);
  const text = await api.text();
  expect(JSON.parse(text).class).toMatchObject({ locked: true, playback: null });
  expect(text).not.toContain(TEST_PLAYBACK_ID);

  await page.goto("/classes");
  await page.getByTestId(`class-card-${slug}`).click();
  await expect(page).toHaveURL(/\/plus$/);
  await expect(page.getByTestId("paywall-root")).toBeVisible();

  await page.goto(`/classes/${slug}`);
  await expect(page.getByTestId("class-player-locked")).toContainText("This is a Sadhana Plus class");
  await expect(page.locator("mux-player")).toHaveCount(0);
  await page.getByTestId("class-player-unlock").click();
  await expect(page).toHaveURL(/\/plus$/);
});

test("an unknown class says so instead of a blank player", async ({ page }) => {
  await page.goto("/classes/not-a-real-class");
  await expect(page.getByTestId("class-player-not-found")).toContainText("Class not found");
});

/** A Plus member's view of a signed class, as GET /api/classes/:slug returns it. */
function signedDetail(slug: string, round: number, expiresAt: number) {
  return {
    class: {
      id: 4, slug, title: "Steady strength flow", description: "Standing poses.", instructorName: "Sadhana team",
      level: "intermediate", durationMinutes: 25, focusTags: ["strength"], thumbnailUrl: null, tier: "plus", locked: false,
      progress: null,
      playback: {
        provider: "mux", policy: "signed", playbackId: "signedPlusPlaybackId",
        tokens: { playback: `tok-v-${round}`, thumbnail: `tok-t-${round}`, storyboard: `tok-s-${round}` }, expiresAt,
      },
    },
    next: null,
    viewerPlan: "plus",
  };
}

test("a signed Plus class gets its tokens, refreshes them before expiry, and keeps the viewer's place", async ({ page }) => {
  const slug = PLUS[0];
  let round = 0;
  // First tokens expire 5m + 3s from now: the refresh (5 min early) is due in ~3s.
  await page.route(new RegExp(`/api/classes/${slug}$`), async (route) => {
    round += 1;
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({ json: signedDetail(slug, round, round === 1 ? now + 303 : now + 3600) });
  });
  const posts: unknown[] = [];
  await page.route(new RegExp(`/api/classes/${slug}/progress$`), async (route) => {
    posts.push(route.request().postDataJSON());
    await route.fulfill({ json: { progress: { secondsWatched: 0, completed: false, updatedAt: new Date().toISOString() } } });
  });

  await page.goto(`/classes/${slug}`);
  const player = page.locator("mux-player");
  await expect(player).toHaveAttribute("playback-id", "signedPlusPlaybackId");
  await expect(player).toHaveAttribute("playback-token", "tok-v-1");
  await expect(player).toHaveAttribute("thumbnail-token", "tok-t-1");
  await expect(player).toHaveAttribute("storyboard-token", "tok-s-1");
  await expect(page.getByTestId("class-player-resume")).toHaveAttribute("data-policy", "signed");

  // Watching at 2:00 when the refresh lands.
  await playerEvent(page, "pause", 120, 1500);
  await expect.poll(() => posts.length).toBe(1);
  await expect(player).toHaveAttribute("playback-token", "tok-v-2", { timeout: 15_000 });
  await expect(player).toHaveAttribute("thumbnail-token", "tok-t-2");
  expect(round).toBe(2);
  // The swap reloads the stream; it must start where the viewer was…
  await expect(player).toHaveAttribute("start-time", "120");
  // …and the reload's own "pause at 0:00" must not rewind saved progress.
  await playerEvent(page, "pause", 0, 1500);
  await page.waitForTimeout(500);
  expect(posts).toEqual([{ secondsWatched: 120, durationSeconds: 1500 }]);
});

test("a Plus member on a class with no playable video sees 'not available', not the paywall", async ({ page }) => {
  const slug = PLUS[1];
  await page.route(new RegExp(`/api/classes/${slug}$`), (route) => {
    const body = signedDetail(slug, 1, 0);
    route.fulfill({ json: { ...body, class: { ...body.class, slug, playback: null } } });
  });
  await page.goto(`/classes/${slug}`);
  await expect(page.getByTestId("class-player-unavailable")).toContainText("isn't available yet");
  await expect(page.getByTestId("class-player-locked")).toHaveCount(0);
  await expect(page.locator("mux-player")).toHaveCount(0);
});

test("the real API sends guests no playback, id or token for any Plus class", async ({ page }) => {
  for (const slug of PLUS) {
    const res = await page.request.get(`/api/classes/${slug}`);
    const text = await res.text();
    expect(JSON.parse(text).class).toMatchObject({ locked: true, playback: null });
    expect(text).not.toMatch(/token|eyJ/);
  }
  const free = await (await page.request.get(`/api/classes/${FREE[0]}`)).json();
  expect(free.class.playback).toEqual({ provider: "mux", policy: "public", playbackId: TEST_PLAYBACK_ID });
});
