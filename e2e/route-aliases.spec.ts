import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

// /login, /signin, /sign-in, /signup, /today and /support used to open the app's Not
// Found page. They are aliases now: rewritten to the real page before the
// router runs, with the alias dropped from history (see
// client/src/lib/routeAliases.ts).

test.beforeEach(async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  }, LEGAL_VERSION);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null, deviceRows: 0 } }));
});

test("/login opens the Sign in tab of /account", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/account\?tab=signin$/);
  await expect(page.getByTestId("tab-signin")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("signin-email")).toBeVisible();
});

for (const alias of ["/signin", "/sign-in"]) {
  test(`${alias} opens the Sign in tab of /account`, async ({ page }) => {
    await page.goto(alias);
    await expect(page).toHaveURL(/\/account\?tab=signin$/);
    await expect(page.getByTestId("tab-signin")).toHaveAttribute("data-state", "active");
  });
}

test("/signup opens the Sign up tab of /account", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/account\?tab=signup$/);
  await expect(page.getByTestId("tab-signup")).toHaveAttribute("data-state", "active");
});

test("/today opens Today, and Back does not return to the alias", async ({ page }) => {
  await page.goto("/classes");
  await page.goto("/today");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("home-row-continue")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/classes$/);
});

test("/support opens Help, and Back does not return to the alias", async ({ page }) => {
  await page.goto("/classes");
  await page.goto("/support");
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  await expect(page.getByTestId("help-contact")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/classes$/);
});

test("/support/extra is not an alias: it shows the app's Not Found page", async ({ page }) => {
  await page.goto("/support/extra");
  await expect(page).toHaveURL(/\/support\/extra$/);
  await expect(page.getByTestId("button-notfound-home")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toHaveCount(0);
});

test("the server answers the aliases with the app shell", async ({ request }) => {
  for (const pathname of ["/login", "/signin", "/sign-in", "/signup", "/today", "/support"]) {
    const res = await request.get(pathname);
    expect(res.status(), pathname).toBe(200);
    expect(res.headers()["content-type"], pathname).toContain("text/html");
  }
  for (const pathname of ["/api/login", "/api/support"]) {
    const api = await request.get(pathname);
    expect(api.status(), pathname).toBe(404);
    expect(api.headers()["content-type"], pathname).toContain("application/json");
    expect(await api.json(), pathname).toEqual({ error: "Not found" });
  }
});

test("/favicon.ico is served as an icon", async ({ request }) => {
  const res = await request.get("/favicon.ico");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)/);
  const body = await res.body();
  expect([...body.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
});
