import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * The practice journey, end to end: preflight → player layout → controls →
 * completion. Each assertion here is a defect from the September 2026 audit.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript((v) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version: v, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
});

/**
 * Mood sessions live on the Practice hub, not on Today — Today leads with one
 * recommended practice and the catalogue moved to /guided.
 */
async function openTiredPreflight(page: Page) {
  await page.goto("/guided");
  await page.getByTestId("button-hub-begin-tired").click();
  await expect(page.getByTestId("session-preflight")).toBeVisible();
}

test.describe("preflight discloses what the practice needs", () => {
  test("'I'm tired' names its chair and bolster before Begin", async ({ page }) => {
    await openTiredPreflight(page);
    const equipment = page.getByTestId("preflight-equipment");
    await expect(equipment).toContainText(/chair/i);
    await expect(equipment).toContainText(/bolster|pillow/i);
    // The disclosure and the start action are on the same screen.
    await expect(page.getByTestId("button-begin-guided")).toBeVisible();
  });

  test("shows length, level and intensity as one spec line", async ({ page }) => {
    await openTiredPreflight(page);
    await expect(page.getByTestId("preflight-spec")).toContainText(
      /\d+ min · (Beginner|Intermediate|Advanced) · (Gentle|Moderate|Strong)/,
    );
  });

  test("names the instruction mode and previews the poses", async ({ page }) => {
    await openTiredPreflight(page);
    await expect(page.getByTestId("preflight-mode")).toContainText(
      /Voice-guided|Captions only|Timer only/,
    );
    await page.getByTestId("preflight-poses").getByText(/Preview the \d+ poses/).click();
    await expect(
      page.getByTestId("preflight-poses").getByText("Supported Child's Pose"),
    ).toBeVisible();
  });

  test("offers a prop-free alternative where one is reviewed", async ({ page }) => {
    await openTiredPreflight(page);
    const swap = page.getByTestId("preflight-swap-salamba-balasana");
    await expect(swap).toBeVisible();
    await swap.click();
    // The queue really changed: the supported version is gone from the preview.
    await page.getByTestId("preflight-poses").getByText(/Preview the \d+ poses/).click();
    await expect(
      page.getByTestId("preflight-poses").getByText("Child's Pose", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("preflight-required")).not.toContainText(/bolster/i);
    await expect(page.getByTestId("preflight-required")).toContainText(/chair/i);
  });
});

test.describe("the player fits a phone", () => {
  for (const [name, width, height] of [
    ["iPhone 12 portrait", 390, 844],
    ["small phone", 320, 568],
    ["phone landscape", 844, 390],
  ] as const) {
    test(`pose name, timer and controls stay visible at ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openTiredPreflight(page);
      await page.getByTestId("button-begin-guided").click();
      await page.waitForTimeout(1500);

      const box = async (testId: string) => {
        const b = await page.getByTestId(testId).boundingBox();
        expect(b, `${testId} has no box`).not.toBeNull();
        return b!;
      };
      const name_ = await box("text-current-pose");
      const countdown = await box("guided-countdown");
      const transport = await box("guided-transport");

      // Nothing essential may sit on top of anything else essential.
      expect(name_.y + name_.height, "pose name runs under the timer").toBeLessThanOrEqual(
        countdown.y + 1,
      );
      // Everything essential is inside the viewport.
      for (const [label, b] of [
        ["pose name", name_],
        ["countdown", countdown],
        ["transport", transport],
      ] as const) {
        expect(b.y, `${label} above the viewport`).toBeGreaterThanOrEqual(-1);
        expect(b.y + b.height, `${label} below the viewport`).toBeLessThanOrEqual(height + 1);
      }
      // No sideways scroll on any of them.
      const scroll = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        c: document.documentElement.clientWidth,
      }));
      expect(scroll.w).toBeLessThanOrEqual(scroll.c + 1);
    });
  }

  test("teaching shows this pose, labelled as a static reference", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTiredPreflight(page);
    await page.getByTestId("button-begin-guided").click();
    await page.waitForTimeout(7000);
    await expect(page.getByTestId("text-current-pose")).toContainText("Supported Child's Pose");
    // No generated clip may stand in for a demonstration.
    await expect(page.locator('[data-testid="guided-hero"] video')).toHaveCount(0);
    await expect(page.getByTestId("pose-human-note-salamba-balasana")).toContainText(
      /static reference/i,
    );
  });
});

test.describe("skipping through earns nothing", () => {
  test("a skipped-through session is not credited and shows no zero breaths", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTiredPreflight(page);
    await page.getByTestId("button-begin-guided").click();
    await page.waitForTimeout(1200);
    for (let i = 0; i < 6; i++) {
      const next = page.getByTestId("button-skip-pose");
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByTestId("guided-complete")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("guided-complete")).toContainText(
      /Skipping through doesn't count/,
    );
    // "0 BREATHS" was a measurement of nothing, shown as a result.
    await expect(page.getByTestId("text-complete-breaths")).toHaveCount(0);
  });
});
