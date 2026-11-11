import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { ClassRow, InsertClass } from "../shared/schema";
import { MemoryStorage } from "./storage";
import { classPageHead } from "./classPages";
import { MUX_PUBLIC_TEST_PLAYBACK_ID } from "./classSeed";
import { brandPublicHtml } from "./publicUrl";
import { serveStatic, spaPage } from "./static";

const ORIGIN = "https://practice.example";
process.env.PUBLIC_APP_URL = ORIGIN;
// Signing is decided per test (`signedThumbnails`), never by a developer's .env.
delete process.env.MUX_SIGNING_KEY_ID;
delete process.env.MUX_SIGNING_KEY_PRIVATE;

/** The real head the app ships, so the rewriting is tested against the tags that exist. */
const TEMPLATE = fs.readFileSync(path.resolve(import.meta.dirname, "../client/index.html"), "utf8");
const FREE_ID = "FREEpublicPlaybackId0001";
const PLUS_ID = "PLUSsignedPlaybackIdSECRET";

function classRow(slug: string, overrides: Partial<InsertClass> = {}): InsertClass {
  return {
    slug, title: `Title ${slug}`, description: "", instructorName: "Asha Rao", level: "beginner",
    durationMinutes: 20, focusTags: [], muxPlaybackId: FREE_ID, playbackPolicy: "public",
    chapters: [], thumbnailUrl: null, thumbnailTimeSec: null,
    tier: "free", published: true, createdAt: "2026-10-01T09:30:00.000Z", ...overrides,
  };
}

async function catalogue() {
  const store = new MemoryStorage();
  await store.upsertClassBySlug(classRow("slow-morning-flow", {
    title: "Slow morning flow",
    description: "A gentle standing-to-floor sequence\n  to loosen the spine and hips before the day.",
    thumbnailUrl: "/posters/slow-morning-flow.webp", focusTags: ["flexibility"],
  }));
  await store.upsertClassBySlug(classRow("core-strength", {
    title: "Core strength", description: "Slow, controlled core work for members.",
    tier: "plus", playbackPolicy: "signed", muxPlaybackId: PLUS_ID,
    thumbnailUrl: `https://image.mux.com/${PLUS_ID}/thumbnail.webp?token=eyJhbGciOiJSUzI1NiJ9.leak`,
  }));
  await store.upsertClassBySlug(classRow("draft-flow", { title: "Unannounced draft class", description: "Not public yet.", published: false, muxPlaybackId: "DRAFTplaybackSECRET" }));
  const deleted = await store.upsertClassBySlug(classRow("retired-flow", { title: "Retired class title" }));
  await store.deleteClassWithProgress(deleted.id);
  return store;
}

const row = async (store: MemoryStorage, slug: string) => (await store.getClassBySlug(slug)) as ClassRow;
const meta = (html: string, key: string) =>
  new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`).exec(html)?.[1] ?? null;
const canonical = (html: string) => /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;
const title = (html: string) => /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? null;
const jsonLd = (html: string) => {
  const found = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  return found ? (JSON.parse(found) as Record<string, unknown>) : null;
};

async function harness(store: MemoryStorage) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "sadhana-dist-"));
  fs.writeFileSync(path.join(dist, "index.html"), TEMPLATE);
  fs.writeFileSync(path.join(dist, "welcome.html"), TEMPLATE);
  const app = express();
  serveStatic(app, dist, () => store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = async (pathname: string) => {
    const res = await fetch(`${base}${pathname}`, { redirect: "manual" });
    return { status: res.status, body: await res.text() };
  };
  return { get, close: () => new Promise<void>((resolve) => server.close(() => { fs.rmSync(dist, { recursive: true, force: true }); resolve(); })) };
}

test("a published class is served with its own title, description, canonical and share tags, before any JavaScript", async () => {
  const h = await harness(await catalogue());
  try {
    for (const pathname of ["/classes/slow-morning-flow", "/classes/slow-morning-flow/", "/classes/slow-morning-flow?utm_source=share"]) {
      const { status, body } = await h.get(pathname);
      const description = "A gentle standing-to-floor sequence to loosen the spine and hips before the day.";
      const poster = `${ORIGIN}/posters/slow-morning-flow.webp`;
      assert.equal(status, 200, pathname);
      assert.equal(title(body), "Slow morning flow · Sadhana");
      assert.equal(meta(body, "description"), description);
      assert.equal(canonical(body), `${ORIGIN}/classes/slow-morning-flow`, "one canonical URL, whatever was requested");
      assert.equal(meta(body, "og:url"), `${ORIGIN}/classes/slow-morning-flow`);
      assert.equal(meta(body, "og:title"), "Slow morning flow · Sadhana");
      assert.equal(meta(body, "og:description"), description);
      assert.equal(meta(body, "og:image"), poster);
      assert.equal(meta(body, "og:image:alt"), "Slow morning flow — yoga class on Sadhana");
      assert.equal(meta(body, "twitter:card"), "summary_large_image");
      assert.equal(meta(body, "twitter:title"), "Slow morning flow · Sadhana");
      assert.equal(meta(body, "twitter:description"), description);
      assert.equal(meta(body, "twitter:image"), poster);
      assert.equal(meta(body, "og:image:width"), null, "the default image's 1200×630 is not claimed for a class poster");
      assert.equal(meta(body, "og:image:height"), null);
    }
  } finally { await h.close(); }
});

test("a Plus class uses the same-origin thumbnail route and never a playback id or token", async () => {
  const store = await catalogue();
  const plus = await row(store, "core-strength");

  const signed = classPageHead(plus, ORIGIN, { signedThumbnails: true });
  assert.equal(signed.image, `${ORIGIN}/api/classes/core-strength/thumbnail.webp`);
  const html = brandPublicHtml(TEMPLATE, ORIGIN, "/classes/core-strength", signed);
  assert.equal(meta(html, "og:image"), `${ORIGIN}/api/classes/core-strength/thumbnail.webp`);
  assert.equal(meta(html, "twitter:image"), `${ORIGIN}/api/classes/core-strength/thumbnail.webp`);
  assert.equal(title(html), "Core strength · Sadhana");
  assert.doesNotMatch(html, new RegExp(PLUS_ID), "no playback id anywhere in the HTML");
  assert.doesNotMatch(html, /image\.mux\.com|stream\.mux\.com|token=|eyJ/, "no Mux URL and no token");

  // The server cannot sign (no Mux signing key): keep the site's default image
  // rather than fall back to the stored Mux URL.
  const unsigned = classPageHead(plus, ORIGIN, { signedThumbnails: false });
  assert.equal(unsigned.image, null);
  const fallback = brandPublicHtml(TEMPLATE, ORIGIN, "/classes/core-strength", unsigned);
  assert.equal(meta(fallback, "og:image"), `${ORIGIN}/og-image.png`);
  assert.equal(meta(fallback, "og:image:width"), "1200", "the default image keeps its own dimensions");
  assert.doesNotMatch(fallback, new RegExp(PLUS_ID));
  assert.doesNotMatch(fallback, /image\.mux\.com|token=|eyJ/);

  // The same holds through the real serving path, signing on or off.
  for (const signedThumbnails of [true, false]) {
    const page = await spaPage("/classes/core-strength", store, () => signedThumbnails);
    assert.equal(page.status, 200);
    assert.doesNotMatch(JSON.stringify(page.head), new RegExp(`${PLUS_ID}|token|eyJ|mux\\.com`));
  }
});

test("a Plus class with a public playback id never shares a thumbnail that embeds it", async () => {
  const store = new MemoryStorage();
  await store.upsertClassBySlug(classRow("public-plus", {
    tier: "plus", playbackPolicy: "public", muxPlaybackId: PLUS_ID, description: "Members only.",
    thumbnailUrl: `https://image.mux.com/${PLUS_ID}/thumbnail.webp`,
  }));
  const head = classPageHead(await row(store, "public-plus"), ORIGIN, { signedThumbnails: true });
  assert.equal(head.image, null);
  assert.equal(head.jsonLd, null, "no poster of its own, so no VideoObject either");
  assert.doesNotMatch(brandPublicHtml(TEMPLATE, ORIGIN, "/classes/public-plus", head), new RegExp(PLUS_ID));
});

test("missing, draft and deleted classes keep their 404 and get no class tags", async () => {
  const h = await harness(await catalogue());
  try {
    const generic = title(brandPublicHtml(TEMPLATE, ORIGIN, "/classes/missing-class"));
    for (const pathname of ["/classes/missing-class", "/classes/draft-flow", "/classes/retired-flow", "/classes/Bad%20Slug!"]) {
      const { status, body } = await h.get(pathname);
      assert.equal(status, 404, pathname);
      assert.equal(title(body), generic, `${pathname} keeps the generic title`);
      assert.equal(meta(body, "og:image"), `${ORIGIN}/og-image.png`);
      assert.equal(jsonLd(body), null);
      assert.doesNotMatch(body, /Unannounced draft class|Not public yet|Retired class title|DRAFTplaybackSECRET/, `${pathname} leaks nothing about an unpublished class`);
    }
  } finally { await h.close(); }
});

test("a catalogue that cannot be read serves the generic head, not an error", async () => {
  const page = await spaPage("/classes/slow-morning-flow", { getClassBySlug: async () => { throw new Error("db down"); } });
  assert.deepEqual(page, { status: 200, head: null });
  assert.deepEqual(await spaPage("/asanas/tadasana", await catalogue()), { status: 200, head: null }, "other pages are untouched");
});

test("VideoObject data appears only when every field in it is true", async () => {
  const store = await catalogue();
  const real = classPageHead(await row(store, "slow-morning-flow"), ORIGIN, { signedThumbnails: false });
  assert.deepEqual(real.jsonLd, {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "Slow morning flow",
    description: "A gentle standing-to-floor sequence to loosen the spine and hips before the day.",
    thumbnailUrl: [`${ORIGIN}/posters/slow-morning-flow.webp`],
    uploadDate: "2026-10-01T09:30:00.000Z",
    url: `${ORIGIN}/classes/slow-morning-flow`,
    isAccessibleForFree: true,
  });
  assert.deepEqual(jsonLd(brandPublicHtml(TEMPLATE, ORIGIN, "/classes/slow-morning-flow", real)), real.jsonLd);

  const plus = classPageHead(await row(store, "core-strength"), ORIGIN, { signedThumbnails: true }).jsonLd;
  assert.equal(plus?.isAccessibleForFree, false, "a members-only video is not described as free");
  assert.deepEqual(plus?.thumbnailUrl, [`${ORIGIN}/api/classes/core-strength/thumbnail.webp`]);
  assert.doesNotMatch(JSON.stringify(plus), new RegExp(`${PLUS_ID}|contentUrl|embedUrl|duration`), "no playback URL, and no duration the catalogue cannot vouch for");

  const withheld: Array<[string, Partial<InsertClass>]> = [
    ["a placeholder showing Mux's test clip", { muxPlaybackId: MUX_PUBLIC_TEST_PLAYBACK_ID }],
    ["a class with no video yet", { muxPlaybackId: null }],
    ["a class with no description of its own", { description: "  " }],
    ["a class with no poster of its own", { thumbnailUrl: null }],
    ["a class whose stored date is not a date", { createdAt: "sometime in October" }],
  ];
  for (const [label, overrides] of withheld) {
    const local = new MemoryStorage();
    await local.upsertClassBySlug(classRow("case", { description: "A real description.", thumbnailUrl: "/posters/case.webp", ...overrides }));
    const head = classPageHead(await row(local, "case"), ORIGIN, { signedThumbnails: true });
    assert.equal(head.jsonLd, null, label);
    assert.equal(head.title, "Title case · Sadhana", `${label}: the ordinary tags are still written`);
  }
});

test("a class with no description gets one built from its own facts, and long ones are cut at a word", async () => {
  const store = new MemoryStorage();
  await store.upsertClassBySlug(classRow("bare", { durationMinutes: 25, level: "intermediate", focusTags: ["strength", "balance"] }));
  await store.upsertClassBySlug(classRow("long", { description: "Breathe and move slowly through each shape. ".repeat(12) }));
  assert.equal(
    classPageHead(await row(store, "bare"), ORIGIN, { signedThumbnails: false }).description,
    "A 25-minute intermediate yoga class with Asha Rao. Focus: strength, balance.",
  );
  const long = classPageHead(await row(store, "long"), ORIGIN, { signedThumbnails: false }).description;
  assert.ok(long.length <= 200 && long.endsWith("…"), long);
  assert.doesNotMatch(long, /\s…$/);
});

test("stored text cannot break out of the head", async () => {
  const store = new MemoryStorage();
  await store.upsertClassBySlug(classRow("hostile", {
    title: `Twist & "shout" <script>alert(1)</script> $& $1`,
    description: `Ends early</script><script>alert(2)</script> "quoted" <!-- $'`,
    thumbnailUrl: "/posters/hostile.webp",
  }));
  const head = classPageHead(await row(store, "hostile"), ORIGIN, { signedThumbnails: false });
  const html = brandPublicHtml(TEMPLATE, ORIGIN, "/classes/hostile", head);
  assert.doesNotMatch(html, /<script>alert/, "no markup from stored text");
  assert.equal(title(html), "Twist &amp; &quot;shout&quot; &lt;script>alert(1)&lt;/script> $&amp; $1 · Sadhana");
  assert.equal(meta(html, "og:title"), "Twist &amp; &quot;shout&quot; &lt;script>alert(1)&lt;/script> $&amp; $1 · Sadhana");
  assert.equal(jsonLd(html)?.name, `Twist & "shout" <script>alert(1)</script> $& $1`, "and the structured data round-trips exactly");
  assert.equal((html.match(/<\/head>/g) ?? []).length, 1);
});
