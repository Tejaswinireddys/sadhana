import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stepMomentum, momentumClass } from "./poseMomentum";

describe("stepMomentum — the figure moves with the narration", () => {
  it("walks Mountain's cues through grounding → lift → sway → rise", () => {
    assert.equal(stepMomentum({ text: "feet together, weight even across both feet" }), "ground");
    assert.equal(stepMomentum({ text: "Engage the thighs, lift the kneecaps gently" }), "lift");
    assert.equal(stepMomentum({ text: "Roll the shoulders back and down" }), "sway");
    assert.equal(stepMomentum({ text: "Crown of the head reaches upward" }), "rise");
  });

  it("prefers an authored stepMotion when present", () => {
    assert.equal(stepMomentum({ text: "anything", stepMotion: "torso-fold" }), "fold");
    assert.equal(stepMomentum({ text: "anything", stepMotion: "arm-extend" }), "extend");
    assert.equal(stepMomentum({ text: "anything", stepMotion: "twist" }), "sway");
  });

  it("falls back to a calm breath when nothing matches", () => {
    assert.equal(stepMomentum({ text: "hold here and be present" }), "breath");
    assert.equal(stepMomentum(null), "breath");
    assert.equal(stepMomentum({}), "breath");
  });

  it("emits a usable className", () => {
    assert.equal(momentumClass({ text: "Crown of the head reaches upward" }), "figure-momentum figure-momentum-rise");
    assert.equal(momentumClass(null), "figure-momentum figure-momentum-breath");
  });
});
