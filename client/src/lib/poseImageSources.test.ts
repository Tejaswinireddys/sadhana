/**
 * PoseImage must not request /poses/thumbs/<slug> unless the generator listed
 * that slug — otherwise Pathways / warm-up cards spam 404s for every row.
 * When thumbs are ready, grids prefer WebP thumbs over full-size masters.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POSE_THUMBS_READY_LIST } from "../data/poseThumbsReady.generated.ts";
import { resolvePoseImageSources } from "./poseImageSources.ts";
import { SAMPLE_PRACTICE } from "../data/samplePractice.ts";
import { ASANAS } from "../data/content.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("pose thumbnail source selection", () => {
  it("lists only thumbs that exist on disk as both PNG and WebP", () => {
    const missing = POSE_THUMBS_READY_LIST.filter(
      (slug) =>
        !existsSync(path.join(ROOT, `client/public/poses/thumbs/${slug}.png`)) ||
        !existsSync(path.join(ROOT, `client/public/poses/thumbs/${slug}.webp`)),
    );
    assert.deepEqual(missing, [], `ready list has missing thumbs: ${missing.join(", ")}`);
  });

  it("has generated thumbs for the full catalog so /asanas never ships full PNG", () => {
    assert.ok(
      POSE_THUMBS_READY_LIST.length >= ASANAS.length,
      `expected >= ${ASANAS.length} ready thumbs, got ${POSE_THUMBS_READY_LIST.length}`,
    );
  });

  it("prefers WebP thumbs when thumb=true and the slug is ready", () => {
    const ready = POSE_THUMBS_READY_LIST[0];
    assert.ok(ready, "POSE_THUMBS_READY_LIST must not be empty after gen-pose-thumbs");
    const resolved = resolvePoseImageSources(ready, { thumb: true, baseUrl: "/" });
    assert.equal(resolved.usesThumb, true);
    assert.equal(resolved.webpSrc, `/poses/thumbs/${ready}.webp`);
    assert.equal(resolved.src, `/poses/thumbs/${ready}.png`);
  });

  it("falls back to full-size assets when thumb is requested for an unknown slug", () => {
    const resolved = resolvePoseImageSources("not-a-real-pose-slug-xyz", {
      thumb: true,
      baseUrl: "/",
    });
    assert.equal(resolved.usesThumb, false);
    assert.match(resolved.src, /\/poses\/not-a-real-pose-slug-xyz\.png$/);
    assert.match(resolved.webpSrc, /\/poses\/not-a-real-pose-slug-xyz\.webp$/);
    assert.doesNotMatch(resolved.src, /\/poses\/thumbs\//);
  });

  it("uses thumbs for first-practice poses when they are ready", () => {
    for (const step of SAMPLE_PRACTICE.poses) {
      const resolved = resolvePoseImageSources(step.slug, { thumb: true, baseUrl: "/" });
      assert.equal(resolved.usesThumb, POSE_THUMBS_READY_LIST.includes(step.slug));
      if (resolved.usesThumb) {
        assert.equal(resolved.webpSrc, `/poses/thumbs/${step.slug}.webp`);
        assert.equal(resolved.src, `/poses/thumbs/${step.slug}.png`);
      } else {
        assert.match(resolved.src, new RegExp(`/poses/${step.slug}\\.png$`));
        assert.doesNotMatch(resolved.src, /\/poses\/thumbs\//);
        assert.doesNotMatch(resolved.webpSrc, /\/poses\/thumbs\//);
      }
    }
  });

  it("keeps full-size sources when thumb is false (pose detail hero)", () => {
    const slug = POSE_THUMBS_READY_LIST[0] ?? "tadasana";
    const resolved = resolvePoseImageSources(slug, { thumb: false, baseUrl: "/" });
    assert.equal(resolved.usesThumb, false);
    assert.equal(resolved.src, `/poses/${slug}.png`);
    assert.equal(resolved.webpSrc, `/poses/${slug}.webp`);
  });
});
