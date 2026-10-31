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
    assert.equal(staticCacheControl("poses/assets-like/tadasana.webp"), "public, max-age=86400");
    assert.equal(staticCacheControl("images/assets.png"), "public, max-age=86400");
  });

  it("caches unhashed public images for a day, not a year", () => {
    for (const file of ["poses/tadasana.webp", "kids/_hero.webp", "og-image.png", "favicon.svg"]) {
      assert.equal(staticCacheControl(file), "public, max-age=86400", file);
    }
  });

  it("never caches the service worker or robots.txt, and leaves other files to revalidate", () => {
    assert.equal(staticCacheControl("sw.js"), "no-store");
    assert.equal(staticCacheControl("robots.txt"), "no-store");
    assert.equal(staticCacheControl("manifest.webmanifest"), undefined);
  });
});
