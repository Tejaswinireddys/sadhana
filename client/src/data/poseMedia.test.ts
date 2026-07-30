/**
 * Pose trainer demo media — allowlist + convention paths.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { poseHasVideo, poseMediaFor } from "./poseMedia.ts";
import { POSE_VIDEOS_READY_LIST } from "./poseVideosReady.generated.ts";

describe("pose trainer demo media", () => {
  it("keeps the generated clip inventory registered (for filmed overrides / future use)", () => {
    assert.ok(POSE_VIDEOS_READY_LIST.length > 50, "expected a full pose video inventory");
    assert.ok(poseHasVideo("tadasana"), "Mountain Pose should have a demo clip");
    assert.ok(poseHasVideo("vrksasana"), "Tree Pose should have a demo clip");
    assert.ok(poseHasVideo("adho-mukha-svanasana"), "Down Dog should have a demo clip");
  });

  it("resolves local convention paths (no invented CDN)", () => {
    const media = poseMediaFor("tadasana");
    assert.match(media.webm, /videos\/poses\/tadasana\.webm$/);
    assert.match(media.mp4, /videos\/poses\/tadasana\.mp4$/);
    assert.match(media.poster, /poses\/tadasana\.png$/);
    assert.equal(media.captions, undefined);
  });

  it("skips video for unknown slugs", () => {
    assert.equal(poseHasVideo("not-a-real-pose-slug-xyz"), false);
  });
});
