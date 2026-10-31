import { test, expect } from "@playwright/test";

// A logged-out, first-time visitor: no account, no welcome/onboarding flags,
// nothing in localStorage at all. path-routing.spec.ts pre-sets those flags,
// which is why the welcome redirect swallowing deep links went unnoticed.

const PUBLIC_PAGES = [
  { path: "/asanas/marjaryasana-bitilasana", ready: "text-asana-english" },
  { path: "/asanas", ready: "chip-pose-count" },
  { path: "/pathways", ready: "section-quick-flows" },
  { path: "/guided", ready: "practice-hub" },
  { path: "/breathing", ready: "text-active-technique" },
  { path: "/search", ready: "input-search-page" },
];

test.describe("first visit to a deep link", () => {
  for (const { path, ready } of PUBLIC_PAGES) {
    test(`${path} renders directly instead of redirecting to /welcome`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId(ready)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }

  test("the bare home page still introduces the product", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test("Back from a deep link's next page returns to the deep link", async ({ page }) => {
    await page.goto("/asanas/marjaryasana-bitilasana");
    await expect(page.getByTestId("text-asana-english")).toBeVisible();
    await page.goto("/pathways");
    await page.goBack();
    await expect(page.getByTestId("text-asana-english")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/asanas/marjaryasana-bitilasana");
  });
});
