import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { ASANAS } from "../data/content.ts";
import { POSE_THUMBS_READY_LIST } from "../data/poseThumbsReady.generated.ts";

describe("pose library card thumbnails", () => {
  const card = readFileSync(resolve("client/src/components/PoseCardVideo.tsx"), "utf8");
  const poseImage = readFileSync(resolve("client/src/components/PoseImage.tsx"), "utf8");
  const marketing = readFileSync(resolve("client/src/components/MarketingPoseImage.tsx"), "utf8");

  it("always paints PoseImage as the card base (never a blank cream poster)", () => {
    assert.match(card, /PoseImage/);
    assert.match(card, /data-media=\{showVideo \? "video" : "illustration"\}/);
    assert.doesNotMatch(card, /posterReady/);
    assert.doesNotMatch(card, /pose-card-placeholder/);
    // The still stays painted. Only the hover video is hidden until a frame
    // exists — an empty poster used to cover Downward-Facing Dog in gray.
    assert.doesNotMatch(card, /poster=\{/);
    assert.match(card, /onLoadedData=\{\(\) => setVideoReady\(true\)\}/);
    assert.match(card, /videoReady \? "opacity-100" : "opacity-0"/);
  });

  it("passes thumb so cards resolve via resolvePoseImageSources", () => {
    assert.match(card, /\bthumb\b/);
    assert.match(poseImage, /resolvePoseImageSources/);
    assert.match(marketing, /resolvePoseImageSources/);
    assert.match(marketing, /\bthumb\b/);
  });

  it("lazy-loads off-screen images and decodes async (priority stays eager)", () => {
    assert.match(poseImage, /loading=\{eager \? "eager" : "lazy"\}/);
    assert.match(poseImage, /decoding="async"/);
    assert.match(poseImage, /const eager = priority;/);
    assert.doesNotMatch(poseImage, /const eager = priority \|\| thumb/);
    // Marketing thumbs are above-the-fold on /welcome; non-priority stills stay lazy+async.
    assert.match(marketing, /decoding=\{priority \|\| thumb \? "sync" : "async"\}/);
    assert.match(marketing, /loading=\{priority \|\| thumb \? "eager" : "lazy"\}/);
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

  it("ships pre-scaled PNG+WebP thumbs for every ready catalog pose", () => {
    const missing: string[] = [];
    for (const slug of POSE_THUMBS_READY_LIST) {
      const png = resolve(`client/public/poses/thumbs/${slug}.png`);
      const webp = resolve(`client/public/poses/thumbs/${slug}.webp`);
      if (!existsSync(png) || !existsSync(webp)) missing.push(slug);
    }
    assert.deepEqual(missing, [], `missing pose thumbs: ${missing.join(", ")}`);
    assert.ok(POSE_THUMBS_READY_LIST.length >= ASANAS.length);
  });

  it("insets figures and lays Corpse Pose down in the square thumb", async () => {
    const sharp = (await import("sharp")).default;
    async function box(slug: string) {
      const { data, info } = await sharp(resolve(`client/public/poses/thumbs/${slug}.webp`))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { width, height, channels } = info;
      let minx = width;
      let miny = height;
      let maxx = -1;
      let maxy = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * channels;
          if (data[i + 3] < 32) continue;
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const mx = Math.max(r, g, b);
          const mn = Math.min(r, g, b);
          if (mx > 215 && mx - mn < 28) continue;
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
        }
      }
      return { minx, miny, maxx, maxy, width, height };
    }
    const mountain = await box("tadasana");
    const lion = await box("simhasana");
    const warrior = await box("virabhadrasana-ii");
    const corpse = await box("savasana");
    for (const [name, frame] of [
      ["Mountain", mountain],
      ["Lion", lion],
    ] as const) {
      assert.ok(frame.miny >= 12, `${name} head is cropped (top ${frame.miny})`);
      assert.ok(frame.height - 1 - frame.maxy >= 12, `${name} feet are cropped`);
    }
    assert.ok(warrior.minx >= 12, `Warrior II left arm is clipped (${warrior.minx})`);
    assert.ok(warrior.width - 1 - warrior.maxx >= 12, "Warrior II right arm is clipped");
    const lying = corpse.maxx - corpse.minx;
    const standing = corpse.maxy - corpse.miny;
    assert.ok(lying > standing, `Corpse Pose thumb still reads as standing (${lying}x${standing})`);
  });

  it("lists how many poses the library shows (for the QA report)", () => {
    const poseFiles = readdirSync(resolve("client/public/poses")).filter((f) => f.endsWith(".webp"));
    assert.ok(poseFiles.length >= ASANAS.length);
    assert.equal(ASANAS.length, 207);
  });
});
