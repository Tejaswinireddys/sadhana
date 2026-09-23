import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASANAS, asanaBySlug } from "./content.ts";
import { POSE_IMAGE_ALT } from "./poseImageAlts.ts";
import {
  POSE_IMAGE_MISMATCHES,
  accurateImageAlt,
  missingIllustrationManifest,
  poseImageCaveat,
  poseImageIsAccurate,
} from "./poseImageAccuracy.ts";

/**
 * The reported defect: Supported Child's Pose showed an unsupported forward
 * fold while its instructions describe a torso resting on a bolster.
 */
describe("illustrations that disagree with their instructions", () => {
  it("names the two found in the September 23 review", () => {
    assert.deepEqual(Object.keys(POSE_IMAGE_MISMATCHES).sort(), [
      "chair-viparita-karani",
      "salamba-balasana",
    ]);
  });

  it("every listed slug is a real pose", () => {
    for (const slug of Object.keys(POSE_IMAGE_MISMATCHES)) {
      assert.ok(asanaBySlug(slug), `${slug} is not in the catalog`);
    }
  });

  it("says what is drawn and what was asked for, and they differ", () => {
    for (const m of Object.values(POSE_IMAGE_MISMATCHES)) {
      assert.ok(m.depicts.length > 30, `${m.slug} has no description of the image`);
      assert.ok(m.instructed.length > 30, `${m.slug} has no description of the instruction`);
      assert.notEqual(m.depicts, m.instructed);
      assert.ok(m.neededAsset.startsWith("pose-illustration/"), m.neededAsset);
    }
  });

  it("alt text describes the image, not the instruction", () => {
    // The stored alt for Supported Child's Pose promises a bolster and a
    // supported forehead. The picture has neither, so a screen-reader user was
    // told something more accurate than the image — and could not tell.
    const stored = POSE_IMAGE_ALT["salamba-balasana"]!;
    assert.match(stored, /bolster/);
    const shown = accurateImageAlt("salamba-balasana", stored);
    assert.notEqual(shown, stored);
    assert.match(shown, /cushion/);
    // Unflagged poses keep their reviewed alt untouched.
    const savasana = POSE_IMAGE_ALT["savasana"]!;
    assert.equal(accurateImageAlt("savasana", savasana), savasana);
  });

  it("gives the practitioner the difference, not a shrug", () => {
    const caveat = poseImageCaveat("salamba-balasana")!;
    assert.match(caveat, /not the full-length bolster/i);
    assert.match(caveat, /Follow the steps/i);
    assert.equal(poseImageCaveat("savasana"), null);
  });

  it("treats every other pose as reviewed and accurate", () => {
    const flagged = ASANAS.filter((a) => !poseImageIsAccurate(a.slug));
    assert.equal(flagged.length, 2);
    assert.equal(poseImageIsAccurate("salamba-matsyasana"), true);
  });

  it("reports the assets that would fix it", () => {
    const manifest = missingIllustrationManifest();
    assert.equal(manifest.length, 2);
    for (const entry of manifest) {
      assert.match(entry.whyCurrentAssetFails, /Current illustration shows:/);
      assert.ok(entry.need.length > 30);
    }
  });

  it("is surfaced before the practice and while teaching", () => {
    const preflight = readFileSync(
      resolve("client/src/components/SessionPreflightCard.tsx"),
      "utf8",
    );
    assert.match(preflight, /data-testid="preflight-image-caveats"/);
    const stage = readFileSync(resolve("client/src/components/PoseTrainerStage.tsx"), "utf8");
    assert.match(stage, /poseImageCaveat\(slug\)/);
    const image = readFileSync(resolve("client/src/components/PoseImage.tsx"), "utf8");
    assert.match(image, /accurateImageAlt\(/);
  });
});
