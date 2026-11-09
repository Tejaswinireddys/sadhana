import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { InsertClass } from "../shared/schema";
import { MemoryStorage } from "./storage";
import { classPageStatus, publishedClassPaths, sitemapXml } from "./classPages";
import { serveStatic, spaStatus } from "./static";
import { publicSitemapPaths } from "./pageMetadata";

function classRow(slug: string, overrides: Partial<InsertClass> = {}): InsertClass {
  return {
    slug, title: `Title ${slug}`, description: "", instructorName: "Sadhana AI guide", level: "beginner",
    durationMinutes: 20, focusTags: [], muxPlaybackId: `pb_${slug.replace(/-/g, "_")}`, playbackPolicy: "public",
    chapters: [{ startSec: 0, title: "Arrive" }], thumbnailUrl: null, thumbnailTimeSec: null,
    tier: "free", published: true, createdAt: "2026-10-01T00:00:00Z", ...overrides,
  };
}

/** A free class, a locked (signed) Plus class, a draft, and one deleted after publishing. */
async function catalogue() {
  const store = new MemoryStorage();
  await store.upsertClassBySlug(classRow("gentle-morning"));
  await store.upsertClassBySlug(classRow("core-strength", { tier: "plus", playbackPolicy: "signed", muxPlaybackId: "SIGNED_PB_SECRET" }));
  await store.upsertClassBySlug(classRow("draft-flow", { published: false, muxPlaybackId: "DRAFT_PB_SECRET" }));
  const deleted = await store.upsertClassBySlug(classRow("retired-flow", { muxPlaybackId: "DELETED_PB_SECRET" }));
  await store.deleteClassWithProgress(deleted.id);
  return store;
}

test("classPageStatus: published pages are 200, missing, draft and deleted are 404", async () => {
  const store = await catalogue();
  assert.equal(await classPageStatus("/classes/gentle-morning", store), 200, "valid free class");
  assert.equal(await classPageStatus("/classes/gentle-morning/", store), 200, "trailing slash");
  assert.equal(await classPageStatus("/classes/core-strength", store), 200, "locked Plus class still renders");
  assert.equal(await classPageStatus("/classes/missing-class", store), 404, "missing");
  assert.equal(await classPageStatus("/classes/draft-flow", store), 404, "unpublished draft");
  assert.equal(await classPageStatus("/classes/retired-flow", store), 404, "deleted");
  assert.equal(await classPageStatus("/classes/Bad%20Slug!", store), 404, "not a valid slug");
  assert.equal(await classPageStatus("/classes/%E0%A4%A", store), 404, "malformed escape");
});

test("classPageStatus leaves every other path to the existing rules", async () => {
  const store = await catalogue();
  for (const pathname of ["/classes", "/classes/", "/classes/a/b", "/asanas/tadasana", "/"]) {
    assert.equal(await classPageStatus(pathname, store), null, pathname);
  }
  assert.equal(await spaStatus("/classes", store), 200);
  assert.equal(await spaStatus("/no-such-page", store), 404);
});

test("classPageStatus does not 404 real pages when the catalogue cannot be read", async () => {
  const broken = { getClassBySlug: async () => { throw new Error("db down"); } };
  assert.equal(await classPageStatus("/classes/gentle-morning", broken), 200);
});

test("sitemap lists every published class under the canonical origin, and nothing else", async () => {
  const store = await catalogue();
  const paths = await publishedClassPaths(store);
  assert.deepEqual(paths, ["/classes/gentle-morning", "/classes/core-strength"]);
  const xml = sitemapXml("https://practice.sadhana.app", [...publicSitemapPaths(), ...paths]);
  assert.match(xml, /<loc>https:\/\/practice\.sadhana\.app\/classes<\/loc>/);
  assert.match(xml, /<loc>https:\/\/practice\.sadhana\.app\/classes\/gentle-morning<\/loc>/);
  assert.match(xml, /<loc>https:\/\/practice\.sadhana\.app\/classes\/core-strength<\/loc>/);
  assert.doesNotMatch(xml, /draft-flow|retired-flow|missing-class/);
  assert.doesNotMatch(xml, /pb_|PB_SECRET|token/i, "no playback ids or tokens");
  assert.deepEqual(await publishedClassPaths(undefined), []);
});

test("sitemapXml escapes XML-significant characters", () => {
  assert.match(sitemapXml("https://x.test", ["/a?b=1&c=2"]), /<loc>https:\/\/x\.test\/a\?b=1&amp;c=2<\/loc>/);
});

async function harness(store: MemoryStorage) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "sadhana-dist-"));
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><html><head><title>Sadhana</title></head><body><div id=\"root\" data-entry=\"app\"></div></body></html>");
  fs.writeFileSync(path.join(dist, "welcome.html"), "<!doctype html><html><head><title>Welcome</title></head><body><div id=\"root\" data-entry=\"welcome\"></div></body></html>");
  const app = express();
  serveStatic(app, dist, () => store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = async (pathname: string) => {
    const res = await fetch(`${base}${pathname}`, { redirect: "manual" });
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
  };
  return { get, close: () => new Promise<void>((resolve) => server.close(() => { fs.rmSync(dist, { recursive: true, force: true }); resolve(); })) };
}

test("served HTML: 200 app shell for published classes, 404 app shell for missing, draft and deleted", async () => {
  const h = await harness(await catalogue());
  try {
    for (const [pathname, status] of [
      ["/classes/gentle-morning", 200],
      ["/classes/core-strength", 200],
      ["/classes", 200],
      ["/classes/missing-class", 404],
      ["/classes/draft-flow", 404],
      ["/classes/retired-flow", 404],
    ] as const) {
      const res = await h.get(pathname);
      assert.equal(res.status, status, pathname);
      assert.match(res.type, /^text\/html/, pathname);
      assert.match(res.body, /data-entry="app"/, `${pathname} still renders the app's own screen`);
      assert.doesNotMatch(res.body, /pb_|PB_SECRET/, `${pathname} carries no playback id`);
    }
  } finally { await h.close(); }
});

test("unknown API routes stay JSON 404s", async () => {
  const h = await harness(await catalogue());
  try {
    for (const pathname of ["/api/classes-nope", "/api/nope", "/api"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 404, pathname);
      assert.match(res.type, /^application\/json/, pathname);
      assert.deepEqual(JSON.parse(res.body), { error: "Not found" }, pathname);
    }
  } finally { await h.close(); }
});
