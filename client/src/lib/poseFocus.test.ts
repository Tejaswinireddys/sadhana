import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { focusFromText, resolveStepFocus } from "./poseFocus";

describe("focusFromText — narration drives the look-here region", () => {
  it("sends Mountain's cues down and up the body", () => {
    // Mountain Pose holds one shape, so the figure can't change posture — but the
    // focus must still travel to the part being named on each step.
    assert.equal(
      focusFromText("feet together or hip-width apart, weight even across both feet")?.label,
      "Feet & toes",
    );
    assert.equal(focusFromText("Engage the thighs, lift the kneecaps gently")?.label, "Legs & thighs");
    assert.equal(focusFromText("Roll the shoulders back and down, arms relaxed")?.label, "Shoulders");
    assert.equal(focusFromText("Crown of the head reaches upward; soften the face")?.label, "Crown & head");
  });

  it("picks the earliest body part named in the sentence", () => {
    assert.equal(focusFromText("shoulders back, arms down, palms forward")?.label, "Shoulders");
  });

  it("returns null when no body part is named", () => {
    assert.equal(focusFromText("breathe steadily and stay present"), null);
    assert.equal(focusFromText(""), null);
    assert.equal(focusFromText(undefined), null);
  });

  it("prefers an explicit focusZone over inferred text", () => {
    const authored = { cx: 0.1, cy: 0.2, r: 0.3, label: "Authored" };
    assert.deepEqual(resolveStepFocus({ text: "feet", focusZone: authored }), authored);
    assert.equal(resolveStepFocus({ text: "roll the shoulders back" })?.label, "Shoulders");
    assert.equal(resolveStepFocus(null), null);
  });
});
