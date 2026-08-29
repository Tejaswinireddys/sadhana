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

  test("adaptive plan and pose coach routes render", async ({ page }) => {
    await page.goto("/#/adaptive");
    await expect(page.getByTestId("adaptive-start")).toBeVisible();
    await page.goto("/#/pose-coach");
    await expect(page.getByRole("heading", { name: /Pose self-check/i })).toBeVisible();
  });

  test("platform API v1 is reachable", async ({ request }) => {
    const res = await request.get("/api/v1");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.version).toBe("1");
  });
});
