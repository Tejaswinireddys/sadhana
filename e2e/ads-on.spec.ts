import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Free-tier ads with ADS_ENABLED=true and the house provider (the "ads"
 * Playwright project's server). Mux hosts are blocked; class playback is
 * driven by firing media events on <mux-player> (see class-library.spec.ts).
 */
const FREE_CLASS = "desk-back-relief";
const PLUS_CLASS = "steady-strength-flow";
const SLOT = '[data-testid^="ad-slot-"]';

async function seed(page: Page) {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    // Record any ad slot that renders, even for one frame.
    const w = window as unknown as { __adSeen: string[] };
    w.__adSeen = [];
    new MutationObserver(() => {
      document.querySelectorAll('[data-testid^="ad-slot-"]').forEach((el) => {
        const id = el.getAttribute("data-testid")!;
        if (!w.__adSeen.includes(id)) w.__adSeen.push(id);
      });
    }).observe(document, { childList: true, subtree: true });
  }, LEGAL_VERSION);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io)\//, (route) => route.abort());
}

const adsSeen = (page: Page) => page.evaluate(() => (window as unknown as { __adSeen: string[] }).__adSeen);

async function asAccount(page: Page, plan: "free" | "plus", entitlement: Record<string, unknown>) {
  await page.route(/\/api\/auth\/me$/, (route) => route.fulfill({
    json: { user: { id: 9, email: `${plan}@example.test`, displayName: plan, emailVerified: true, plan }, deviceRows: 0 },
  }));
  await page.route(/\/api\/billing\/entitlement$/, (route) => route.fulfill({ json: entitlement }));
}

/** `a` comes before `b` in document order. */
async function precedes(page: Page, a: string, b: string) {
  return page.evaluate(([a, b]) => {
    const first = document.querySelector(a);
    const second = document.querySelector(b);
    return !!first && !!second && !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, [a, b]);
}

test.beforeEach(async ({ page }) => { await seed(page); });

test("a guest sees one labelled house ad below Today's practice", async ({ page }) => {
  await page.route(/\/api\/billing\/config$/, (route) => route.fulfill({
    json: { enabled: true, prices: { month: { amount: 9.99, currency: "usd" }, year: { amount: 59.99, currency: "usd" } } },
  }));
  await page.goto("/");
  const slot = page.getByTestId("ad-slot-today");
  await expect(slot).toBeVisible();
  await expect(page.locator(SLOT)).toHaveCount(1);
  await expect(slot.getByTestId("ad-label")).toHaveText("Ad");
  await expect(slot.getByTestId("ad-remove")).toHaveAttribute("href", "/plus");
  await expect(slot.getByTestId("ad-house")).toContainText("Go ad-free with Sadhana Plus");
  await expect(slot.getByTestId("ad-house-price")).toHaveText("$9.99/mo or $59.99/yr");
  await expect(slot.getByTestId("ad-house")).toHaveAttribute("href", "/plus");
  expect(await precedes(page, '[aria-labelledby="primary-practice-heading"]', '[data-testid="ad-slot-today"]')).toBe(true);
  expect(await precedes(page, '[data-testid="ad-slot-today"]', '[data-testid="home-row-continue"]')).toBe(true);
  // House ads load nothing third-party, and need no cookie notice.
  await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
  await expect(page.getByTestId("ad-consent-banner")).toHaveCount(0);
});

test("the house card names no price when billing prices are unavailable", async ({ page }) => {
  await page.route(/\/api\/billing\/config$/, (route) => route.fulfill({ json: { enabled: false } }));
  await page.goto("/");
  await expect(page.getByTestId("ad-house-price")).toHaveText("Every class, no ads.");
});

test("the class library has one slot, after the first row of classes", async ({ page }) => {
  await page.goto("/classes");
  await expect(page.getByTestId("ad-slot-classes")).toBeVisible();
  await expect(page.locator(SLOT)).toHaveCount(1);
  expect(await precedes(page, '[data-testid="class-library-free"]', '[data-testid="ad-slot-classes"]')).toBe(true);
  expect(await precedes(page, '[data-testid="ad-slot-classes"]', '[data-testid="class-library-plus"]')).toBe(true);
});

test("a free class has a slot below the player and description, hidden while the video plays", async ({ page }) => {
  await page.goto(`/classes/${FREE_CLASS}`);
  const slot = page.getByTestId("ad-slot-classDetail");
  await expect(slot).toBeVisible();
  expect(await precedes(page, '[data-testid="class-player"]', '[data-testid="ad-slot-classDetail"]')).toBe(true);
  expect(await precedes(page, '[data-testid="class-player-description"]', '[data-testid="ad-slot-classDetail"]')).toBe(true);

  await page.locator("mux-player").evaluate((el) => el.dispatchEvent(new Event("play")));
  await expect(slot).toHaveCount(0);
  await expect(page.locator(SLOT)).toHaveCount(0);
  await page.locator("mux-player").evaluate((el) => {
    Object.defineProperty(el, "currentTime", { configurable: true, get: () => 30 });
    el.dispatchEvent(new Event("pause"));
  });
  await expect(slot).toBeVisible();
});

test("a Plus class page has no slot", async ({ page }) => {
  await page.goto(`/classes/${PLUS_CLASS}`);
  await expect(page.getByTestId("class-player-locked")).toBeVisible();
  await page.waitForTimeout(500);
  expect(await adsSeen(page)).toEqual([]);
});

test("no slot on Plus, account, sign-in, verify or cancel pages", async ({ page }) => {
  for (const path of ["/plus", "/account", "/register", "/verify", "/cancel"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await adsSeen(page), path).toEqual([]);
  }
});

test("Plus members never see a slot, not even for a frame", async ({ page }) => {
  await asAccount(page, "plus", { plan: "plus", status: "active", cancelAtPeriodEnd: false, accessUntil: null });
  for (const path of ["/", "/classes", `/classes/${FREE_CLASS}`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await adsSeen(page), path).toEqual([]);
  }
});

test("a cancel-scheduled Plus member stays ad-free until the end date", async ({ page }) => {
  const accessUntil = new Date(Date.now() + 20 * 86_400_000).toISOString();
  await asAccount(page, "plus", { plan: "plus", status: "active", cancelAtPeriodEnd: true, accessUntil });
  await page.goto("/");
  await expect(page.getByTestId("banner-cancel-access")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await adsSeen(page)).toEqual([]);
});

test("a free account sees nothing until its entitlement has loaded, then the slot", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/api\/auth\/me$/, (route) => route.fulfill({
    json: { user: { id: 9, email: "free@example.test", displayName: "Free", emailVerified: true, plan: "free" }, deviceRows: 0 },
  }));
  await page.route(/\/api\/billing\/entitlement$/, async (route) => { await held; await route.fulfill({ json: { plan: "free", status: "active" } }); });
  await page.goto("/");
  await expect(page.getByTestId("home-row-continue")).toBeVisible();
  await page.waitForTimeout(600);
  expect(await adsSeen(page)).toEqual([]);
  release();
  await expect(page.getByTestId("ad-slot-today")).toBeVisible();
});

test("ads.txt is not served without an AdSense client id", async ({ request }) => {
  const res = await request.get("/ads.txt");
  expect(res.status()).toBe(404);
  expect(await res.text()).not.toContain("<!doctype");
});
