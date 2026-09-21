/**
 * What the practitioner is shown while being taught a pose.
 *
 * The defect: the first instruction of "I'm tired" — Supported Child's Pose —
 * displayed someone sitting cross-legged in meditation. The generated clip for
 * a Restorative pose opens on sukhasana, and the guided player was playing
 * those clips as instruction.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { asanaBySlug } from "../data/content.ts";
import {
  blendedForeignShapes,
  hasMovementDemo,
  poseDemoAvailability,
  STATIC_REFERENCE_LABEL,
} from "../data/poseDemoAvailability.ts";
import { QUICK_SESSIONS } from "../data/quickSessions.ts";

describe("generated clips are not demonstrations", () => {
  it("names the foreign body the Supported Child's Pose clip would show", () => {
    const foreign = blendedForeignShapes(asanaBySlug("salamba-balasana")!);
    assert.deepEqual(foreign, ["sukhasana"]);
  });

  it("refuses to call any of them a movement demo", () => {
    for (const q of QUICK_SESSIONS) {
      for (const p of q.poses) {
        assert.equal(
          hasMovementDemo(p.slug),
          false,
          `${p.slug} claims a reviewed movement demo that does not exist`,
        );
        assert.equal(poseDemoAvailability(p.slug).kind, "static_reference", p.slug);
      }
    }
  });
});

describe("the teaching stage enforces that", () => {
  const src = readFileSync(resolve("client/src/components/PoseTrainerStage.tsx"), "utf8");

  it("only plays a clip when it is a reviewed movement demonstration", () => {
    assert.match(src, /poseDemoAvailability\(slug\)\.kind === "movement"/);
    assert.match(src, /clipAllowed = Boolean\(media\) && \(!isTeaching \|\| demoIsReviewedMovement\)/);
    assert.match(src, /wantPresentation = clipAllowed/);
    assert.match(src, /wantSyncedHowTo = clipAllowed/);
  });

  it("treats the guided player as a teaching surface", () => {
    assert.match(src, /isTeaching = teaching \|\| variant === "practice"/);
    const player = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(player, /variant="practice"/);
  });

  it("will not swap another pose's illustration into a step cue", () => {
    assert.match(src, /humanStepSlug\(slug, poseKey, stepPoseKey\) !== slug/);
    assert.match(src, /isTeaching && stepPoseIsForeign \? poseKey : stepPoseKey/);
  });

  it("labels the still it falls back to", () => {
    assert.match(src, /referenceNote=\{isTeaching && !demoIsReviewedMovement/);
    assert.equal(
      STATIC_REFERENCE_LABEL,
      "Static reference — movement demonstration unavailable",
    );
  });
});
