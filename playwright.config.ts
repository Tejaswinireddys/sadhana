import { defineConfig, devices } from "@playwright/test";

/**
 * Critical-journey E2E against the unified Express+Vite app on port 5000.
 * Start the app separately (`npm run dev`) or let webServer boot it.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5000/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
