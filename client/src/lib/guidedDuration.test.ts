import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asanaBySlug } from "../data/content.ts";
import { narrationSecondsFor } from "../data/narrationDurations.ts";
import { sessionSeconds, sessionTimeLabel, TRANSITION_SECONDS } from "../data/quickSessions.ts";
import {
  estimateInstructionSeconds,
  guidedPhaseLabel,
  guidedPoseSeconds,
  guidedSessionSeconds,
  guidedTimeLabel,
  holdRemainingAfterInstruction,
  instructionCountdown,
  remainingFooterLabel,
  remainingFromPhases,
  resolveInstructionSeconds,
} from "./guidedDuration.ts";

describe("guided duration", () => {
  it("estimates Mountain-length narration from step count when no recording exists", () => {
    assert.equal(estimateInstructionSeconds(8), 64);
    assert.equal(estimateInstructionSeconds(8, 62.47), 62);
  });

  it("uses the recorded Mountain MP3 length for preview and playback", () => {
    const recorded = narrationSecondsFor("tadasana");
    assert.ok(recorded > 60, `expected recorded Mountain narration, got ${recorded}`);
    const poses = [{ holdSeconds: 5, slug: "tadasana", stepCount: 4 }];
    const preview = guidedSessionSeconds(poses);
    assert.equal(preview, TRANSITION_SECONDS + Math.round(recorded) + 5);
    assert.equal(sessionSeconds(poses), preview);
    assert.equal(sessionTimeLabel(poses), guidedTimeLabel(preview));
    const atGetReady = remainingFromPhases({
      poses,
      index: 0,
      phase: "transitionIn",
      instructionLeft: Math.round(recorded),
      phaseRemaining: TRANSITION_SECONDS,
    });
    assert.equal(atGetReady, preview);
  });

  it("matches Thunderbolt Practice-now preview with the live Get-ready footer", () => {
    const asana = asanaBySlug("vajrasana");
    assert.ok(asana);
    const hold = asana.variations.beginner.holdSeconds;
    const poses = [{ holdSeconds: hold, slug: "vajrasana", stepCount: asana.steps.length }];
    const preview = sessionSeconds(poses);
    const remaining = remainingFromPhases({
      poses,
      index: 0,
      phase: "transitionIn",
      instructionLeft: resolveInstructionSeconds(poses[0]!),
      phaseRemaining: TRANSITION_SECONDS,
    });
    assert.equal(remaining, preview);
    assert.equal(guidedTimeLabel(preview), sessionTimeLabel(poses));
    assert.ok(preview >= 90, `expected ~2 min guided time, got ${preview}`);
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
      { holdSeconds: 5, slug: "tadasana", stepCount: 4 },
    ]);
    assert.ok(secs >= 60, `expected ~1 min guided time, got ${secs}`);
    assert.equal(guidedPhaseLabel("instruction"), "How to");
    assert.equal(guidedPhaseLabel("hold"), "Hold");
  });

  it("does not show a stale minute when the clock is at zero", () => {
    assert.equal(remainingFooterLabel(0), "wrapping up");
    assert.equal(remainingFooterLabel(12), "12 sec left");
    assert.equal(remainingFooterLabel(42), "42 sec left");
    assert.equal(remainingFooterLabel(90), "~2 min left");
  });

  it("keeps footer remaining aligned with a long How-to countdown", () => {
    const left = remainingFromPhases({
      poses: [{ holdSeconds: 5, stepCount: 8, instructionSeconds: 62 }],
      index: 0,
      phase: "instruction",
      instructionLeft: 53,
      phaseRemaining: 5,
    });
    assert.equal(left, 58);
    assert.equal(remainingFooterLabel(left), "58 sec left");
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
