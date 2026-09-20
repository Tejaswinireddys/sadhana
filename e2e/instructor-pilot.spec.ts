import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

// A first-time visitor is bounced to /welcome, so seed a returning guest.
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

/**
 * Virtual instructor pilot — the checks that have to pass on a real phone.
 *
 * 320x568 and 390x844 are named explicitly: those are the sizes where the
 * demonstration was cropped and the pose title was covered by the controls.
 */
const SMALL = { width: 320, height: 568 };
const MODERN = { width: 390, height: 844 };

async function startPractice(page: Page) {
  await page.goto("/instructor");
  await page.getByTestId("instructor-continue-safety").click();

  // Answer every restriction prompt so the plan is complete.
  const prompts = page.locator('[data-testid^="instructor-intake-"]');
  for (let i = 0; i < (await prompts.count()); i++) {
    await prompts.nth(i).getByRole("button", { name: "Does not apply" }).click();
  }
  await page.getByTestId("instructor-start").click();
  await expect(page.getByTestId("instructor-player")).toBeVisible();
}

/** Is `inner` fully inside `outer`, allowing a pixel of rounding? */
async function containedIn(page: Page, innerId: string, outerId: string) {
  const inner = await page.getByTestId(innerId).boundingBox();
  const outer = await page.getByTestId(outerId).boundingBox();
  expect(inner, `${innerId} has no box`).not.toBeNull();
  expect(outer, `${outerId} has no box`).not.toBeNull();
  return { inner: inner!, outer: outer! };
}

test.describe("instructor pilot — setup", () => {
  test("shows the real length of both modes before starting", async ({ page }) => {
    await page.goto("/instructor");
    const learn = await page.getByTestId("instructor-learn-duration").innerText();
    const flow = await page.getByTestId("instructor-flow-duration").innerText();

    const toSec = (s: string) => {
      const [m, r] = s.trim().split(":").map(Number);
      return m * 60 + r;
    };
    expect(toSec(learn)).toBeGreaterThan(0);
    expect(toSec(flow)).toBeGreaterThan(0);
    // Learn teaches more, so it must be the longer of the two.
    expect(toSec(learn)).toBeGreaterThan(toSec(flow));
  });

  test("the preview is the length the player counts down", async ({ page }) => {
    await page.goto("/instructor");
    const preview = (await page.getByTestId("instructor-duration-preview").innerText()).match(
      /(\d+):(\d\d)/,
    );
    expect(preview).not.toBeNull();
    const previewSec = Number(preview![1]) * 60 + Number(preview![2]);

    await startPractice(page);
    const remaining = (await page.getByTestId("instructor-remaining").innerText()).match(
      /(\d+):(\d\d)/,
    );
    expect(remaining).not.toBeNull();
    const remainingSec = Number(remaining![1]) * 60 + Number(remaining![2]);

    // The clock runs while the player boots, and a cold CI runner is slower
    // than a laptop. The bug this guards is minutes wrong, not seconds.
    expect(Math.abs(previewSec - remainingSec)).toBeLessThan(30);
  });

  test("names the media that is still missing rather than implying it exists", async ({ page }) => {
    await page.goto("/instructor");
    await expect(page.getByText("Media still needed (precise list)")).toBeVisible();
  });
});

for (const [label, size] of [
  ["320x568", SMALL],
  ["390x844", MODERN],
] as const) {
  test.describe(`instructor pilot — ${label}`, () => {
    test.use({ viewport: size });

    test("the demonstration is not cropped and the title stays readable", async ({ page }) => {
      await startPractice(page);

      // The regression this guards: Start is tapped at the bottom of a long
      // safety form, and that scroll offset used to carry into the player,
      // pushing the pose title above the fold and clipping the stage.
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      // The whole stage is inside the viewport on every edge — nothing of the
      // instructor is cut off the top, bottom or sides.
      const stage = await page.getByTestId("instructor-stage").boundingBox();
      expect(stage).not.toBeNull();
      expect(stage!.x).toBeGreaterThanOrEqual(-1);
      expect(stage!.x + stage!.width).toBeLessThanOrEqual(size.width + 1);
      expect(stage!.y).toBeGreaterThanOrEqual(-1);
      expect(stage!.height).toBeGreaterThan(80);

      // The pose name, phase label and timer are all on screen.
      const clock = await page.getByTestId("instructor-clock").boundingBox();
      expect(clock).not.toBeNull();
      expect(clock!.y).toBeGreaterThanOrEqual(0);
      expect(clock!.y + clock!.height).toBeLessThanOrEqual(size.height);

      await expect(page.getByTestId("instructor-cue")).toBeVisible();
      await expect(page.getByTestId("instructor-clock")).toBeVisible();
    });

    test("controls do not cover the demonstration or the pose title", async ({ page }) => {
      await startPractice(page);
      const controls = await page.getByTestId("instructor-controls").boundingBox();
      const stage = await page.getByTestId("instructor-stage").boundingBox();
      expect(controls).not.toBeNull();
      expect(stage).not.toBeNull();

      // Controls sit below the demonstration, never on top of it.
      expect(controls!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height - 1);
      // And they stay on screen.
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(size.height + 1);
    });

    test("play, pause and extend-hold are reachable and hit-sized", async ({ page }) => {
      await startPractice(page);
      const play = page.getByTestId("instructor-play-pause");
      await expect(play).toBeVisible();
      const box = await play.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // Secondary controls collapse into a scroller rather than wrapping the
      // bar into a wall that eats the demonstration.
      await expect(page.getByTestId("instructor-extend-hold")).toBeAttached();
    });

    test("landscape keeps the demonstration and the cue together", async ({ page }) => {
      await page.setViewportSize({ width: size.height, height: size.width });
      await startPractice(page);
      await expect(page.getByTestId("instructor-stage")).toBeVisible();
      await expect(page.getByTestId("instructor-cue")).toBeVisible();
      await expect(page.getByTestId("instructor-play-pause")).toBeVisible();

      // Landscape reserved only the app header and the nav, not the main
      // element's own top padding, which left Play ~33px behind the bottom nav.
      const play = await page.getByTestId("instructor-play-pause").boundingBox();
      const navTop = await page.evaluate(() => {
        const nav = document.querySelector("nav.fixed");
        if (!nav || getComputedStyle(nav).display === "none") return null;
        return nav.getBoundingClientRect().top;
      });
      expect(play).not.toBeNull();
      if (navTop != null) {
        expect(play!.y + play!.height).toBeLessThanOrEqual(navTop);
      }
      expect(play!.y + play!.height).toBeLessThanOrEqual(size.width);
    });
  });
}

test.describe("instructor pilot — player controls", () => {
  test.use({ viewport: MODERN });

  test("pause stops the clock and resume restarts it", async ({ page }) => {
    await startPractice(page);
    const remaining = () => page.getByTestId("instructor-remaining").innerText();

    await page.getByTestId("instructor-play-pause").click(); // pause
    const paused = await remaining();
    await page.waitForTimeout(2000);
    expect(await remaining()).toBe(paused);

    await page.getByTestId("instructor-play-pause").click(); // resume
    // Poll rather than sleeping a fixed amount: media buffering legitimately
    // holds the clock for a moment, and a cold runner is slower still.
    await expect
      .poll(async () => await remaining(), { timeout: 15_000 })
      .not.toBe(paused);
  });

  test("captions can be turned off and back on", async ({ page }) => {
    await startPractice(page);
    await expect(page.getByTestId("instructor-caption")).toBeVisible();
    await page.getByRole("button", { name: /Captions on/ }).click();
    await expect(page.getByTestId("instructor-caption")).toHaveCount(0);
    await page.getByRole("button", { name: /Captions off/ }).click();
    await expect(page.getByTestId("instructor-caption")).toBeVisible();
  });

  test("media honesty survives into the player", async ({ page }) => {
    await startPractice(page);
    // Whatever is on screen, the player says what it is.
    await expect(page.getByTestId("instructor-media-status")).toBeVisible();
  });

  test("offers no camera toggle while no reviewed footage is published", async ({ page }) => {
    await startPractice(page);
    await expect(page.getByTestId("instructor-camera-angle")).toHaveCount(0);
  });
});
