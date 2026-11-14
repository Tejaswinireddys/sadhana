import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { ASANAS } from "../data/content.ts";

describe("pose library card thumbnails", () => {
  const card = readFileSync(resolve("client/src/components/PoseCardVideo.tsx"), "utf8");

  it("always paints PoseImage as the card base (never a blank cream poster)", () => {
    assert.match(card, /PoseImage/);
    assert.match(card, /data-media=\{showVideo \? "video" : "illustration"\}/);
    assert.doesNotMatch(card, /posterReady/);
    assert.doesNotMatch(card, /pose-card-placeholder/);
    assert.doesNotMatch(card, /opacity-0/);
  });

  it("ships a PNG and WebP for every catalog pose so cards never 404", () => {
    const missing: string[] = [];
    for (const asana of ASANAS) {
      const png = resolve(`client/public/poses/${asana.slug}.png`);
      const webp = resolve(`client/public/poses/${asana.slug}.webp`);
      if (!existsSync(png) || !existsSync(webp)) missing.push(asana.slug);
    }
    assert.deepEqual(missing, [], `missing pose illustrations: ${missing.join(", ")}`);
  });

  it("lists how many poses the library shows (for the QA report)", () => {
    const poseFiles = readdirSync(resolve("client/public/poses")).filter((f) => f.endsWith(".webp"));
    assert.ok(poseFiles.length >= ASANAS.length);
    assert.equal(ASANAS.length, 207);
  });
});
