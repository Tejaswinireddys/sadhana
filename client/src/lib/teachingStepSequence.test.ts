/**
 * Teaching still → step sequence (not a fake movement demo).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { asanaBySlug } from "../data/content.ts";
import { teachingVisual } from "../data/aiTrainerLessons.ts";
import { hasMovementDemo } from "../data/poseDemoAvailability.ts";
import {
  resolveTeachingStepIndex,
  teachingStepFrames,
} from "./teachingStepSequence.ts";

describe("teachingStepFrames", () => {
  it("keeps every frame on this pose's illustration, including foreign entry keys", () => {
    const dog = asanaBySlug("adho-mukha-svanasana")!;
    const frames = teachingStepFrames(dog.slug, dog.pose, dog.steps);
    assert.equal(frames.length, dog.steps.length);
    assert.ok(dog.steps.some((s) => s.pose === "cat"), "fixture expects a foreign entry key");
    for (const frame of frames) {
      assert.equal(frame.imageSlug, "adho-mukha-svanasana");
    }
    assert.match(frames[0]!.text, /all fours/i);
  });

  it("carries focus zones and cues for Mountain", () => {
    const mountain = asanaBySlug("tadasana")!;
    const frames = teachingStepFrames(mountain.slug, mountain.pose, mountain.steps);
    assert.equal(frames.length, 4);
    assert.ok(frames.every((f) => f.imageSlug === "tadasana"));
    assert.ok(frames[0]!.focusZone?.label);
    assert.ok(frames[3]!.text.length > 10);
  });
});

describe("resolveTeachingStepIndex", () => {
  it("clamps the driven index while motion is allowed", () => {
    assert.equal(resolveTeachingStepIndex({ frameCount: 4, stepIndex: 2, reduceMotion: false }), 2);
    assert.equal(resolveTeachingStepIndex({ frameCount: 4, stepIndex: 99, reduceMotion: false }), 3);
    assert.equal(resolveTeachingStepIndex({ frameCount: 4, stepIndex: -1, reduceMotion: false }), 0);
  });

  it("finishes immediately on the last step when motion is reduced", () => {
    assert.equal(resolveTeachingStepIndex({ frameCount: 4, stepIndex: 0, reduceMotion: true }), 3);
    assert.equal(resolveTeachingStepIndex({ frameCount: 1, stepIndex: 0, reduceMotion: true }), 0);
  });
});

describe("teaching surfaces use the sequence for stills only", () => {
  it("Child's Pose is a still (no AI preview, no reviewed demo)", () => {
    assert.equal(hasMovementDemo("balasana"), false);
    assert.equal(teachingVisual("balasana", false), "still");
  });

  it("PoseTrainerStage mounts TeachingStepSequence for teaching stills", () => {
    const src = readFileSync(resolve("client/src/components/PoseTrainerStage.tsx"), "utf8");
    assert.match(src, /TeachingStepSequence/);
    assert.match(src, /isTeaching && visual === "still"/);
    assert.match(src, /AI_TRAINER_PRACTICE_VIDEO/);
    assert.doesNotMatch(src, /REVIEWED_MOVEMENT_DEMOS\[/);
  });

  it("TeachingStepSequence respects reduced motion and never invents video", () => {
    const src = readFileSync(resolve("client/src/components/TeachingStepSequence.tsx"), "utf8");
    assert.match(src, /prefersTeachingMotionOff/);
    assert.match(src, /resolveTeachingStepIndex/);
    assert.match(src, /data-teaching-sequence="steps"/);
    assert.doesNotMatch(src, /<video|object-cover|REVIEWED_MOVEMENT_DEMOS/);
  });
});
