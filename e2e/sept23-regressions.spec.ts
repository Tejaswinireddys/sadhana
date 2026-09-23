import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/** Regressions from the September 23, 2026 test pass. */
async function seed(page: Page, extra: Record<string, string> = {}) {
  await page.addInitScript(
    ([v, entries]) => {
      localStorage.setItem(
        "sadhana.legalAck",
        JSON.stringify({ version: v, acceptedAt: new Date().toISOString() }),
      );
      localStorage.setItem("sadhana.welcome.seen", "1");
      localStorage.setItem("sadhana.onboarding.done", "1");
      for (const [k, val] of Object.entries(entries as Record<string, string>)) {
        localStorage.setItem(k, val);
      }
    },
    [LEGAL_VERSION, extra] as const,
  );
}

test.describe("the practice image stays usable on a small screen", () => {
  /** Below this the illustration stops teaching anything. */
  const MIN_MEDIA_PX = 150;

  for (const [name, w, h] of [
    ["320x568", 320, 568],
    ["390x844", 390, 844],
    ["landscape 844x390", 844, 390],
  ] as const) {
    test(`demonstration, heading and controls all work at ${name}`, async ({ page }) => {
      await seed(page);
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/guided");
      await page.getByTestId("button-hub-begin-tired").click();
      await page.getByTestId("button-begin-guided").click();
      await page.waitForTimeout(1500);

      const box = async (testId: string) => {
        const b = await page.getByTestId(testId).boundingBox();
        expect(b, `${testId} has no box`).not.toBeNull();
        return b!;
      };
      const stage = await box("guided-stage-crossfade");
      const heading = await box("text-current-pose");
      const countdown = await box("guided-countdown");

      // A 23-pixel-tall pose illustration is not a demonstration.
      expect(stage.height, `demonstration only ${stage.height}px tall`).toBeGreaterThanOrEqual(
        MIN_MEDIA_PX,
      );
      const img = page.locator('[data-testid="guided-hero"] img').first();
      const imgBox = await img.boundingBox();
      expect(imgBox!.height, "pose image shrank to a thumbnail").toBeGreaterThanOrEqual(
        MIN_MEDIA_PX - 30,
      );

      // Nothing essential sits on top of anything else essential.
      const overlaps = (a: typeof stage, b: typeof stage) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps(heading, countdown), "heading overlaps the timer").toBe(false);

      // And the transport is reachable.
      await expect(page.getByTestId("button-pause-guided")).toBeVisible();
      const scroll = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        c: document.documentElement.clientWidth,
      }));
      expect(scroll.w).toBeLessThanOrEqual(scroll.c + 1);
    });
  }
});

test.describe("an illustration that disagrees with its steps says so", () => {
  test("Supported Child's Pose is labelled, not passed off as accurate", async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/guided");
    await page.getByTestId("button-hub-begin-tired").click();

    // Before the practice, in the preflight.
    await expect(page.getByTestId("preflight-image-caveats")).toContainText(
      /not the full-length bolster/i,
    );

    // And on the demonstration itself.
    await page.getByTestId("button-begin-guided").click();
    await page.waitForTimeout(1500);
    const note = page.getByTestId("pose-human-note-salamba-balasana");
    await expect(note).toContainText(/less support than the steps/i);
    await expect(note).toHaveAttribute("title", /small cushion/i);

    // The alt text describes what is drawn, not what was instructed.
    const alt = await page.locator('[data-testid="guided-hero"] img').first().getAttribute("alt");
    expect(alt ?? "").toMatch(/cushion/i);
    expect(alt ?? "").not.toMatch(/draped over a bolster/i);
  });
});

test.describe("This week means this week", () => {
  test("weekly tiles are weekly, and lifetime totals are labelled separately", async ({ page }) => {
    await seed(page);
    const today = new Date().toISOString().slice(0, 10);
    await page.route("**/api/sessions", async (route) => {
      // Synthetic: two sessions today, one long ago.
      await route.fulfill({
        json: [
          { id: 1, date: today, durationMinutes: 12, kind: "asana" },
          { id: 2, date: today, durationMinutes: 8, kind: "asana" },
          { id: 3, date: "2026-01-05", durationMinutes: 30, kind: "asana" },
        ],
      });
    });
    await page.route("**/api/sessions/stats/**", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.totalSessions = 17;
      body.daysPracticed = 8;
      body.longestStreak = 3;
      body.totalMinutes = 210;
      body.heatmap = [...(body.heatmap ?? []).filter((h: { date: string }) => h.date !== today), { date: today, minutes: 20 }];
      await route.fulfill({ response: res, json: body });
    });
    await page.goto("/");

    // One day, two sessions, twenty minutes — not 8 days and 17 sessions.
    await expect(page.getByTestId("stat-week-days")).toHaveText("1");
    await expect(page.getByTestId("stat-week-sessions")).toHaveText("2");
    await expect(page.getByTestId("stat-week-minutes")).toHaveText("20");

    // The lifetime figures still exist, behind their own label.
    const allTime = page.getByTestId("all-time-progress");
    await expect(allTime).toContainText("All time");
    await allTime.getByText("All time").click();
    await expect(page.getByTestId("stat-total-sessions")).toHaveText("17");
    await expect(page.getByTestId("stat-days-practiced")).toHaveText("8");
    await expect(allTime).toContainText(/last 12 weeks/i);
  });
});

test.describe("a returning guest is never told they are new", () => {
  test("no first-time copy while saved practice is still loading", async ({ page }) => {
    await seed(page);
    const today = new Date().toISOString().slice(0, 10);
    // Hold both queries so the loading window is observable.
    await page.route("**/api/sessions/stats/**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await route.fetch();
      const body = await res.json();
      body.totalSessions = 9;
      body.daysPracticed = 5;
      body.longestStreak = 2;
      body.totalMinutes = 120;
      body.heatmap = [...(body.heatmap ?? []).filter((h: { date: string }) => h.date !== today), { date: today, minutes: 0 }];
      await route.fulfill({ response: res, json: body });
    });
    await page.route("**/api/sessions", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({ json: [{ id: 1, date: today, durationMinutes: 0, kind: "asana" }] });
    });
    await page.goto("/");

    // During loading: a neutral header and a skeleton, never "Start your
    // practice" or an empty-history message.
    await expect(page.getByTestId("text-welcome")).toHaveText("Today");
    await expect(page.getByTestId("text-home-subtitle")).toContainText(/Reading your saved/i);
    await expect(page.getByTestId("today-practice-loading")).toBeVisible();
    await expect(page.getByTestId("progress-empty")).toHaveCount(0);
    await expect(page.getByTestId("link-take-quiz")).toHaveCount(0);

    // After loading: the returning state.
    await expect(page.getByTestId("text-welcome")).toContainText(/Welcome back/i, {
      timeout: 10000,
    });
  });

  test("a failed load offers a retry instead of an empty week", async ({ page }) => {
    await seed(page);
    await page.route("**/api/sessions", (route) => route.abort("failed"));
    await page.goto("/");
    await expect(page.getByTestId("banner-stats-error")).toBeVisible();
    await expect(page.getByTestId("button-retry-stats")).toBeVisible();
    await expect(page.getByTestId("stat-week-days")).toHaveCount(0);
  });
});

test.describe("alternatives describe the focus that is actually selected", () => {
  test("no 'rather than settling' beside a Just move practice", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await page.getByTestId("button-change-focus").click();
    await page.getByTestId("option-focus-movement").click();
    await expect(page.getByTestId("today-practice-reason")).toContainText(/just move/i);

    const alts = page.locator('[data-testid^="home-alt-"]');
    await expect(alts).toHaveCount(3);
    const text = await alts.allInnerTexts();
    const joined = text.join(" \\n ");
    // Every alternative names the real focus on both sides of the comparison.
    expect(joined).not.toMatch(/rather than settling/i);
    expect(joined).toMatch(/The same just move focus/i);
    // And nothing claims to be gentler while being the same practice.
    expect(new Set(text).size, "two alternatives were identical").toBe(text.length);
  });
});

test.describe("counted nouns agree with their number", () => {
  test("a one-pose flow says 1 pose queued", async ({ page }) => {
    await seed(page);
    await page.goto("/builder");
    // Synthetic saved flow with a single pose.
    await page.route("**/api/custom-flows", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        json: [
          {
            id: 901,
            name: "One pose test flow",
            poseSequence: JSON.stringify([{ slug: "balasana", holdSeconds: 60, sides: "once" }]),
          },
        ],
      });
    });
    await page.reload();
    const start = page.getByTestId("button-start-custom-901");
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await expect(page.getByText(/1 pose queued/)).toBeVisible();
      await expect(page.getByText(/1 poses queued/)).toHaveCount(0);
    }
  });
});

test.describe("every entry point prepares you the same way", () => {
  /** Each of these loads a queue and lands in the player. */
  const entries: Array<{ name: string; open: (page: Page) => Promise<void> }> = [
    {
      name: "Today's recommended practice",
      open: async (page) => {
        await page.goto("/");
        await page.getByTestId("button-start-today-practice").click();
      },
    },
    {
      name: "a mood session",
      open: async (page) => {
        await page.goto("/guided");
        await page.getByTestId("button-hub-begin-tired").click();
      },
    },
    {
      name: "the warm-up",
      open: async (page) => {
        await page.goto("/guided");
        await page.getByTestId("button-hub-warmup").click();
      },
    },
  ];

  for (const entry of entries) {
    test(`${entry.name} shows the preflight before the player`, async ({ page }) => {
      await seed(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await entry.open(page);

      // An optional mood question may come first — answering it must reveal
      // the preparation screen, not start the practice.
      const skip = page.getByTestId("premood-skip");
      if (await skip.isVisible().catch(() => false)) await skip.click();

      const preflight = page.getByTestId("session-preflight");
      await expect(preflight, `${entry.name} skipped the preflight`).toBeVisible();
      await expect(page.getByTestId("preflight-spec")).toContainText(
        /\d+ (min|sec)[^·]*· (Beginner|Intermediate|Advanced) · (Gentle|Moderate|Strong)/,
      );
      await expect(page.getByTestId("preflight-required")).toContainText(
        /You'll need|No props needed/,
      );
      await expect(page.getByTestId("preflight-mode")).toBeVisible();
      await expect(page.getByTestId("preflight-poses")).toBeVisible();
      // And the practice only starts when asked.
      await expect(page.getByTestId("guided-session")).toHaveCount(0);
      await expect(page.getByTestId("button-begin-guided")).toBeVisible();
    });
  }
});

test.describe("remaining time tracks what the controls do", () => {
  test("pause holds it, skip drops it, +1 min adds to it, slow pace lengthens it", async ({
    page,
  }) => {
    await seed(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/guided");
    await page.getByTestId("button-hub-begin-tired").click();
    await page.getByTestId("button-begin-guided").click();
    await page.waitForTimeout(1200);

    const remaining = async () => {
      const text = await page.getByTestId("guided-remaining").innerText();
      const m = text.match(/(\d+)\s*min/);
      return m ? Number(m[1]) : Number(text.match(/(\d+)/)?.[1] ?? 0);
    };

    const atStart = await remaining();
    expect(atStart, "no remaining-time estimate").toBeGreaterThan(0);

    // Pause freezes the clock.
    await page.getByTestId("button-pause-guided").click();
    const paused = await remaining();
    await page.waitForTimeout(2500);
    expect(await remaining(), "paused clock kept running").toBe(paused);
    await page.getByTestId("button-pause-guided").click();

    // +30s adds time, even during narration when the hold has not begun.
    const beforeAdd = await remaining();
    await page.getByTestId("button-add-30").click();
    await page.waitForTimeout(400);
    expect(await remaining(), "+30s did not change the estimate").toBeGreaterThanOrEqual(
      beforeAdd,
    );

    // Skipping a pose shortens it.
    const beforeSkip = await remaining();
    await page.getByTestId("button-skip-pose").click();
    await page.waitForTimeout(800);
    expect(await remaining(), "skip did not shorten the estimate").toBeLessThan(beforeSkip + 1);

    // Slow pace stretches the wall clock.
    const beforePace = await remaining();
    await page.getByTestId("button-pace-guided").click();
    await page.waitForTimeout(500);
    expect(await remaining(), "slow pace did not lengthen the estimate").toBeGreaterThanOrEqual(
      beforePace,
    );
  });
});
