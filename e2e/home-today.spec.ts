import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Today is one decision, not a directory. These cover the states it has to
 * handle deliberately: loading, a new guest, a returning guest with a saved
 * plan, and a day that has already been practised.
 */
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

const SAVED_PLAN = JSON.stringify({
  title: "Your Better Sleep Ritual",
  minutes: 12,
  timeLabel: "12 min",
  intent: "sleep",
  experience: "new",
  introPoseSlug: "vajrasana",
  poses: [
    { slug: "vajrasana", holdSeconds: 45 },
    { slug: "salamba-balasana", holdSeconds: 60 },
    { slug: "viparita-karani", holdSeconds: 120 },
    { slug: "savasana", holdSeconds: 90 },
  ],
});

test.describe("Today leads with one practice", () => {
  test("a new guest gets one card with a real spec and one Start", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const card = page.getByTestId("today-practice");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("today-practice-spec")).toContainText(
      /\d+ min · (Beginner|Intermediate|Advanced) · (Gentle|Moderate|Strong)/,
    );
    await expect(page.getByTestId("today-practice-equipment")).toContainText(
      /You'll need|No props needed/,
    );
    await expect(page.getByTestId("today-practice-reason")).not.toBeEmpty();
    // Exactly one primary Start on the page's lead card.
    await expect(page.getByTestId("button-start-today-practice")).toHaveCount(1);
    // And the way to make it personal, without a second competing CTA.
    await expect(page.getByTestId("link-take-quiz")).toBeVisible();
  });

  test("the Start button names the duration the player will run", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const spec = await page.getByTestId("today-practice-spec").innerText();
    const minutes = spec.match(/^(\d+) min/)?.[1];
    expect(minutes, `no duration in "${spec}"`).toBeTruthy();
    await expect(page.getByTestId("button-start-today-practice")).toContainText(
      `${minutes} min`,
    );
  });

  test("a saved plan is today's practice, not a second banner", async ({ page }) => {
    await seed(page, { "sadhana.quiz.plan": SAVED_PLAN });
    await page.goto("/");
    await expect(page.getByTestId("today-practice-title")).toHaveText(
      "Your Better Sleep Ritual",
    );
    await expect(page.getByTestId("today-practice-reason")).toContainText(/better sleep/i);
    await expect(page.getByTestId("link-take-quiz")).toHaveCount(0);
  });

  test("changing the time regenerates the card and its duration", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const before = await page.getByTestId("today-practice-spec").innerText();
    await page.getByTestId("button-change-time").click();
    await page.getByTestId("option-time-30").click();
    await expect
      .poll(async () => page.getByTestId("today-practice-spec").innerText())
      .not.toBe(before);
    const after = await page.getByTestId("today-practice-spec").innerText();
    const mins = Number(after.match(/^(\d+) min/)?.[1] ?? 0);
    expect(mins).toBeGreaterThan(Number(before.match(/^(\d+) min/)?.[1] ?? 0));
  });

  test("changing the focus says so in the reason", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await page.getByTestId("button-change-focus").click();
    await page.getByTestId("option-focus-sleep").click();
    await expect(page.getByTestId("today-practice-reason")).toContainText(/better sleep/i);
  });

  test("previewing poses lists them in order, without leaving Today", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await page.getByTestId("button-preview-poses").click();
    const items = page.getByTestId("panel-preview-poses").locator("li");
    expect(await items.count()).toBeGreaterThan(2);
    await expect(page).toHaveURL(/\/$/);
  });

  test("offers exactly three alternatives, each with its own real duration", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const alts = page.locator('[data-testid^="home-alt-"]');
    await expect(alts).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(alts.nth(i)).toContainText(
        /\d+ min · (Beginner|Intermediate|Advanced) · (Gentle|Moderate|Strong)/,
      );
    }
  });
});

test.describe("Today handles its states deliberately", () => {
  test("shows a skeleton rather than first-time content while data loads", async ({ page }) => {
    await seed(page);
    // Hold the stats response so the loading state is observable.
    await page.route("**/api/sessions/stats/**", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/");
    await expect(page.getByTestId("today-practice-loading")).toBeVisible();
    // The newcomer prompt must not flash before we know who this is.
    await expect(page.getByTestId("link-take-quiz")).toHaveCount(0);
    await expect(page.getByTestId("today-practice")).toBeVisible({ timeout: 10000 });
  });

  test("an empty progress section explains itself instead of showing zeros", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await expect(page.getByTestId("progress-empty")).toContainText(/Nothing here yet/);
  });

  test("the storage card talks about storage, not safety", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    const account = page.getByTestId("home-account");
    await expect(account).toContainText(/saved on this device only/i);
    await expect(account).not.toContainText(/Keep your practice safe/i);
  });

  test("comprehensive discovery lives on Practice, not at the bottom of Today", async ({
    page,
  }) => {
    await seed(page);
    await page.goto("/");
    await expect(page.getByTestId("home-explore-more")).toHaveCount(0);
    await page.goto("/guided");
    await expect(page.getByTestId("home-explore-more")).toBeVisible();
  });

  test("no sideways scroll at desktop or phone width", async ({ page }) => {
    await seed(page);
    for (const [w, h] of [[1280, 900], [1920, 1080], [390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await page.waitForTimeout(600);
      const res = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(res.scrollW, `overflow at ${w}px`).toBeLessThanOrEqual(res.clientW + 1);
    }
  });
});
