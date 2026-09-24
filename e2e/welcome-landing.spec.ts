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

  test("leads with the headline and two actions", async ({ page }) => {
    await expect(page.getByTestId("landing-headline")).toHaveText(
      "A daily yoga practice that fits your day.",
    );
    await expect(page.getByTestId("landing-cta-primary")).toHaveText(/Try a 6-minute practice/);
    await expect(page.getByTestId("landing-cta-secondary")).toHaveText(/Find my practice/);
    await expect(page.getByTestId("landing-cta-secondary")).toHaveAttribute("href", "/start");
    // The spec under the CTA matches the practice the button starts.
    await expect(page.getByTestId("landing-sample-spec")).toContainText(/6 min, including guidance/);
  });

  test("the primary action opens the real player on the 6-minute practice", async ({ page }) => {
    await page.getByTestId("landing-cta-primary").click();
    await expect(page).toHaveURL(/\/guided/);
    const skip = page.getByTestId("premood-skip");
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await expect(page.getByTestId("session-preflight")).toBeVisible();
    await expect(page.getByTestId("preflight-spec")).toContainText(/6 min/);
    await expect(page.getByTestId("button-begin-guided")).toBeVisible();
  });

  test("shows a preview of the player near the top", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/welcome");
    const preview = page.getByTestId("landing-player-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Mountain Pose");
    const box = await preview.boundingBox();
    // Within the first two phone screens.
    expect(box?.y ?? 9999).toBeLessThan(844 * 2);
  });

  test("names the teaching format in one place", async ({ page }) => {
    await expect(page.getByTestId("landing-format-0")).toContainText(/illustrat/i);
    await expect(page.getByTestId("landing-format-1")).toContainText(/voice/i);
    await expect(page.getByTestId("landing-format-2")).toContainText(/caption/i);
    await expect(page.getByTestId("landing-format-3")).toContainText(/modification/i);
    await expect(page.getByTestId("landing-no-filmed-instruction")).toContainText(
      /no filmed instruction/i,
    );
  });

  test("each featured session carries real facts and its own Preview and Start", async ({ page }) => {
    for (const id of ["tired", "before-bed", "low-energy"]) {
      const card = page.getByTestId(`landing-session-${id}`);
      await expect(card).toContainText(
        /\d+ min, including guidance · (Beginner|Intermediate|Advanced) · (Gentle|Moderate|Strong) · \d+ poses/,
      );
      await expect(card).toContainText(/Needs |No props/);
      await expect(card).toContainText(/Learn, with captions/);

      const previewBtn = page.getByTestId(`landing-session-preview-${id}`);
      await expect(previewBtn).toHaveAttribute("aria-expanded", "false");
      await previewBtn.click();
      await expect(previewBtn).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId(`landing-session-poses-${id}`).locator("li").first()).toBeVisible();
    }
  });

  test("each featured Start opens that session, not a generic one", async ({ page }) => {
    const expected: Record<string, RegExp> = {
      tired: /I'm tired/,
      "before-bed": /Before bed/,
      "low-energy": /I'm low energy/,
    };
    for (const [id, title] of Object.entries(expected)) {
      await page.goto("/welcome");
      const spec = await page
        .getByTestId(`landing-session-${id}`)
        .locator('[data-spec="duration"]')
        .innerText();
      await page.getByTestId(`landing-session-start-${id}`).click();
      await expect(page).toHaveURL(/\/guided/);
      const skip = page.getByTestId("premood-skip");
      if (await skip.isVisible().catch(() => false)) await skip.click();
      const preflight = page.getByTestId("session-preflight");
      await expect(preflight).toContainText(title);
      // Same length on the card and in the player's preparation screen.
      await expect(page.getByTestId("preflight-spec")).toContainText(spec.split(",")[0]!);
    }
  });

  test("shows how answers change a session with two real plans", async ({ page }) => {
    const a = page.getByTestId("landing-personalisation-new-10");
    const b = page.getByTestId("landing-personalisation-some-20");
    await expect(a).toContainText(/New to yoga/);
    await expect(b).toContainText(/Some experience/);
    expect(await a.locator("li").count()).toBeLessThan(await b.locator("li").count());
  });

  test("is plain about what is free, who wrote it, and where to get help", async ({ page }) => {
    await expect(page.getByTestId("landing-free-list")).toContainText(
      new RegExp(`all ${ASANAS.length} illustrated poses`, "i"),
    );
    await expect(page.getByTestId("landing-free-list")).toContainText(/waitlist/i);
    await expect(page.getByTestId("landing-content-review")).toContainText(/catalog editors/i);
    await expect(page.getByTestId("landing-report-issue")).toHaveAttribute("href", /github\.com\/.+\/issues/);
    await expect(page.getByTestId("landing-help-link")).toHaveAttribute("href", "/help");
  });

  test("answers the practical questions without claiming offline practice", async ({ page }) => {
    const faq = page.locator("#faq");
    for (const topic of [/equipment/i, /offline/i, /see and hear/i, /progress stored/i, /never done yoga/i]) {
      await expect(faq).toContainText(topic);
    }
    const offline = faq.locator("details", { hasText: /offline/i });
    await offline.locator("summary").click();
    await expect(offline).toContainText(/^[\s\S]*No\./);
  });

  test("claims no social proof it cannot show", async ({ page }) => {
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/\b\d[\d,.]*\s*(k|m|million|thousand)?\s*(users|members|students|downloads)\b/i);
    expect(body).not.toMatch(/\b(rated|stars?|reviews?|testimonial)\b/i);
    expect(body).not.toMatch(/\b(certified|RYT|E-RYT|doctor|physio(therapist)?|clinically proven)\b/i);
  });

  test("hero copy has readable contrast on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/welcome");
    const ratio = await page.getByTestId("landing-headline").evaluate((el) => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
      };
      let bgEl: Element | null = el;
      let bg = "rgba(0, 0, 0, 0)";
      while (bgEl) {
        bg = getComputedStyle(bgEl).backgroundColor;
        if (!/rgba\(.*, 0\)$/.test(bg) && bg !== "transparent") break;
        bgEl = bgEl.parentElement;
      }
      const fg = lum(parse(getComputedStyle(el).color));
      const b = lum(parse(bg));
      return (Math.max(fg, b) + 0.05) / (Math.min(fg, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("the main actions are reachable by keyboard with a visible focus", async ({ page }) => {
    await page.keyboard.press("Tab"); // skip link
    await expect(page.locator("a", { hasText: "Skip to content" })).toBeFocused();
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.getByTestId("landing-cta-primary").evaluate((el) => el === document.activeElement);
    }
    expect(reached, "primary CTA not reachable by Tab").toBe(true);
  });

  test("the walkthrough is playable and captioned", async ({ page }) => {
    await page.locator("#demo").scrollIntoViewIfNeeded();
    const video = page.locator("#demo video");
    await expect(video).toHaveCount(1);
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect(page.locator("#demo track")).toHaveCount(1, { timeout: 10000 });
    const captions = await page.request.get(
      (await page.locator("#demo track").getAttribute("src")) ?? "",
    );
    expect(captions.ok(), "caption file is missing").toBeTruthy();
  });

  test("no sideways scroll at phone or desktop width", async ({ page }) => {
    for (const [w, h] of [[390, 844], [320, 568], [768, 1024], [1280, 900]] as const) {
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
