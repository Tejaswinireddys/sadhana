import { defineConfig, devices } from "@playwright/test";

/**
 * Critical-journey E2E against the unified Express+Vite app.
 * Start the app separately (`npm run dev`) or let webServer boot it.
 *
 * Port is overridable because macOS AirPlay Receiver squats on 5000 and
 * answers 403 — which looks exactly like the app serving a forbidden page.
 * `E2E_PORT=5055 npx playwright test` to work around it.
 */
const PORT = process.env.E2E_PORT ?? "5000";

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
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `PORT=${PORT} npm run dev`,
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
