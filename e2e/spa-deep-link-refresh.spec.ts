import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Direct URL + refresh for the routes a QA tester reported as 404. Server
 * already returns 200 HTML; these assert the client router paints the page
 * after a cold goto and again after reload (service worker is inactive in
 * Vite dev — production SW fallback is covered in client/public/sw.js).
 */

const ROUTES: Array<{ path: string; ready: (page: Page) => ReturnType<Page["getByTestId"]> | ReturnType<Page["getByRole"]> }> = [
  { path: "/privacy", ready: (p) => p.getByRole("heading", { name: "Privacy Policy" }) },
  { path: "/plus", ready: (p) => p.getByTestId("paywall-root") },
  { path: "/start", ready: (p) => p.getByTestId("start-quiz") },
  { path: "/terms", ready: (p) => p.getByRole("heading", { name: "Terms of Use" }) },
  { path: "/cancel", ready: (p) => p.getByTestId("page-cancel") },
  { path: "/asanas", ready: (p) => p.getByTestId("chip-pose-count") },
  { path: "/classes", ready: (p) => p.getByTestId("class-library-filters") },
  { path: "/journal", ready: (p) => p.getByTestId("button-new-entry") },
  { path: "/settings", ready: (p) => p.getByTestId("settings-account-status") },
];

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

test.describe("SPA deep link + refresh", () => {
  for (const { path, ready } of ROUTES) {
    test(`${path} loads directly and survives reload`, async ({ page }) => {
      await page.goto(path);
      await expect(ready(page)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);

      await page.reload();
      await expect(ready(page)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.getByText("Page not found")).toHaveCount(0);
    });
  }
});
