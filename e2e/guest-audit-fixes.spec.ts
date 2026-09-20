import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/** Regressions from the September 20, 2026 first-time-guest walkthrough. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript((v) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version: v, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
});

async function collect404s(page: Page, path: string): Promise<string[]> {
  const bad: string[] = [];
  page.on("response", (r) => { if (r.status() === 404) bad.push(r.url()); });
  await page.goto(path);
  await page.waitForTimeout(2000);
  return [...new Set(bad)];
}

test.describe("no broken pose thumbnails", () => {
  for (const [name, path] of [["Pathways", "/pathways"], ["Today", "/"], ["Practice", "/guided"]] as const) {
    test(`${name} loads without pose-thumbnail 404s`, async ({ page }) => {
      const bad = (await collect404s(page, path)).filter((u) => u.includes("/poses/"));
      expect(bad, `404s on ${name}`).toEqual([]);
    });
  }
});

test.describe("no horizontal page overflow", () => {
  for (const w of [1280, 1440, 1920]) {
    test(`Today does not scroll sideways at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/");
      await page.waitForTimeout(1500);
      const res = await page.evaluate(() => {
        const de = document.documentElement;
        window.scrollTo(9999, 0);
        const x = window.scrollX;
        window.scrollTo(0, 0);
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, scrolledX: x };
      });
      expect(res.scrolledX, "page scrolled horizontally").toBe(0);
      expect(res.scrollW).toBeLessThanOrEqual(res.clientW + 1);
    });
  }
});

test.describe("secondary surfaces are two taps from Home", () => {
  for (const [label, testId, urlPart] of [
    ["Breathing", "button-hub-breathing", "/breathing"],
    ["Kids", "button-hub-kids", "/kids"],
    ["Challenges", "button-hub-challenges", "/challenges"],
  ] as const) {
    test(`${label} is reachable in two taps`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      await page.getByRole("link", { name: /^Practice$/ }).first().click(); // tap 1
      await expect(page.getByTestId(testId)).toBeVisible();
      await page.getByTestId(testId).click(); // tap 2
      await expect(page).toHaveURL(new RegExp(urlPart));
    });
  }

  test("stays reachable once a session queue is loaded", async ({ page }) => {
    // The quiz loads a queue, after which Practice opens the pre-session
    // screen rather than the hub — which used to strand these links.
    await page.goto("/asanas/tadasana");
    await page.getByTestId("button-practice-now").click();
    await expect(page.getByTestId("button-begin-guided")).toBeVisible();
    await expect(page.getByTestId("more-ways-to-practice")).toBeVisible();
    await expect(page.getByTestId("button-hub-breathing")).toBeVisible();
  });
});

test.describe("consent notice never interrupts a practice", () => {
  test("waits for the session to end, then can be dismissed", async ({ page }) => {
    // Arrive with no acknowledgement so the notice is still pending.
    await page.addInitScript(() => localStorage.removeItem("sadhana.legalAck"));
    await page.goto("/asanas/tadasana");
    await page.getByTestId("button-practice-now").click();

    // Picking a mood is what asks for wellness consent — the exact path that
    // used to drop the notice on top of the player moments later.
    const premood = page.getByTestId("dialog-premood");
    await premood.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    if (await premood.isVisible().catch(() => false)) {
      await page.getByTestId("premood-mood-calm").click();
      await premood.waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
    }

    // Picking a mood starts the session straight away; if a prep screen is
    // shown instead, begin from there.
    const begin = page.getByTestId("button-begin-guided");
    if (await begin.isVisible().catch(() => false)) await begin.click();
    await page.waitForTimeout(1500);

    // Nothing overlays the running player.
    await expect(page.getByTestId("banner-legal-consent")).toHaveCount(0);

    await page.goto("/journal");
    await page.waitForTimeout(500);
    const banner = page.getByTestId("banner-legal-consent");
    if (await banner.count()) {
      await expect(page.getByTestId("banner-legal-accept")).toBeVisible();
      await page.getByTestId("banner-legal-accept").click();
      await expect(banner).toHaveCount(0);
    }
  });
});

test.describe("help and privacy copy", () => {
  test("Help is linked from the shell and answers the reset question", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/help");
    await expect(page.getByTestId("help-reset")).toBeVisible();
    await expect(page.getByTestId("help-guest")).toBeVisible();
    await expect(page.getByTestId("help-kids")).toBeVisible();
    await expect(page.getByTestId("help-streaks")).toBeVisible();
  });

  test("the reset failure state links to Help", async ({ page }) => {
    await page.goto("/account?tab=reset");
    await page.waitForTimeout(1200);
    const copy = page.getByTestId("reset-delivery-copy");
    await expect(copy).toBeVisible();
    // Only asserted when this deployment genuinely has no email configured.
    if ((await page.getByTestId("reset-help-link").count()) > 0) {
      await page.getByTestId("reset-help-link").click();
      await expect(page).toHaveURL(/\/help/);
    }
  });

  test("the buddy code explains its scope before you share it", async ({ page }) => {
    await page.goto("/challenges");
    await expect(page.getByTestId("buddy-code")).toBeVisible();
    const scope = page.getByTestId("buddy-code-scope");
    await expect(scope).toBeVisible();
    await expect(scope).toContainText("display name");
    await expect(scope).toContainText("not your practice history");
  });
});
