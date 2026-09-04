import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateInstructionSeconds,
  guidedPhaseLabel,
  guidedPoseSeconds,
  guidedSessionSeconds,
  holdRemainingAfterInstruction,
  instructionCountdown,
  remainingFooterLabel,
} from "./guidedDuration.ts";

describe("guided duration", () => {
  it("estimates Mountain-length narration from step count", () => {
    assert.equal(estimateInstructionSeconds(8), 64);
    assert.equal(estimateInstructionSeconds(8, 62.47), 62);
  });

  it("keeps a 5-second hold after long narration", () => {
    assert.equal(holdRemainingAfterInstruction(5), 5);
    assert.equal(holdRemainingAfterInstruction(5, 2), 7);
  });

  it("counts instruction remaining from audio, not hold minus currentTime", () => {
    assert.equal(
      instructionCountdown({
        usingMp3: true,
        audioCurrentTime: 58,
        audioDuration: 62.47,
        phaseRemaining: 5,
      }),
      4,
    );
    assert.equal(
      instructionCountdown({
        usingMp3: true,
        audioCurrentTime: 70,
        audioDuration: 62,
        phaseRemaining: 5,
      }),
      0,
    );
  });

  it("builds an honest wall-clock for a 5-second custom Mountain pose", () => {
    const secs = guidedSessionSeconds([
      { holdSeconds: 5, stepCount: 8 },
    ]);
    assert.ok(secs >= 60, `expected ~1 min guided time, got ${secs}`);
    assert.equal(guidedPhaseLabel("instruction"), "How to");
    assert.equal(guidedPhaseLabel("hold"), "Hold");
  });

  it("does not show a stale minute when the clock is at zero", () => {
    assert.equal(remainingFooterLabel(0), "wrapping up");
    assert.equal(remainingFooterLabel(12), "12 sec left");
    assert.equal(remainingFooterLabel(90), "~2 min left");
  });

  it("counts both sides plus a switch for bilateral poses", () => {
    const once = guidedPoseSeconds({ holdSeconds: 30, instructionSeconds: 20 });
    const each = guidedPoseSeconds({
      holdSeconds: 30,
      sides: "each",
      instructionSeconds: 20,
    });
    assert.ok(each > once * 1.5);
  });
});
