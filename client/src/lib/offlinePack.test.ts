import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { offlineManifestForSlugs, practiceOfflineUrls } from "./offlinePack.ts";

describe("offline practice pack", () => {
  it("asks for each pose illustration and its narration file", () => {
    const urls = practiceOfflineUrls(["tadasana", "balasana"]);
    assert.ok(urls.some((url) => url.endsWith("/poses/tadasana.webp")));
    assert.ok(urls.some((url) => url.endsWith("/audio/pose-tadasana.mp3")));
    assert.ok(urls.some((url) => url.endsWith("/poses/balasana.webp")));
  });

  it("keeps the app shell and does not list a pose twice", () => {
    const manifest = offlineManifestForSlugs(["tadasana", "tadasana"]);
    assert.equal(manifest.urls.filter((url) => url.endsWith("/poses/tadasana.webp")).length, 1);
    assert.ok(manifest.urls.some((url) => url.endsWith("/index.html")));
    assert.ok(manifest.urls.some((url) => url.endsWith("/manifest.webmanifest")));
  });
});
