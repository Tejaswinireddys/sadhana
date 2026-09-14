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

test.describe("critical journeys", () => {
  test("healthz and sitemap are real responses", async ({ request }) => {
    const health = await request.get("/healthz");
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toEqual({ ok: true });

    const map = await request.get("/sitemap.xml");
    expect(map.ok()).toBeTruthy();
    const xml = await map.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("privacy");
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toContain("default-src");
    expect(res.headers()["x-powered-by"]).toBeFalsy();
  });

  test("guest can open privacy policy", async ({ page }) => {
    await page.goto("/#/privacy");
    await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();
  });

  test("account page exposes sign-in and reset tabs", async ({ page }) => {
    await page.goto("/#/account");
    await expect(page.getByTestId("tab-signin")).toBeVisible();
    await expect(page.getByTestId("tab-signup")).toBeVisible();
    await page.getByTestId("tab-reset").click();
    await expect(page.getByTestId("forgot-submit")).toBeVisible();
  });

  test("tab=create opens the signup form, not the on-device wizard", async ({ page }) => {
    await page.goto("/account?tab=create");
    await expect(page.getByTestId("signup-email")).toBeVisible();
    await expect(page.getByText(/No email or password/i)).toHaveCount(0);
  });

  test("signup requires email verification before session", async ({ page }) => {
    await page.goto("/#/account");
    await page.getByTestId("tab-signup").click();
    const email = `e2e-${Date.now()}@example.com`;
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill("password123");
    await page.getByTestId("signup-confirm").fill("password123");
    // Legal may already be ack'd via init script; check the box if still required.
    const ack = page.getByTestId("signup-legal-ack");
    if (await ack.isVisible()) {
      await ack.check();
    }
    await page.getByTestId("signup-submit").click();
    // Dev signup returns a verifyToken and navigates to /verify; auto-verify signs in.
    await expect(page.getByTestId("account-signed-in")).toBeVisible({ timeout: 25_000 });
  });

  test("outcome programs are listed on Pathways", async ({ page }) => {
    await page.goto("/#/pathways");
    await expect(page.getByTestId("card-pathway-foundations-beginner")).toBeVisible();
    await expect(page.getByTestId("card-pathway-stress-release-week")).toBeVisible();
    await expect(page.getByTestId("card-pathway-chair-limited-mobility")).toBeVisible();
  });

  test("nav uses Today label", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.getByRole("link", { name: "Today" }).first()).toBeVisible();
  });

  test("primary nav is five items and Teachers stays off chrome", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    for (const name of ["Today", "Practice", "Poses", "Progress", "You"] as const) {
      await expect(page.getByTestId(`nav-${name.toLowerCase()}`)).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Teachers" })).toHaveCount(0);
    await page.goto("/teachers");
    await expect(page.getByRole("heading", { name: /Teachers/i })).toBeVisible();
    await page.goto("/asanas");
    await expect(page.getByRole("heading", { name: "Poses" })).toBeVisible();
  });

  test("adaptive plan and pose coach routes render", async ({ page }) => {
    await page.goto("/#/adaptive");
    await expect(page.getByTestId("adaptive-start")).toBeVisible();
    await page.goto("/#/pose-coach");
    await expect(page.getByRole("heading", { name: /Pose self-check/i })).toBeVisible();
  });

  test("guided completion Done leaves /guided", async ({ page }) => {
    await page.goto("/asanas/tadasana");
    await page.getByTestId("button-practice-now").click();
    await expect(page).toHaveURL(/\/guided/);
    const skipMood = page.getByTestId("premood-skip");
    await skipMood.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
    if (await skipMood.isVisible()) {
      await skipMood.click();
    }
    const begin = page.getByTestId("button-begin-guided");
    if (await begin.isVisible().catch(() => false)) {
      await begin.click();
    }
    const skipPose = page.getByTestId("button-skip-pose");
    await expect(skipPose).toBeVisible({ timeout: 15_000 });
    await skipPose.click();
    await expect(page.getByTestId("guided-complete")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("button-log-continue").click();
    await expect(page.getByTestId("guided-complete")).toHaveCount(0, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/guided/);
  });

  test("quick-flow catalog minutes match guided setup", async ({ page }) => {
    await page.goto("/pathways");
    const card = page.getByTestId("card-flow-morning-wake-up");
    await expect(card).toBeVisible();
    const catalog = await card.locator("p").filter({ hasText: /min/ }).first().innerText();
    const guidedMinutes = catalog.match(/(\d+)\s*min/)?.[1];
    expect(guidedMinutes).toBeTruthy();
    await page.getByTestId("button-start-flow-morning-wake-up").click();
    await expect(page.getByTestId("pre-session-summary")).toBeVisible();
    await expect(page.getByTestId("pre-session-summary")).toContainText(`${guidedMinutes} min`);
  });

  test("pose coach shows a camera pending or error state", async ({ page }) => {
    await page.goto("/pose-coach");
    await expect(page.getByRole("heading", { name: /Pose self-check/i })).toBeVisible();
    const consent = page.getByTestId("pose-coach-consent");
    await consent.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
    if (await consent.isVisible()) {
      await consent.click();
    }
    await expect(page.getByTestId("button-camera-preview")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("button-camera-preview").click();
    await expect(page.getByTestId("camera-status")).toBeVisible({ timeout: 12_000 });
  });

  test("Front Splits header uses derived week range not a 15 min literal", async ({ page }) => {
    await page.goto("/pathways/front-splits");
    await expect(page.getByRole("heading", { name: "Front Splits" })).toBeVisible();
    await expect(page.getByText("15 min, 4x/week")).toHaveCount(0);
    await expect(page.getByText(/10–18 min, 4x\/week/).first()).toBeVisible();
    await expect(page.getByText(/10 min guided/).first()).toBeVisible();
  });

  test("Supported Fish lists real body regions", async ({ page }) => {
    await page.goto("/asanas/supported-fish-block");
    await expect(page.getByTestId("card-stretch-zones")).toBeVisible();
    await expect(page.getByText("Primary tissues")).toHaveCount(0);
    await expect(page.getByTestId("stretch-zone-region-0")).toContainText(/chest|back|throat|collarbone/i);
  });

  test("platform API v1 is reachable", async ({ request }) => {
    const res = await request.get("/api/v1");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.version).toBe("1");
  });
});
