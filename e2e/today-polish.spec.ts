import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/** Today: the Continue row's loading state, one billing notice, and account-aware header copy. */
async function seed(page: Page) {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    // Record whether "Nothing in progress" is ever rendered, even for a frame.
    (window as unknown as { __sawEmpty: boolean }).__sawEmpty = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="home-continue-empty"]')) (window as unknown as { __sawEmpty: boolean }).__sawEmpty = true;
    }).observe(document, { childList: true, subtree: true });
  }, LEGAL_VERSION);
}

/** Hold /api/class-progress until released, then answer with `items`. */
async function holdClassProgress(page: Page) {
  let release!: (items: unknown[]) => void;
  const answer = new Promise<unknown[]>((resolve) => { release = resolve; });
  await page.route(/\/api\/class-progress$/, async (route) => route.fulfill({ json: { items: await answer } }));
  return release;
}

const inProgress = {
  id: 1, slug: "gentle-morning-wake-up", title: "Gentle morning wake-up", description: "", instructorName: "Sadhana team",
  level: "beginner", durationMinutes: 10, focusTags: ["morning"], thumbnailUrl: null, tier: "free", locked: false,
  playback: null, progress: { secondsWatched: 12, completed: false, updatedAt: new Date().toISOString() },
};

test.beforeEach(async ({ page }) => { await seed(page); });

test("Continue practice holds a placeholder while class progress loads, never flashing 'Nothing in progress'", async ({ page }) => {
  const release = await holdClassProgress(page);
  await page.goto("/");
  await expect(page.getByTestId("home-continue-loading")).toBeVisible();
  await page.waitForTimeout(800); // programs have long since loaded; class progress has not
  await expect(page.getByTestId("home-continue-loading")).toBeVisible();
  await expect(page.getByTestId("home-continue-empty")).toHaveCount(0);
  release([inProgress]);
  await expect(page.getByTestId("home-continue-class")).toContainText("from 0:12");
  await expect(page.getByTestId("home-continue-loading")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __sawEmpty: boolean }).__sawEmpty)).toBe(false);
});

test("'Nothing in progress' appears only once everything has loaded empty", async ({ page }) => {
  const release = await holdClassProgress(page);
  await page.goto("/");
  await expect(page.getByTestId("home-continue-loading")).toBeVisible();
  release([]);
  await expect(page.getByTestId("home-continue-empty")).toContainText("Nothing in progress");
  await expect(page.getByTestId("home-continue-loading")).toHaveCount(0);
});

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

test("a Plus plan set to cancel at period end shows one notice, worded as still active", async ({ page }) => {
  const accessUntil = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await page.route(/\/api\/billing\/entitlement$/, (route) => route.fulfill({
    json: { plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil, renewsAt: accessUntil },
  }));
  await page.goto("/");
  const notice = page.getByTestId("banner-cancel-access");
  await expect(notice).toHaveCount(1);
  await expect(notice).toHaveAttribute("data-kind", "ending");
  await expect(notice).toContainText(`Your Plus plan ends on ${longDate(accessUntil)}.`);
  await expect(notice).toContainText("You keep access until then.");
  await expect(notice.getByTestId("banner-cancel-access-resubscribe")).toHaveAttribute("href", "/plus");
  await expect(page.getByTestId("home-cancel-cta")).toHaveCount(0);
  await expect(page.getByText(/Subscription canceled/)).toHaveCount(0);
});

test("'Subscription canceled' is used only once access has ended", async ({ page }) => {
  const accessUntil = new Date(Date.now() - 3 * 86_400_000).toISOString();
  await page.route(/\/api\/billing\/entitlement$/, (route) => route.fulfill({
    json: { plan: "free", status: "canceled", cancelAtPeriodEnd: true, accessUntil, renewsAt: null },
  }));
  await page.goto("/");
  const notice = page.getByTestId("banner-cancel-access");
  await expect(notice).toHaveAttribute("data-kind", "ended");
  await expect(notice.getByTestId("banner-cancel-access-title")).toHaveText("Subscription canceled");
  await expect(notice).toContainText(`Your Plus access ended on ${longDate(accessUntil)}.`);
  await expect(page.getByTestId("home-cancel-cta")).toHaveCount(0);
});

test("a guest's first-practice header says practice stays in this browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("text-home-subtitle")).toHaveText(
    "Your first practice is below. Nothing is saved anywhere but this browser until you say so.");
});

test("a signed-in account's header does not claim practice is browser-only", async ({ page }) => {
  await page.route(/\/api\/auth\/me$/, (route) => route.fulfill({
    json: { user: { id: 7, email: "member@example.test", displayName: "Member", emailVerified: true, plan: "free" }, deviceRows: 0 },
  }));
  await page.goto("/");
  const subtitle = page.getByTestId("text-home-subtitle");
  await expect(subtitle).toContainText("saved to your account");
  await expect(subtitle).not.toContainText("this browser");
});
