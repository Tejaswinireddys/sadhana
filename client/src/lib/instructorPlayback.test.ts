import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceClock,
  clampToSession,
  pauseClock,
  resumeClock,
  seekClock,
  seekToSegment,
  type InstructorClockState,
} from "./instructorClock";
import { buildSessionTimeline, segmentAtTime } from "./instructorTimeline";
import { instructorPoseBySlug } from "@/data/instructorPilot";
import type { StageMediaState } from "@/components/InstructorStage";

const playing: InstructorClockState = { timeSec: 0, playing: true, rate: 1 };

/**
 * The player stalls the session clock while the demonstration is loading or
 * buffering. This mirrors the `stalled` gate in InstructorSession so the rule
 * is testable without a DOM.
 */
function stalledFor(state: StageMediaState, graceExpired = false): boolean {
  return (state === "buffering" || state === "loading") && !graceExpired;
}

describe("shared clock — pause and resume", () => {
  it("does not advance while paused", () => {
    const paused = pauseClock({ ...playing, timeSec: 30 });
    assert.equal(advanceClock(paused, 5).timeSec, 30);
  });

  it("resumes from where it stopped, not from where wall-clock went", () => {
    const paused = pauseClock({ ...playing, timeSec: 30 });
    // Ten seconds of real time pass while paused.
    const stillPaused = advanceClock(paused, 10);
    const resumed = resumeClock(stillPaused);
    assert.equal(resumed.timeSec, 30);
    assert.equal(Math.round(advanceClock(resumed, 2).timeSec), 32);
  });

  it("honours the mode's playback rate", () => {
    const slow = advanceClock({ timeSec: 0, playing: true, rate: 0.9 }, 10);
    assert.equal(Math.round(slow.timeSec), 9);
  });

  it("never runs backwards or off the end", () => {
    assert.equal(seekClock(playing, -50).timeSec, 0);
    assert.equal(clampToSession(999, 120), 120);
    assert.equal(clampToSession(-5, 120), 0);
  });
});

describe("buffering keeps the timeline together", () => {
  it("stalls the clock while the demonstration is not ready", () => {
    for (const state of ["loading", "buffering"] as const) {
      assert.equal(stalledFor(state), true, `${state} did not stall the session`);
    }
  });

  it("runs while the demonstration is ready, or when there is none to wait for", () => {
    // An unavailable demonstration must not freeze the practice — the text
    // cues still teach, and the timer has to keep running.
    for (const state of ["ready", "idle", "error"] as const) {
      assert.equal(stalledFor(state), false, `${state} wrongly stalled the session`);
    }
  });

  it("gives up waiting rather than freezing the practice forever", () => {
    // A clip that never reports ready must not hold the timer hostage — the
    // text cues still teach, so the session continues without it.
    assert.equal(stalledFor("buffering", true), false);
    assert.equal(stalledFor("loading", true), false);
  });

  it("a stall loses no session time", () => {
    const at = { ...playing, timeSec: 42 };
    // While stalled the player simply does not call advanceClock.
    const afterStall = stalledFor("buffering") ? at : advanceClock(at, 5);
    assert.equal(afterStall.timeSec, 42);
    assert.equal(Math.round(advanceClock(afterStall, 3).timeSec), 45);
  });
});

describe("repeat and skip", () => {
  const timeline = buildSessionTimeline({
    poses: [
      instructorPoseBySlug("tadasana")!,
      instructorPoseBySlug("virabhadrasana-ii")!,
      instructorPoseBySlug("balasana")!,
    ],
    mode: "learn",
    level: "beginner",
  });

  it("repeat returns to the start of the current instruction", () => {
    const hold = timeline.flat.find((s) => s.phase === "hold")!;
    const midway = hold.absStartSec + hold.durationSec / 2;
    const repeated = seekClock(playing, segmentAtTime(timeline.flat, midway)!.absStartSec);
    assert.equal(repeated.timeSec, hold.absStartSec);
    assert.equal(segmentAtTime(timeline.flat, repeated.timeSec)!.id, hold.id);
  });

  it("next and previous land on a pose boundary, not mid-cue", () => {
    for (let i = 0; i < 3; i++) {
      const first = timeline.flat.find((s) => s.poseIndex === i)!;
      assert.equal(first.phase, "preparation", `pose ${i} does not start by preparing`);
      const landed = segmentAtTime(timeline.flat, first.absStartSec)!;
      assert.equal(landed.id, first.id);
      assert.equal(landed.poseIndex, i);
    }
  });

  it("skipping forward does not rewind the session", () => {
    const second = timeline.flat.find((s) => s.poseIndex === 1)!;
    const moved = seekToSegment(playing, second.absStartSec, true);
    assert.ok(moved.timeSec > 0);
    assert.equal(moved.playing, true);
    assert.equal(segmentAtTime(timeline.flat, moved.timeSec)!.poseIndex, 1);
  });

  it("resolves a time past the end to the final segment rather than crashing", () => {
    const past = segmentAtTime(timeline.flat, timeline.totalSec + 500);
    assert.ok(past);
    assert.equal(past!.index, timeline.flat.length - 1);
  });
});
