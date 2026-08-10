import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

// The app migrated from hash routing (`/#/asanas/tadasana`) to real paths
// (`/asanas/tadasana`). These tests lock in that a deep link is served by the
// server as the SPA shell and renders the pose detail with no `#` in the URL.

test.beforeEach(async ({ page }) => {
  // Skip the welcome/onboarding gates so a deep link renders the target page.
  await page.addInitScript((version) => {
    localStorage.setItem(
      "sadhana.legalAck",
      JSON.stringify({ version, acceptedAt: new Date().toISOString() }),
    );
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
});

test.describe("path-based routing", () => {
  test("server serves the SPA shell for a pose deep link", async ({ request }) => {
    const res = await request.get("/asanas/tadasana");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('<div id="root">');
  });

  test("deep link to /asanas/tadasana renders the pose detail without a hash", async ({
    page,
  }) => {
    await page.goto("/asanas/tadasana");

    // The pose detail rendered client-side from the real path.
    await expect(page.getByTestId("text-asana-english")).toHaveText("Mountain Pose");
    await expect(page.getByTestId("text-asana-sanskrit")).toHaveText("Tadasana");

    // The URL is a real path — no fragment.
    expect(new URL(page.url()).hash).toBe("");
    expect(new URL(page.url()).pathname).toBe("/asanas/tadasana");
  });

  test("legacy hash deep link redirects to the real path", async ({ page }) => {
    await page.goto("/#/asanas/tadasana");

    await expect(page.getByTestId("text-asana-english")).toHaveText("Mountain Pose");
    expect(new URL(page.url()).hash).toBe("");
    expect(new URL(page.url()).pathname).toBe("/asanas/tadasana");
  });
});
