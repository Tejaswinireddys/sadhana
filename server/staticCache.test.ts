import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { staticCacheControl } from "./static";

describe("staticCacheControl", () => {
  it("caches Vite's hashed build output for a year, immutably", () => {
    for (const file of ["assets/index-B3x9kQ.js", "assets/index-Cq1.css", "assets/raleway-a1b2.woff2"]) {
      assert.equal(staticCacheControl(file), "public, max-age=31536000, immutable", file);
    }
  });

  it("caches self-hosted fonts for a year without claiming immutability", () => {
    assert.equal(staticCacheControl("fonts/Raleway.woff2"), "public, max-age=31536000");
    assert.equal(staticCacheControl("Lora.ttf"), "public, max-age=31536000");
  });

  it("matches assets/ relative to the build root, not anywhere in the path", () => {
    assert.equal(staticCacheControl("poses/assets-like/tadasana.webp"), undefined);
    assert.equal(staticCacheControl("images/assets.png"), undefined);
  });

  it("leaves unhashed public files to revalidate, and never caches robots.txt", () => {
    assert.equal(staticCacheControl("poses/tadasana.webp"), undefined);
    assert.equal(staticCacheControl("sw.js"), undefined);
    assert.equal(staticCacheControl("manifest.webmanifest"), undefined);
    assert.equal(staticCacheControl("robots.txt"), "no-store");
  });
});
