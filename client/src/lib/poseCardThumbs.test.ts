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
    assert.doesNotMatch(card, /opacity-0/);
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

  it("lists how many poses the library shows (for the QA report)", () => {
    const poseFiles = readdirSync(resolve("client/public/poses")).filter((f) => f.endsWith(".webp"));
    assert.ok(poseFiles.length >= ASANAS.length);
    assert.equal(ASANAS.length, 207);
  });
});
