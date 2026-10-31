/**
 * Runtime images are WebP. The PNG masters stay in public/ for the content
 * pipelines and PoseImage's <picture> fallback, but a plain <img> pointed at
 * one costs a phone ~750KB (pose) to ~1.4MB (kids) instead of ~20–90KB.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASANAS } from "../data/content.ts";
import { KIDS_BREATH, KIDS_POSES } from "../data/kids.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PUBLIC = path.join(ROOT, "client/public");

/** Only PoseImage's <picture> fallback may name a PNG master. */
const PNG_ALLOWED = new Set(["client/src/lib/poseImageSources.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("WebP runtime images", () => {
  it("every catalog pose has a WebP illustration", () => {
    const missing = ASANAS.map((a) => a.slug).filter(
      (slug) => !existsSync(path.join(PUBLIC, "poses", `${slug}.webp`)),
    );
    assert.deepEqual(missing, []);
  });

  it("every kids pose, breath game and the hero has a WebP illustration", () => {
    const images = ["_hero", ...KIDS_POSES.map((p) => p.image), ...KIDS_BREATH.map((b) => b.image)];
    const missing = images.filter((image) => !existsSync(path.join(PUBLIC, "kids", `${image}.webp`)));
    assert.deepEqual(missing, []);
  });

  it("the product demo poster has a WebP version", () => {
    assert.ok(existsSync(path.join(PUBLIC, "images/product-overview-poster.webp")));
  });

  it("client code does not request pose, kids or poster PNGs directly", () => {
    const offenders = sourceFiles(path.join(ROOT, "client/src"))
      .map((file) => path.relative(ROOT, file))
      .filter((rel) => !PNG_ALLOWED.has(rel))
      .flatMap((rel) =>
        readFileSync(path.join(ROOT, rel), "utf-8")
          .split("\n")
          .map((line, i) => ({ line, at: `${rel}:${i + 1}` }))
          // Code, not comments: a template literal or string ending in .png under one of these folders.
          .filter(({ line }) => !/^\s*(\/\/|\*)/.test(line))
          .filter(({ line }) => /(poses|kids|images)\/[^"'`\s]*\.png["'`]/.test(line))
          .map(({ at }) => at),
      );
    assert.deepEqual(offenders, []);
  });
});
