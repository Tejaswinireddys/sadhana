import test from "node:test";
import assert from "node:assert/strict";
import { POSE_KEYFRAMES, hasRigSequence } from "./poseKeyframes.ts";
import { ASANAS } from "./content.ts";
import { SKELETON, lerpPose, mirrorPose, normalizePose } from "../lib/poseRig.ts";

const asanaBySlug = new Map(ASANAS.map((a) => [a.slug, a]));

test("every rigged pose exists in the catalog", () => {
  for (const slug of Object.keys(POSE_KEYFRAMES)) {
    assert.ok(asanaBySlug.has(slug), `${slug} has keyframes but no asana`);
  }
});

test("keyframe count matches the narration step count", () => {
  // If content.ts gains or loses a step, the figure would freeze on the wrong
  // shape for the tail of the narration. Catch it here instead.
  for (const [slug, seq] of Object.entries(POSE_KEYFRAMES)) {
    const asana = asanaBySlug.get(slug)!;
    assert.equal(
      seq.frames.length,
      asana.steps.length,
      `${slug}: ${seq.frames.length} keyframes vs ${asana.steps.length} narration steps`,
    );
  }
});

test("focus track, when present, has one entry per step", () => {
  for (const [slug, seq] of Object.entries(POSE_KEYFRAMES)) {
    if (!seq.focus) continue;
    assert.equal(seq.focus.length, seq.frames.length, `${slug} focus length`);
  }
});

test("no keyframe puts the pelvis below the floor", () => {
  for (const [slug, seq] of Object.entries(POSE_KEYFRAMES)) {
    seq.frames.forEach((f, i) => {
      assert.ok(f.root.position[1] >= 0, `${slug} frame ${i} root y = ${f.root.position[1]}`);
    });
  }
});

test("every joint angle is a finite number in a sane range", () => {
  for (const [slug, seq] of Object.entries(POSE_KEYFRAMES)) {
    seq.frames.forEach((f, i) => {
      for (const [joint, angles] of Object.entries(f.joints)) {
        assert.ok(Array.isArray(angles) && angles.length === 3, `${slug}/${i}/${joint} shape`);
        for (const a of angles) {
          assert.ok(Number.isFinite(a), `${slug}/${i}/${joint} not finite`);
          assert.ok(Math.abs(a) <= 360, `${slug}/${i}/${joint} = ${a} out of range`);
        }
      }
    });
  }
});

test("normalizePose fills in every skeleton joint", () => {
  const pose = normalizePose(POSE_KEYFRAMES.tadasana.frames[0]);
  for (const bone of SKELETON) {
    assert.ok(pose.joints[bone.name], `missing ${bone.name}`);
  }
});

test("lerpPose returns endpoints exactly at t=0 and t=1", () => {
  const seq = POSE_KEYFRAMES["virabhadrasana-ii"];
  const a = normalizePose(seq.frames[0]);
  const b = normalizePose(seq.frames[2]);
  const at0 = lerpPose(seq.frames[0], seq.frames[2], 0);
  const at1 = lerpPose(seq.frames[0], seq.frames[2], 1);
  for (const bone of SKELETON) {
    at0.joints[bone.name].forEach((v, i) =>
      assert.ok(Math.abs(v - a.joints[bone.name][i]) < 1e-9, `t=0 ${bone.name}`),
    );
    at1.joints[bone.name].forEach((v, i) =>
      assert.ok(Math.abs(v - b.joints[bone.name][i]) < 1e-9, `t=1 ${bone.name}`),
    );
  }
});

test("lerpPose takes the short way around the circle", () => {
  // 170 → -170 is a 20° trip, not 340°. Down Dog's 172° shoulder makes this
  // reachable in practice, and the long way looks like the arm spinning.
  const from = { root: { position: [0, 1, 0], rotation: [0, 0, 0] }, joints: { spine: [170, 0, 0] } };
  const to = { root: { position: [0, 1, 0], rotation: [0, 0, 0] }, joints: { spine: [-170, 0, 0] } };
  const mid = lerpPose(from as never, to as never, 0.5);
  assert.ok(Math.abs(Math.abs(mid.joints.spine[0]) - 180) < 1e-6, `got ${mid.joints.spine[0]}`);
});

test("mirrorPose swaps sides and is its own inverse", () => {
  const original = normalizePose(POSE_KEYFRAMES["virabhadrasana-ii"].frames[2]);
  const twice = normalizePose(mirrorPose(mirrorPose(original)));
  for (const bone of SKELETON) {
    twice.joints[bone.name].forEach((v, i) =>
      assert.ok(Math.abs(v - original.joints[bone.name][i]) < 1e-9, `${bone.name}[${i}]`),
    );
  }
  const mirrored = normalizePose(mirrorPose(original));
  assert.deepEqual(mirrored.joints.shoulderL, original.joints.shoulderR.map((v, i) => (i === 0 ? v : -v)));
});

test("hasRigSequence only claims poses we actually authored", () => {
  assert.equal(hasRigSequence("tadasana"), true);
  assert.equal(hasRigSequence("definitely-not-a-pose"), false);
  assert.equal(hasRigSequence("constructor"), false);
});
