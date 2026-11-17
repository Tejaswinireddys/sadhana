import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("reduced motion and guided captions", () => {
  it("stops decorative motion for the system preference and the in-app toggle", () => {
    const css = readFileSync(resolve("client/src/index.css"), "utf8");
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /html\.motion-off \*/);
    assert.match(css, /animation-duration: 0\.01ms !important/);
    assert.match(css, /scroll-behavior: auto !important/);
  });

  it("shows guided captions by default and keeps them out of the live region", () => {
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(src, /useState\(true\)/);
    assert.match(src, /id="guided-caption"/);
    assert.match(src, /aria-controls="guided-caption"/);
    const caption = src.slice(src.indexOf('id="guided-caption"'));
    const captionBlock = caption.slice(0, caption.indexOf("</p>") + 4);
    assert.equal(/aria-live/.test(captionBlock), false);
  });
});
