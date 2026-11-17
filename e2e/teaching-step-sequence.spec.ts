import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

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

test.describe("teaching step sequence for still poses", () => {
  test("guided player sequences Child's Pose steps without a fake video", async ({ page }) => {
    await page.goto("/guided");
    await page.getByTestId("button-hub-begin-tired").click();
    await expect(page.getByTestId("session-preflight")).toBeVisible();
    await page.getByTestId("button-begin-guided").click();

    const stage = page.getByTestId("guided-stage-crossfade");
    await expect(stage).toBeVisible({ timeout: 20000 });

    // First pose of "I'm tired" is Supported Child's Pose — still teaching path.
    const sequence = stage.locator("[data-teaching-sequence='steps']");
    await expect(sequence).toBeVisible({ timeout: 20000 });
    await expect(sequence).toHaveAttribute("data-step-count", /\d+/);
    await expect(page.getByTestId("teaching-step-counter")).toBeVisible();
    await expect(page.getByTestId("teaching-step-image")).toBeVisible();
    await expect(page.locator("[data-testid='ai-trainer-practice-video']")).toHaveCount(0);
    // Must not play a generated montage clip while teaching.
    await expect(stage.locator("video[src*='/videos/poses/']")).toHaveCount(0);
  });

  test("reduced motion finishes the sequence immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/guided");
    await page.getByTestId("button-hub-begin-tired").click();
    await page.getByTestId("button-begin-guided").click();

    const sequence = page.locator("[data-teaching-sequence='steps']");
    await expect(sequence).toBeVisible({ timeout: 20000 });
    await expect(sequence).toHaveAttribute("data-reduce-motion", "1");
    const count = Number(await sequence.getAttribute("data-step-count"));
    expect(count).toBeGreaterThan(0);
    await expect(sequence).toHaveAttribute("data-step", String(count - 1));
  });
});
