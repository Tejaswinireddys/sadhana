import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPoseMoment,
  cameraForMoment,
  phaseFromStepIndex,
  resolvePosePhase,
} from "./poseMoments.ts";

describe("poseMoments", () => {
  it("maps early steps to enter and late steps to cue", () => {
    assert.equal(phaseFromStepIndex(0, 4), "enter");
    assert.equal(phaseFromStepIndex(3, 4), "cue");
  });

  it("prefers stepMotion phase over index", () => {
    assert.equal(resolvePosePhase("twist", 0, 4), "cue");
    assert.equal(resolvePosePhase("ground", 3, 4), "enter");
  });

  it("aims the camera toward the focus zone", () => {
    const feet = cameraForMoment({ cx: 0.5, cy: 0.85, r: 0.16, label: "Feet" }, "align");
    const crown = cameraForMoment({ cx: 0.5, cy: 0.12, r: 0.16, label: "Crown" }, "cue");
    assert.ok(feet.rotateX > crown.rotateX);
    assert.ok(crown.translateY > feet.translateY);
  });

  it("mirrors yaw for side 2", () => {
    const focus = { cx: 0.3, cy: 0.5, r: 0.2, label: "Side" };
    const a = cameraForMoment(focus, "align", 1);
    const b = cameraForMoment(focus, "align", 2);
    assert.equal(Math.sign(a.rotateY), -Math.sign(b.rotateY) || 0);
    assert.ok(Math.abs(a.rotateY + b.rotateY) < 0.01 || a.rotateY === -b.rotateY);
  });

  it("builds a complete moment for a pose step", () => {
    const m = buildPoseMoment({
      poseKey: "tree",
      focusZone: { cx: 0.5, cy: 0.18, r: 0.2, label: "Arms" },
      stepMotion: "arm-extend",
      stepIndex: 3,
      stepCount: 5,
      side: 1,
    });
    assert.equal(m.poseKey, "tree");
    assert.equal(m.phase, "align");
    assert.equal(m.focusZone?.label, "Arms");
    assert.ok(m.camera.scale >= 0.86);
  });
});
