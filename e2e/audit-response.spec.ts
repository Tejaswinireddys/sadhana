import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * End-to-end checks for the September 2026 product audit: the chair-only
 * program, one source of truth for session facts, Learn / Flow / Timer, the
 * player's controls, completion accounting, reflection editing, reload, and
 * the quiz carrying its plan into playback.
 *
 * All data here is synthetic guest data on a fresh browser context; the
 * in-memory store resets with the dev server.
 */
async function seed(page: Page) {
  await page.addInitScript((v) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version: v, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
}

async function skipPreMood(page: Page) {
  const skip = page.getByTestId("premood-skip");
  await skip.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test.describe("Chair & Limited Mobility never goes to the floor", () => {
  test("the program page lists only chair and standing poses", async ({ page }) => {
    await page.goto("/pathways/chair-limited-mobility");
    await expect(page.getByText(/never get down to the floor/i).first()).toBeVisible();
    const body = await page.locator("main").innerText();
    for (const floorPose of ["Legs on a Chair", "Corpse Pose", "Easy Pose", "Cat–Cow", "Bound Angle"]) {
      expect(body, `${floorPose} is on a floor-free program`).not.toContain(floorPose);
    }
    // No universal floor warm-up above it.
    await expect(page.getByText(/Always warm up first/)).toHaveCount(0);
  });
});

test.describe("catalog cards and the player agree", () => {
  test("Sleep Wind-Down names its props on the card", async ({ page }) => {
    await page.goto("/pathways");
    const card = page.getByTestId("card-flow-sleep-wind-down");
    await expect(card).toContainText(/Needs /);
    await expect(card).not.toContainText(/No props required|All levels/);
  });

  test("a flow card's length matches the preparation screen", async ({ page }) => {
    await page.goto("/pathways");
    const card = page.getByTestId("card-flow-sleep-wind-down");
    const duration = (await card.locator('[data-spec="duration"]').innerText()).split(",")[0]!;
    await page.getByTestId("button-start-flow-sleep-wind-down").click();
    await skipPreMood(page);
    await expect(page.getByTestId("preflight-spec")).toContainText(duration);
    await expect(page.getByTestId("preflight-equipment")).toBeVisible();
  });
});

test.describe("Learn, Flow and Timer only", () => {
  test("choosing Flow shortens the practice and the preflight says so", async ({ page }) => {
    await page.goto("/guided");
    await page.getByTestId("button-hub-begin-tired").click();
    await skipPreMood(page);
    const learn = page.getByTestId("toggle-guided");
    const flow = page.getByTestId("toggle-flow");
    await expect(learn).toHaveAttribute("aria-checked", "true");
    const learnSpec = await page.getByTestId("preflight-spec").innerText();
    await flow.click();
    await expect(flow).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("mode-description")).toContainText(/Short on-screen/);
    const flowSpec = await page.getByTestId("preflight-spec").innerText();
    const mins = (s: string) => Number(/(\d+) min/.exec(s)?.[1] ?? "0");
    expect(mins(flowSpec)).toBeLessThan(mins(learnSpec));
  });

  test("Timer only opens the timer screen", async ({ page }) => {
    await page.goto("/guided");
    await page.getByTestId("button-hub-begin-tired").click();
    await skipPreMood(page);
    await page.getByTestId("toggle-simple").click();
    await expect(page).toHaveURL(/\/practice/);
  });
});

test.describe("the player's controls", () => {
  test("pause, resume, replay, skip and exit confirmation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/guided");
    await page.getByTestId("button-hub-first-practice").click();
    await skipPreMood(page);
    await page.getByTestId("toggle-flow").click();
    await page.getByTestId("button-begin-guided").click();

    const pause = page.getByTestId("button-pause-guided");
    await expect(pause).toHaveAccessibleName("Pause session");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await expect(pause).toHaveAccessibleName("Resume session");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByTestId("button-repeat-cue")).toHaveAccessibleName(/Repeat current guidance/);
    await page.getByTestId("button-repeat-cue").click();

    const first = await page.getByTestId("text-current-pose").innerText();
    await page.getByTestId("button-skip-pose").click();
    await expect(page.getByTestId("text-current-pose")).not.toHaveText(first);

    await page.getByTestId("button-exit-guided").click();
    await expect(page.getByTestId("button-exit-cancel")).toBeVisible();
    await page.getByTestId("button-exit-cancel").click();
    await expect(page.getByTestId("text-current-pose")).toBeVisible();
  });

  test("a mid-session reload offers to resume, not to start over", async ({ page }) => {
    await page.goto("/guided");
    await page.getByTestId("button-hub-first-practice").click();
    await skipPreMood(page);
    await page.getByTestId("button-begin-guided").click();
    await expect(page.getByTestId("text-current-pose")).toBeVisible();
    await page.waitForTimeout(1500);
    await page.goto("/");
    await expect(page.getByTestId("banner-resume")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("banner-resume")).toBeVisible();
  });
});

test.describe("completion accounting", () => {
  test("natural completion saves one session and one journal entry; reflection edits it", async ({
    page,
  }) => {
    const posts: string[] = [];
    const patches: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (req.method() === "POST" && /^\/api\/(sessions|journal)$/.test(url.pathname)) posts.push(url.pathname);
      if (req.method() === "PATCH" && /^\/api\/journal\/\d+$/.test(url.pathname)) patches.push(url.pathname);
    });

    await page.clock.install();
    await page.goto("/guided");
    await page.getByTestId("button-hub-first-practice").click();
    await skipPreMood(page);
    // Flow: timer-driven, so the fake clock drives the whole practice.
    await page.getByTestId("toggle-flow").click();
    await page.getByTestId("button-begin-guided").click();
    for (let i = 0; i < 30; i++) {
      await page.clock.runFor(10_000);
      if (await page.getByTestId("guided-complete").isVisible().catch(() => false)) break;
    }
    await expect(page.getByTestId("guided-complete")).toBeVisible();
    await expect(page.getByTestId("guided-complete")).not.toContainText(/Skipping through doesn't count/);
    await expect.poll(() => posts.filter((p) => p === "/api/sessions").length).toBe(1);
    await expect.poll(() => posts.filter((p) => p === "/api/journal").length).toBe(1);

    // Reflection amends the entry that exists.
    await page.getByTestId("button-optional-mood").click();
    await page.getByTestId("postmood-mood-calm").click();
    // The effort rating follows; confirming it writes the amendment.
    await page.getByTestId("rpe-3").click();
    await page.getByTestId("rpe-confirm").click();
    await expect.poll(() => patches.length).toBeGreaterThanOrEqual(1);
    expect(posts.filter((p) => p === "/api/journal").length).toBe(1);

    // And it survives a reload.
    await page.goto("/journal");
    await page.reload();
    await expect(page.getByText(/Calm/).first()).toBeVisible();
  });
});

test.describe("the quiz carries its plan into playback", () => {
  test("answers → plan → the same poses in the player's preparation screen", async ({ page }) => {
    await page.goto("/start");
    for (const id of ["calm", "full", "new", "10", "unsure"]) {
      await page.getByTestId(`quiz-option-${id}`).click();
    }
    await expect(page.getByTestId("plan-reveal")).toBeVisible({ timeout: 15000 });
    const planPoses = await page.getByTestId("plan-pose-preview").count();
    await page.getByTestId("start-first-session").click();
    await expect(page).toHaveURL(/\/guided/);
    await skipPreMood(page);
    await expect(page.getByTestId("preflight-spec")).toContainText(new RegExp(`${planPoses >= 5 ? "\\d+" : planPoses} poses`));
  });
});

test.describe("Today adjusts without losing the plot", () => {
  test("energy adjustment explains itself", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("today-practice")).toBeVisible();
    await expect(page.getByTestId("today-practice-spec")).toContainText(/including guidance/);
    await expect(page.getByTestId("today-practice-format")).toContainText(/Learn|Flow|Timer only/);
    await page.getByTestId("button-change-energy").click();
    await page.getByTestId("option-energy-low").click();
    await expect(page.getByTestId("today-practice-reason")).toContainText(/energy is low/);
  });

  test("the storage line is compact and accurate", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-sync-status")).toHaveText(/Saved on this device only\./);
    const box = await page.getByTestId("home-account").boundingBox();
    expect(box?.height ?? 999).toBeLessThan(90);
  });

  test("mobile navigation has labelled controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    for (const name of ["Today", "Practice", "Poses", "Progress", "You"]) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }
  });
});
