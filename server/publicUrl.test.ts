import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { brandPublicHtml, publicAppOrigin, robotsTxt } from "./publicUrl";

describe("publicUrl branding", () => {
  it("rewrites hard-coded Render host when PUBLIC_APP_URL is custom", () => {
    const prev = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = "https://practice.sadhana.app/";
    try {
      assert.equal(publicAppOrigin(), "https://practice.sadhana.app");
      const html = brandPublicHtml(
        '<link rel="canonical" href="https://sadhana-ou9m.onrender.com/" />',
      );
      assert.equal(html, '<link rel="canonical" href="https://practice.sadhana.app/" />');
      assert.match(robotsTxt(), /Sitemap: https:\/\/practice\.sadhana\.app\/sitemap\.xml/);
    } finally {
      if (prev === undefined) delete process.env.PUBLIC_APP_URL;
      else process.env.PUBLIC_APP_URL = prev;
    }
  });
});
