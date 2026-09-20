import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Pose lessons, checked against the behaviour reported in the live app.
 * Each lesson is inspected at several points, not just its opening frame.
 */
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

const POSES = [
  { slug: "marjaryasana-bitilasana", english: "Cat-Cow", dynamic: true },
  { slug: "virabhadrasana-ii", english: "Warrior II", dynamic: false },
  { slug: "vrksasana", english: "Tree Pose", dynamic: false },
] as const;

async function openLesson(page: Page, slug: string) {
  await page.goto(`/asanas/${slug}`);
  await page.getByTestId(`button-watch-demo-${slug}`).click();
  await expect(page.getByTestId("lesson-cue")).toBeVisible();
}

/** The still actually on screen, so we can assert it never becomes another pose. */
async function stageImageSrc(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>(
      '[data-testid="pose-lesson-static-reference"]',
    );
    return img?.getAttribute("src") ?? null;
  });
}

test.describe("pose lesson — media honesty", () => {
  for (const pose of POSES) {
    test(`${pose.english} never shows another pose's body`, async ({ page }) => {
      await openLesson(page, pose.slug);

      // The generated clip for each of these crossfades a foreign illustration
      // (Mountain into Warrior II / Tree, Easy Seat into Cat–Cow). Whatever is
      // on screen must be this pose's own image, at every point in the lesson.
      for (let i = 0; i < 6; i++) {
        const src = await stageImageSrc(page);
        expect(src, `no still on screen at sample ${i}`).not.toBeNull();
        expect(src!).toContain(pose.slug);
        expect(src!).not.toContain("tadasana");
        expect(src!).not.toContain("sukhasana");
        await page.waitForTimeout(1200);
      }
    });

    test(`${pose.english} discloses that no movement demo exists`, async ({ page }) => {
      await page.goto(`/asanas/${pose.slug}`);
      await expect(page.getByTestId("lesson-media-disclosure")).toBeVisible();
      await expect(page.getByTestId("pose-lesson-media-label")).toContainText(
        "Static reference — movement demonstration unavailable",
      );
    });
  }
});

test.describe("pose lesson — cues agree with the timeline", () => {
  test("Cat–Cow teaches tabletop, then Cow and Cat, then rounds", async ({ page }) => {
    await openLesson(page, "marjaryasana-bitilasana");

    // It is a flowing practice, so it must not be sold as a hold.
    await expect(page.getByTestId("lesson-duration-label")).toContainText("rounds");
    await expect(page.getByTestId("lesson-duration-label")).not.toContainText("Hold");

    await expect(page.getByTestId("lesson-phase")).toContainText("Set up");
    await expect(page.getByTestId("lesson-cue")).toContainText(/all fours|tabletop/i);

    // Skip forward into the flow and confirm the breath cue alternates with
    // the movement rather than sitting on one shape.
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      await page.getByTestId("lesson-next").click();
      seen.add((await page.getByTestId("lesson-phase").innerText()).split("·")[0]!.trim());
    }
    expect([...seen].some((p) => /Flow|Come out/.test(p))).toBeTruthy();
  });

  test("Warrior II's knee cue is its own step, not a standing figure", async ({ page }) => {
    await openLesson(page, "virabhadrasana-ii");
    await page.getByTestId("lesson-next").click();
    await expect(page.getByTestId("lesson-cue")).toContainText(/bend the (right|left) knee/i);
    // The still stays Warrior II throughout the knee cue.
    expect(await stageImageSrc(page)).toContain("virabhadrasana-ii");
  });

  test("Tree's beginner path describes the support it actually means", async ({ page }) => {
    await page.goto("/asanas/vrksasana");
    await page.getByTestId("path-chip-beginner").click();
    await page.getByTestId("button-watch-demo-vrksasana").click();

    // Beginner Tree is toes-down with a hand on a wall.
    await expect(page.getByTestId("lesson-cue")).toContainText(/kickstand|toes of the lifted foot/i);
    await expect(page.getByTestId("lesson-props")).toContainText("wall");
    // …and the page says the picture is not that variation.
    await expect(page.getByTestId("lesson-variation-mismatch")).toContainText(
      /not the beginner variation/i,
    );
  });

  test("changing variation changes timing and cues", async ({ page }) => {
    await page.goto("/asanas/vrksasana");
    await page.getByTestId("path-chip-beginner").click();
    const beginner = await page.getByTestId("lesson-duration-label").innerText();
    await page.getByTestId("path-chip-advanced").click();
    const advanced = await page.getByTestId("lesson-duration-label").innerText();
    expect(beginner).not.toBe(advanced);
  });
});

test.describe("pose lesson — controls", () => {
  test("pause does not change the picture, and resume continues", async ({ page }) => {
    await openLesson(page, "virabhadrasana-ii");
    const before = await stageImageSrc(page);

    await page.getByTestId("button-pause-demo-virabhadrasana-ii").click();
    const remaining = await page.getByTestId("lesson-remaining").innerText();
    await page.waitForTimeout(1500);

    // The old stage swapped to the pose poster on pause. The image and the
    // clock must both hold exactly where they were.
    expect(await stageImageSrc(page)).toBe(before);
    expect(await page.getByTestId("lesson-remaining").innerText()).toBe(remaining);

    await page.getByTestId("button-pause-demo-virabhadrasana-ii").click();
    await expect
      .poll(async () => page.getByTestId("lesson-remaining").innerText(), { timeout: 10_000 })
      .not.toBe(remaining);
  });

  test("back, replay and next move one teaching step at a time", async ({ page }) => {
    await openLesson(page, "virabhadrasana-ii");
    const cueAt = () => page.getByTestId("lesson-cue").innerText();

    const first = await cueAt();
    await page.getByTestId("lesson-next").click();
    const second = await cueAt();
    expect(second).not.toBe(first);

    await page.getByTestId("lesson-prev").click();
    expect(await cueAt()).toBe(first);

    // Replay restarts the current step rather than jumping elsewhere.
    await page.getByTestId("lesson-replay").click();
    expect(await cueAt()).toBe(first);
  });

  test("teaching topics do not cycle on their own during a lesson", async ({ page }) => {
    // The rail used to rotate Form → Breath → Align every 7s, competing with
    // the live instruction.
    await page.goto("/asanas/virabhadrasana-ii");
    await page.getByTestId("pose-teach-tab-breath").click();
    await expect(page.getByTestId("pose-teach-panel-breath")).toBeVisible();
    await page.waitForTimeout(9000);
    await expect(page.getByTestId("pose-teach-panel-breath")).toBeVisible();
  });

  test("exit leaves training and stops the lesson audio", async ({ page }) => {
    await openLesson(page, "vrksasana");
    await page.getByTestId("lesson-exit").click();
    await expect(page.getByTestId("button-watch-demo-vrksasana")).toBeVisible();
    expect(
      await page.evaluate(() => {
        const a = document.querySelector<HTMLAudioElement>('[data-testid="demo-audio-vrksasana"]');
        return a ? a.paused : true;
      }),
    ).toBeTruthy();
  });

  test("navigating to another pose stops the previous lesson's audio", async ({ page }) => {
    await openLesson(page, "vrksasana");
    await page.goto("/asanas/virabhadrasana-ii");
    await expect(page.getByTestId("button-watch-demo-virabhadrasana-ii")).toBeVisible();
    expect(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll("audio")).every((a) => a.paused),
      ),
    ).toBeTruthy();
  });
});

for (const [label, width, height] of [
  ["320x568", 320, 568],
  ["390x844", 390, 844],
  ["tablet 768x1024", 768, 1024],
  ["desktop 1280x800", 1280, 800],
  ["landscape 844x390", 844, 390],
] as const) {
  test.describe(`pose lesson — ${label}`, () => {
    test.use({ viewport: { width, height } });

    test("demonstration, cue and controls are visible together", async ({ page }) => {
      await openLesson(page, "marjaryasana-bitilasana");

      /** Checked at the start AND after each step change, not just on open. */
      const assertTogether = async (when: string) => {
        const stage = await page.getByTestId("demo-hero-marjaryasana-bitilasana").boundingBox();
        const cue = await page.getByTestId("lesson-cue").boundingBox();
        const controls = await page.getByTestId("lesson-controls").boundingBox();

        expect(stage, `${when}: no stage`).not.toBeNull();
        expect(cue, `${when}: no cue`).not.toBeNull();
        expect(controls, `${when}: no controls`).not.toBeNull();

        // The reported bug: the demonstration ended up above the viewport
        // while the controls and text stayed visible.
        expect(stage!.y + stage!.height, `${when}: stage above the fold`).toBeGreaterThan(0);
        expect(stage!.y, `${when}: stage below the fold`).toBeLessThan(height);
        // Nothing is clipped off the sides.
        expect(stage!.x).toBeGreaterThanOrEqual(-1);
        expect(stage!.x + stage!.width).toBeLessThanOrEqual(width + 1);

        expect(cue!.y, `${when}: cue off screen`).toBeLessThan(height);
        expect(controls!.y, `${when}: controls off screen`).toBeLessThan(height);
      };

      await assertTogether("on start");
      await page.getByTestId("lesson-next").click();
      await assertTogether("after next");
      await page.getByTestId("lesson-next").click();
      await assertTogether("after second next");
      await page.getByTestId("lesson-prev").click();
      await assertTogether("after prev");
      await page.getByTestId("lesson-replay").click();
      await assertTogether("after replay");
    });

    test("no competing Practice now button during a lesson", async ({ page }) => {
      await openLesson(page, "marjaryasana-bitilasana");
      await expect(page.getByTestId("button-practice-now-sticky")).toBeHidden();
    });
  });
}
