import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatClock } from "./formatDuration";
import {
  guidedClockFrozen,
  tickGuidedClock,
  type GuidedClockSnapshot,
} from "./guidedClock";

function snap(remaining: number): GuidedClockSnapshot {
  return {
    phaseRemaining: remaining,
    elapsedTotal: 20,
    holdElapsed: 5,
    narrationTime: 3,
    audioCurrentTime: 3,
  };
}

describe("guidedClockFrozen", () => {
  it("freezes while the leave dialog is open even if Pause was not tapped", () => {
    assert.equal(guidedClockFrozen(false, true), true);
    assert.equal(guidedClockFrozen(true, true), true);
    assert.equal(guidedClockFrozen(true, false), true);
    assert.equal(guidedClockFrozen(false, false), false);
  });
});

describe("leave-dialog freeze", () => {
  it("keeps the countdown byte-identical after the dialog has been open for 10 seconds", () => {
    let clock = snap(11);
    const before = formatClock(clock.phaseRemaining);
    assert.equal(before, "0:11");
    const frozen = guidedClockFrozen(false, true);
    for (let i = 0; i < 10; i++) {
      clock = tickGuidedClock(clock, frozen);
    }
    assert.equal(formatClock(clock.phaseRemaining), before);
    assert.equal(clock.phaseRemaining, 11);
    assert.equal(clock.elapsedTotal, 20);
    assert.equal(clock.holdElapsed, 5);
    assert.equal(clock.narrationTime, 3);
    assert.equal(clock.audioCurrentTime, 3);
  });

  it("Stay resumes from the exact paused remaining, not the pose start", () => {
    let clock = snap(11);
    clock = tickGuidedClock(clock, guidedClockFrozen(false, false));
    assert.equal(clock.phaseRemaining, 10);
    const pausedAt = clock;
    const dialogOpen = guidedClockFrozen(false, true);
    for (let i = 0; i < 10; i++) {
      clock = tickGuidedClock(clock, dialogOpen);
    }
    assert.equal(clock, pausedAt);
    // Stay: dialog closes, session was not Pause'd.
    clock = tickGuidedClock(clock, guidedClockFrozen(false, false));
    assert.equal(clock.phaseRemaining, 9);
    assert.notEqual(clock.phaseRemaining, 11);
  });
});

describe("GuidedSession wiring", () => {
  it("freezes the master tick, narration, and pose video while the leave dialog is open", () => {
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(src, /guidedClockFrozen\(paused,\s*confirmExit\)/);
    assert.match(src, /if \(!started \|\| clockFrozen \|\| finished\) return/);
    assert.match(src, /if \(clockFrozen\) \{/);
    assert.match(src, /speechPlayerRef\.current\?\.setPaused\(clockFrozen\)/);
    assert.match(src, /live && !clockFrozen && \(phase === "instruction" \|\| phase === "hold"\)/);
  });
});
