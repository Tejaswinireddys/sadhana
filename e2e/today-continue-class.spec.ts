import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Live bug: a signed-in account watched a class (the class page said
 * "Resuming from 0:12") but Today said "Nothing in progress".
 *
 * Everything here is real: a real account (signup signs in when the server
 * cannot send mail), real progress saved by the player, the real
 * /api/auth/me and /api/class-progress. Only Mux's CDN is blocked and media
 * events are driven on <mux-player>, because Playwright's Chromium cannot
 * decode H.264 (see class-library.spec.ts).
 *
 * One signup only: /api/auth/signup shares a 10-per-15-minutes budget with
 * the rest of the suite.
 */
const SLUG = "gentle-morning-wake-up";

test("a short watch shows up on Today straight away, for a real signed-in account", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
  }, LEGAL_VERSION);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io)\//, (route) => route.abort());

  const mail = await (await page.request.get("/api/auth/mail-status")).json();
  test.skip(mail.emailEnabled === true, "signup needs email verification on this server");
  const signup = await page.request.post("/api/auth/signup", {
    data: { email: `today-${Math.random().toString(36).slice(2, 10)}@example.test`, password: "today-passw0rd", displayName: "Today Test" },
  });
  expect(signup.status()).toBe(201);

  // Today first, so its (empty) class-progress result is already cached —
  // the state a real visitor is in before they open a class.
  await page.goto("/");
  await expect(page.getByTestId("home-continue-empty")).toBeVisible();

  await page.getByTestId("nav-classes").first().click();
  await page.getByTestId(`class-card-${SLUG}`).first().click();
  await expect(page.locator("mux-player")).toHaveCount(1);

  // Watch 12 seconds — under the 15s periodic save, so only the exit save
  // records it — then go to Today through the app, not a reload.
  await page.locator("mux-player").evaluate((el) => {
    for (let t = 1; t <= 12; t++) {
      Object.defineProperty(el, "currentTime", { configurable: true, get: () => t + 0.4 });
      Object.defineProperty(el, "duration", { configurable: true, get: () => 600 });
      el.dispatchEvent(new Event("timeupdate"));
    }
  });
  await page.getByTestId("nav-today").first().click();

  const card = page.getByTestId("home-continue-class");
  await expect(card).toContainText("Continue your class");
  await expect(card).toContainText("from 0:12");
  await expect(page.getByTestId("home-continue-empty")).toHaveCount(0);

  // Same source as the class page, and it survives a reload (it was saved).
  await page.reload();
  await expect(card).toContainText("from 0:12");
  await card.click();
  await expect(page.getByTestId("class-player-resume")).toContainText("Resuming from 0:12.");
});
