import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Who lands where on `/`, and what the sidebar shows before the session is
 * known. `/api/auth/me` is mocked and the session cookie is a stand-in, so no
 * real signup spends the suite's shared auth rate limit; the server only
 * looks at whether a session cookie is present when choosing the HTML entry.
 */
const ACCOUNT = { id: 42, email: "member@example.test", displayName: "Asha", emailVerified: true, plan: "free" };

async function legalOnly(page: Page) {
  // Legal banner acknowledged, but NO welcome/onboarding flags: the case that
  // used to bounce an account holder to /welcome.
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
  }, LEGAL_VERSION);
}

async function signedInSession(page: Page, baseURL: string) {
  await page.context().addCookies([{ name: "sadhana_session", value: "e2e-placeholder", url: baseURL }]);
  await page.route(/\/api\/auth\/me$/, (route) => route.fulfill({ json: { user: ACCOUNT, deviceRows: 0 } }));
}

test("a signed-in account holder who skipped onboarding lands on Today, with Continue your class", async ({ page, baseURL }) => {
  await legalOnly(page);
  await signedInSession(page, baseURL!);
  await page.route(/\/api\/class-progress$/, (route) => route.fulfill({
    json: { items: [{
      id: 2, slug: "desk-back-relief", title: "Back relief for desk days", description: "", instructorName: "Sadhana team",
      level: "beginner", durationMinutes: 15, focusTags: ["back pain"], thumbnailUrl: null, tier: "free", locked: false,
      playback: null, progress: { secondsWatched: 95, completed: false, updatedAt: new Date().toISOString() },
    }] },
  }));
  await page.goto("/");
  await expect(page.getByTestId("home-continue-class")).toContainText("Continue your class");
  await expect(page.getByTestId("home-continue-class")).toContainText("from 1:35");
  await expect(page).toHaveURL(/\/$/);
  // Remembered, so the next visit needs no session check at all.
  expect(await page.evaluate(() => localStorage.getItem("sadhana.welcome.seen"))).toBe("1");
});

test("a brand-new guest still gets /welcome", async ({ page }) => {
  await legalOnly(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-hero")).toBeVisible();
  await expect(page.getByTestId("home-row-continue")).toHaveCount(0);
});

test("an in-app visit to / by a signed-in user without local flags stays on Today", async ({ page, baseURL }) => {
  await legalOnly(page);
  await signedInSession(page, baseURL!);
  await page.goto("/classes");
  await expect(page.getByRole("heading", { level: 1, name: "Video classes" })).toBeVisible();
  // Simulate a browser where the flag was never written, then navigate home in-app.
  await page.evaluate(() => localStorage.removeItem("sadhana.welcome.seen"));
  await page.getByTestId("nav-today").first().click();
  await expect(page.getByTestId("home-row-continue")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("the sidebar shows a neutral placeholder, not 'Sign in', until the session is known", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await legalOnly(page);
  await page.addInitScript(() => localStorage.setItem("sadhana.welcome.seen", "1"));
  await page.context().addCookies([{ name: "sadhana_session", value: "e2e-placeholder", url: baseURL! }]);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/api\/auth\/me$/, async (route) => {
    await held;
    await route.fulfill({ json: { user: ACCOUNT, deviceRows: 0 } });
  });
  await page.goto("/classes");
  const account = page.getByTestId("sidebar-account");
  await expect(account.getByTestId("sidebar-account-loading")).toBeVisible();
  await expect(account).not.toContainText("Sign in");
  await expect(account).toHaveAttribute("aria-busy", "true");
  release();
  await expect(account).toContainText("Asha");
  await expect(account.getByTestId("sidebar-account-loading")).toHaveCount(0);
});

test("a guest's sidebar settles on 'Sign in'", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await legalOnly(page);
  await page.addInitScript(() => localStorage.setItem("sadhana.welcome.seen", "1"));
  await page.goto("/classes");
  await expect(page.getByTestId("sidebar-account")).toContainText("Sign in");
});
