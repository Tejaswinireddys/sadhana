import { test, expect } from "@playwright/test";
import { MUX_PUBLIC_TEST_PLAYBACK_ID } from "../server/classSeed";

// Against the dev server's seeded (in-memory) class catalogue: class detail
// pages answer with the API's verdict, and the sitemap lists them.

test("a published class page is 200, a locked Plus one too, and a missing one is a 404 app page", async ({ request, page }) => {
  // Slugs come from the API rather than being hard-coded: the catalogue is data.
  const { items } = (await (await request.get("/api/classes?limit=100")).json()) as { items: Array<{ slug: string; tier: string; locked: boolean }> };
  const free = items.find((c) => c.tier === "free");
  const locked = items.find((c) => c.tier === "plus" && c.locked);
  expect(free, "a published free class").toBeTruthy();
  expect(locked, "a locked Plus class for a guest").toBeTruthy();
  for (const slug of [free!.slug, locked!.slug]) {
    const res = await request.get(`/classes/${slug}`);
    expect(res.status(), slug).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^text\/html/);
  }
  const missing = await request.get("/classes/missing-class");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"]).toMatch(/^text\/html/);
  expect(await missing.text()).toContain('<div id="root">');
  expect((await request.get("/api/classes/missing-class")).status()).toBe(404);

  // The 404 still renders the app's own not-found state for a person.
  const nav = await page.goto("/classes/missing-class");
  expect(nav?.status()).toBe(404);
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("unknown API routes are still JSON 404s", async ({ request }) => {
  const res = await request.get("/api/classes-nope/x");
  expect(res.status()).toBe(404);
  expect(res.headers()["content-type"]).toMatch(/^application\/json/);
});

test("the sitemap lists every published class and no playback ids", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const classes = (await (await request.get("/api/classes?limit=100")).json()) as {
    items: Array<{ slug: string; playback?: { playbackId?: string | null } | null }>;
  };
  expect(classes.items.length).toBeGreaterThan(0);
  for (const { slug } of classes.items) expect(xml).toMatch(new RegExp(`<loc>[^<]+/classes/${slug}</loc>`));
  const ids = [MUX_PUBLIC_TEST_PLAYBACK_ID, ...classes.items.map((c) => c.playback?.playbackId).filter((id): id is string => !!id)];
  for (const id of ids) expect(xml).not.toContain(id);
  expect(xml).not.toMatch(/token=/);
});
