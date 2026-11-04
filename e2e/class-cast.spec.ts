import { test, expect, type Page } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";
import { CLASS_TOKEN_REFRESH_LEAD_MS } from "../client/src/lib/classTokenRefresh";

/**
 * Chromecast / AirPlay in the class player (Mux Player's own cast support).
 * Mux and Google hosts are blocked, so no device is ever found: what is
 * checked is that remote playback is no longer switched off, that the cast and
 * AirPlay buttons stay hidden without a device, and that the URL handed to a
 * TV carries the signed playback token, including after a token refresh.
 */
const FREE = "desk-back-relief";
const SIGNED = "deep-hamstring-release";

async function seed(page: Page) {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
  }, LEGAL_VERSION);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io|gstatic\.com)\//, (route) => route.abort());
  await page.route(/^http:\/\/([a-z0-9-]+\.)*gstatic\.com\//, (route) => route.abort());
}

/** The inner media element's cast state, read through the player's shadow DOM. */
async function castState(page: Page) {
  return page.locator("mux-player").evaluate((player) => {
    const media = (player as unknown as { media: HTMLElement }).media;
    const all: Element[] = [];
    const walk = (root: ParentNode | null) => {
      if (!root) return;
      root.querySelectorAll("*").forEach((el) => { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); });
    };
    walk(player.shadowRoot);
    const button = (tag: string) => {
      const el = all.find((e) => e.tagName.toLowerCase() === tag);
      return el ? { display: getComputedStyle(el).display } : null;
    };
    return {
      castSrc: media.getAttribute("cast-src"),
      remotePlaybackDisabled: media.hasAttribute("disableremoteplayback"),
      castButton: button("media-cast-button"),
      airplayButton: button("media-airplay-button"),
    };
  });
}

test("free class: cast is on, buttons hidden without a device, no token in the cast URL", async ({ page }) => {
  await seed(page);
  await page.goto(`/classes/${FREE}`);
  await expect(page.locator("mux-player")).toBeAttached();
  await expect.poll(async () => (await castState(page)).castSrc).toMatch(/^https:\/\/stream\.mux\.com\/[A-Za-z0-9]+\.m3u8/);
  const state = await castState(page);
  expect(state.remotePlaybackDisabled).toBe(false);
  expect(new URL(state.castSrc!).searchParams.has("token")).toBe(false);
  expect(state.castButton?.display ?? "none").toBe("none");
  expect(state.airplayButton?.display ?? "none").toBe("none");
});

test("signed Plus class: the cast URL carries the playback token, and follows a refresh", async ({ page }) => {
  await seed(page);
  const token = (n: number) => `eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJ2IiwibiI6${n}fQ.sig${n}`;
  let served = 0;
  await page.route(new RegExp(`/api/classes/${SIGNED}$`), async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    served += 1;
    // The player refreshes CLASS_TOKEN_REFRESH_LEAD_MS before expiry: the first
    // token comes due 4s after load, long enough to read it first; the second
    // lasts an hour.
    const lead = CLASS_TOKEN_REFRESH_LEAD_MS / 1000;
    const expiresAt = Math.floor(Date.now() / 1000) + (served === 1 ? lead + 4 : 3600);
    body.viewerPlan = "plus";
    body.class = {
      ...body.class, locked: false,
      playback: {
        provider: "mux", policy: "signed", playbackId: "signedCastTestId",
        tokens: { playback: token(served), thumbnail: `thumb${served}`, storyboard: `story${served}` }, expiresAt,
      },
    };
    await route.fulfill({ response: res, json: body });
  });
  await page.goto(`/classes/${SIGNED}`);
  await expect(page.locator("mux-player")).toBeAttached();

  const tokenIn = async () => {
    const src = (await castState(page)).castSrc;
    return src ? new URL(src).searchParams.get("token") : null;
  };
  await expect.poll(tokenIn).toBe(token(1));
  const first = await castState(page);
  expect(new URL(first.castSrc!).pathname).toBe("/signedCastTestId.m3u8");
  expect(first.remotePlaybackDisabled).toBe(false);
  expect(first.castButton?.display ?? "none").toBe("none");

  // The refreshed token reaches the cast URL too, so a cast started after a
  // refresh gets a token that is still valid.
  await expect.poll(tokenIn, { timeout: 15_000 }).toBe(token(2));
});
