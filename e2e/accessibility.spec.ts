import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/**
 * Automated accessibility checks that keep running.
 *
 * 1. axe (WCAG 2.0/2.1 A + AA, 2.2 AA) on the pages a first-time visitor and a
 *    subscriber actually pass through, at a desktop and a phone width, plus a
 *    dark-theme pass (contrast bugs tend to live in one theme only).
 * 2. Keyboard checks axe cannot make: the skip link works, Tab never gets
 *    stuck, nothing invisible takes focus, and the class player's own
 *    controls — captions included — are reachable and operable without a
 *    mouse.
 *
 * Mux is blocked, as in the other class specs, so the player sits in its
 * "cannot load" state. That means Mux Player's *internal* buttons (play, seek,
 * volume, its own captions menu) are disabled here and cannot be exercised;
 * what is asserted is the player as a tab stop and the page's own controls.
 *
 * `AXE_REPORT=/path/file.json npx playwright test e2e/accessibility.spec.ts`
 * writes every violation to a file instead of failing, for an audit.
 */
const FREE_CLASS = "desk-back-relief";
const PLUS_CLASS = "steady-strength-flow";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Target = { name: string; path: string; firstVisit?: boolean; ready: (page: Page) => Promise<unknown> };
const PAGES: Target[] = [
  { name: "landing", path: "/welcome", firstVisit: true, ready: (page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "pose catalog", path: "/asanas", ready: (page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "free class", path: `/classes/${FREE_CLASS}`, ready: (page) => expect(page.locator("mux-player")).toBeAttached() },
  { name: "locked Plus class", path: `/classes/${PLUS_CLASS}`, ready: (page) => expect(page.getByTestId("class-player-locked")).toBeVisible() },
  { name: "account sign-in", path: "/account", ready: (page) => expect(page.getByTestId("signin-submit")).toBeVisible() },
  { name: "plus", path: "/plus", ready: (page) => expect(page.getByTestId("paywall-root")).toBeVisible() },
  { name: "help", path: "/help", ready: (page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible() },
];

const VARIANTS = [
  { name: "desktop", width: 1280, height: 800, dark: false },
  { name: "mobile", width: 390, height: 844, dark: false },
  { name: "desktop dark", width: 1280, height: 800, dark: true },
] as const;

async function open(page: Page, target: Target, variant: { width: number; height: number; dark: boolean }) {
  await page.setViewportSize({ width: variant.width, height: variant.height });
  // Reduced motion: axe reads colours mid-fade otherwise and reports contrast that no one ever sees.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(([version, firstVisit, dark]) => {
    if (!firstVisit) {
      localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
      localStorage.setItem("sadhana.welcome.seen", "1");
    }
    if (dark) localStorage.setItem("sadhana.theme", "dark");
  }, [LEGAL_VERSION, !!target.firstVisit, variant.dark] as const);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io|gstatic\.com)\//, (route) => route.abort());
  await page.goto(target.path);
  await target.ready(page);
  await page.waitForLoadState("networkidle");
}

const report: Record<string, unknown> = {};

for (const variant of VARIANTS) {
  for (const target of PAGES) {
    test(`axe: ${target.name} @ ${variant.name}`, async ({ page }) => {
      await open(page, target, variant);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      if (process.env.AXE_REPORT) {
        report[`${target.name} @ ${variant.name}`] = results.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.map((n) => ({ target: n.target.join(" >> "), html: n.html.slice(0, 220), summary: n.failureSummary?.replace(/\s+/g, " ").slice(0, 260) })),
        }));
        fs.writeFileSync(process.env.AXE_REPORT, JSON.stringify(report, null, 1));
        return;
      }
      expect(results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}

/** What has focus, followed through shadow roots, and whether a sighted keyboard user could see it. */
function focusedElement(page: Page) {
  return page.evaluate(() => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (!el || el === document.body) return { key: "BODY", visible: true, inMain: false };
    const node = el as HTMLElement;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const host = (node.getRootNode() as ShadowRoot).host ?? node;
    return {
      key: `${node.tagName.toLowerCase()}|${node.getAttribute("data-testid") ?? ""}|${node.getAttribute("aria-label") ?? node.textContent?.trim().slice(0, 40) ?? ""}|${Math.round(rect.x)},${Math.round(rect.y)}`,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0,
      inMain: !!host.closest("#main-content, main"),
    };
  });
}

for (const variant of VARIANTS.filter((v) => !v.dark)) {
  for (const target of PAGES) {
    test(`keyboard: Tab never sticks or lands on something invisible — ${target.name} @ ${variant.name}`, async ({ page }) => {
      await open(page, target, variant);
      let previous = "";
      let moved = 0;
      for (let i = 0; i < 45; i++) {
        await page.keyboard.press("Tab");
        const focus = await focusedElement(page);
        expect(focus.visible, `Tab ${i + 1} put focus on something that cannot be seen: ${focus.key}`).toBe(true);
        expect(focus.key, `Tab ${i + 1} did not move focus (keyboard trap) at ${focus.key}`).not.toBe(previous);
        if (focus.key !== "BODY") moved++;
        previous = focus.key;
      }
      expect(moved).toBeGreaterThan(5);
    });
  }
}

test("keyboard: the skip link is the first stop and moves focus into the page content", async ({ page }) => {
  await open(page, PAGES[1]!, VARIANTS[0]);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  expect((await focusedElement(page)).inMain, "the next stop after the skip link is inside the main content, past the sidebar").toBe(true);
});

/** Give the blocked player a captions track and announce metadata, as a loaded video would. */
async function loadPlayerWith(page: Page, captions: boolean) {
  await page.locator("mux-player").evaluate((el, withCaptions) => {
    const media = (el as unknown as { media?: { nativeEl?: HTMLVideoElement } }).media?.nativeEl;
    if (withCaptions) media?.addTextTrack("captions", "English", "en");
    el.dispatchEvent(new Event("loadedmetadata"));
  }, captions);
}
const captionMode = (page: Page) => page.locator("mux-player").evaluate((el) => {
  const tracks = (el as unknown as { textTracks?: TextTrackList }).textTracks;
  return tracks ? Array.from(tracks).find((t) => t.kind === "captions")?.mode ?? null : null;
});

test("class player: the player and the page's controls are all reachable with Tab, in reading order", async ({ page }) => {
  await open(page, PAGES[2]!, VARIANTS[0]);
  await loadPlayerWith(page, true);
  await expect(page.getByTestId("class-captions-toggle")).toBeEnabled();
  await page.getByTestId("class-player-back").focus();
  const order: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute("data-testid") ?? el?.tagName.toLowerCase() ?? "";
    }));
  }
  // The player first, then captions, then speed — the order they appear on the page.
  expect(order.slice(0, 5)).toEqual(["class-mux-player", "class-captions-toggle", "class-speed-0.75", "class-speed-1", "class-speed-1.25"]);
  expect(order.some((id) => id.startsWith("class-next-")), "focus leaves the player area for the rest of the page").toBe(true);
});

test("class player: captions can be turned on and off from the keyboard, and the button says which", async ({ page }) => {
  await open(page, PAGES[2]!, VARIANTS[1]);
  await loadPlayerWith(page, true);
  const toggle = page.getByTestId("class-captions-toggle");
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAccessibleName("Captions");
  // The player shows captions by default when a track exists (defaultHiddenCaptions={false}).
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await captionMode(page)).toBe("showing");
  await expect(page.getByTestId("class-captions-none")).toHaveCount(0);

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await captionMode(page)).toBe("hidden");
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await captionMode(page)).toBe("showing");

  // The documented "C" shortcut and the button stay in step.
  await page.locator("h1").click();
  await page.keyboard.press("c");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  // So does a change made in the player's own captions menu.
  await page.locator("mux-player").evaluate((el) => {
    const tracks = (el as unknown as { textTracks: TextTrackList }).textTracks;
    Array.from(tracks).forEach((t) => { t.mode = "showing"; });
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("class player: a video with no captions says so instead of offering a dead toggle", async ({ page }) => {
  await open(page, PAGES[2]!, VARIANTS[0]);
  const toggle = page.getByTestId("class-captions-toggle");
  // Before the video's tracks are known the page makes no claim either way.
  await expect(toggle).toBeDisabled();
  await expect(page.getByTestId("class-captions-none")).toHaveCount(0);
  await loadPlayerWith(page, false);
  await expect(toggle).toBeDisabled();
  await expect(page.getByTestId("class-captions-none")).toHaveText("This video has no captions.");
});

test("class cards: the accessible name contains the text the card shows", async ({ page }) => {
  await open(page, { name: "classes", path: "/classes", ready: (p) => expect(p.getByTestId(`class-card-${FREE_CLASS}`)).toBeVisible() }, VARIANTS[0]);
  const free = page.getByTestId(`class-card-${FREE_CLASS}`);
  await expect(free).toHaveAccessibleName(/^Back relief for desk days 15 min\s+Beginner$/);
  expect(await free.getAttribute("aria-label"), "named by its content, not a re-worded label").toBeNull();
  // What is only drawn — the lock — is still spoken.
  await expect(page.getByTestId(`class-card-${PLUS_CLASS}`)).toHaveAccessibleName(/unlock with Plus/);
});
