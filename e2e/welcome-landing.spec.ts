import { test, expect } from "@playwright/test";
import { ASANAS } from "../client/src/data/content";

/**
 * /welcome is the public page, judged separately from the daily app home.
 * It has to say what the experience is before asking for anything.
 */
test.describe("the landing page says what this is", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/welcome");
  });

  test("names the teaching format instead of implying video classes", async ({ page }) => {
    await expect(page.getByTestId("landing-format-0")).toContainText(/illustration/i);
    await expect(page.getByTestId("landing-format-1")).toContainText(/voice/i);
    await expect(page.getByTestId("landing-format-2")).toContainText(/hold/i);
    await expect(page.getByTestId("landing-format-3")).toContainText(/caption/i);
    await expect(page.getByTestId("landing-no-filmed-instruction")).toContainText(
      /no filmed instruction/i,
    );
  });

  test("keeps Get my plan and adds a route straight into a practice", async ({ page }) => {
    await expect(page.getByTestId("landing-cta-primary")).toContainText(/Get my plan/i);
    const sample = page.getByTestId("landing-cta-sample");
    await expect(sample).toBeVisible();
    await sample.click();
    // Lands in the real player's preparation screen, not a marketing page.
    await expect(page).toHaveURL(/\/guided/);
    await expect(page.getByTestId("session-preflight")).toBeVisible();
    await expect(page.getByTestId("button-begin-guided")).toBeVisible();
  });

  test("representative sessions carry real duration, level and equipment", async ({ page }) => {
    for (const id of ["tired", "before-bed", "low-energy"]) {
      const card = page.getByTestId(`landing-session-${id}`);
      await expect(card).toContainText(
        /\d+ min · (Beginner|Intermediate|Advanced) · (Gentle|Moderate|Strong) · \d+ poses/,
      );
      await expect(card).toContainText(/Needs |No props needed/);
      await expect(card).toContainText(/Voice-guided|Captions only|Timer only/);
    }
  });

  test("splits what is free from what is not built", async ({ page }) => {
    await expect(page.getByTestId("landing-free-list")).toContainText(
      new RegExp(`${ASANAS.length} illustrated poses`),
    );
    const notBuilt = page.getByTestId("landing-not-built-list");
    await expect(notBuilt).toContainText(/Filmed movement demonstrations/i);
    await expect(notBuilt).toContainText(/waitlist/i);
    await expect(notBuilt).toContainText(/offline/i);
  });

  test("answers the practical questions", async ({ page }) => {
    const faq = page.locator("#faq");
    for (const topic of [
      /equipment/i,
      /offline/i,
      /see and hear/i,
      /progress stored/i,
      /never done yoga/i,
    ]) {
      await expect(faq).toContainText(topic);
    }
  });

  test("claims no social proof it cannot show", async ({ page }) => {
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/\b\d[\d,.]*\s*(k|m|million|thousand)?\s*(users|members|students|downloads)\b/i);
    expect(body).not.toMatch(/\b(rated|stars?|reviews?|testimonial)\b/i);
    expect(body).not.toMatch(/\b(certified|RYT|E-RYT|doctor|physio(therapist)?|clinically proven)\b/i);
  });

  test("the walkthrough is playable and captioned", async ({ page }) => {
    await page.locator("#demo").scrollIntoViewIfNeeded();
    const video = page.locator("#demo video");
    await expect(video).toHaveCount(1);
    // Captions ship with it, and it never autoplays with sound. Sources attach
    // lazily once the section is in view, so wait for the track rather than
    // racing it.
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect(page.locator("#demo track")).toHaveCount(1, { timeout: 10000 });
    const captions = await page.request.get(
      (await page.locator("#demo track").getAttribute("src")) ?? "",
    );
    expect(captions.ok(), "caption file is missing").toBeTruthy();
  });

  test("no sideways scroll at phone or desktop width", async ({ page }) => {
    for (const [w, h] of [[390, 844], [320, 568], [1280, 900]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/welcome");
      await page.waitForTimeout(500);
      const res = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(res.scrollW, `overflow at ${w}px`).toBeLessThanOrEqual(res.clientW + 1);
    }
  });
});
