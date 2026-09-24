/**
 * PoseImage must not request /poses/thumbs/<slug> unless the generator listed
 * that slug — otherwise Pathways / warm-up cards spam 404s for every row.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POSE_THUMBS_READY_LIST } from "../data/poseThumbsReady.generated.ts";
import { resolvePoseImageSources } from "./poseImageSources.ts";
import { SAMPLE_PRACTICE } from "../data/samplePractice.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("pose thumbnail source selection", () => {
  it("lists only thumbs that exist on disk", () => {
    const missing = POSE_THUMBS_READY_LIST.filter(
      (slug) => !existsSync(path.join(ROOT, `client/public/poses/thumbs/${slug}.png`)),
    );
    assert.deepEqual(missing, [], `ready list has missing thumbs: ${missing.join(", ")}`);
  });

  it("falls back to full-size assets for first-practice poses when no thumbs are ready", () => {
    for (const step of SAMPLE_PRACTICE.poses) {
      const resolved = resolvePoseImageSources(step.slug, { thumb: true, baseUrl: "/" });
      assert.equal(resolved.usesThumb, POSE_THUMBS_READY_LIST.includes(step.slug));
      if (!resolved.usesThumb) {
        assert.match(resolved.src, new RegExp(`/poses/${step.slug}\.png$`));
        assert.doesNotMatch(resolved.src, /\/poses\/thumbs\//);
        assert.doesNotMatch(resolved.webpSrc, /\/poses\/thumbs\//);
      }
    }
  });
});
