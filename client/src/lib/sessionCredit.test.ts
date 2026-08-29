import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STREAK_HOLD_FLOOR_SECONDS,
  sessionCredit,
  sessionExitCopy,
  sessionHeadline,
} from "./sessionCredit";

describe("sessionCredit", () => {
  it("does not count skipping every pose in a few seconds", () => {
    const c = sessionCredit({
      holdSeconds: 0,
      elapsedSeconds: 4,
      posesCompleted: 0,
      posesSkipped: 4,
      posesTotal: 4,
    });
    assert.equal(c.counts, false);
    assert.equal(c.minutes, 0);
  });

  it("does not round a skip-through up to one minute", () => {
    const c = sessionCredit({
      holdSeconds: 3,
      elapsedSeconds: 8,
      posesCompleted: 0,
      posesSkipped: 4,
      posesTotal: 4,
    });
    assert.equal(c.counts, false);
    assert.equal(c.minutes, 0);
  });

  it("counts a partial session with real hold time", () => {
    const c = sessionCredit({
      holdSeconds: 15 * 60,
      elapsedSeconds: 15 * 60,
      posesCompleted: 12,
      posesSkipped: 0,
      posesTotal: 20,
    });
    assert.equal(c.counts, true);
    assert.equal(c.minutes, 15);
  });

  it("counts once hold time meets the floor even if most poses were skipped", () => {
    const c = sessionCredit({
      holdSeconds: STREAK_HOLD_FLOOR_SECONDS,
      elapsedSeconds: 75,
      posesCompleted: 1,
      posesSkipped: 3,
      posesTotal: 4,
    });
    assert.equal(c.counts, true);
    assert.equal(c.minutes, 1);
  });

  it("counts once half the poses were actually held", () => {
    const c = sessionCredit({
      holdSeconds: 40,
      elapsedSeconds: 50,
      posesCompleted: 2,
      posesSkipped: 2,
      posesTotal: 4,
    });
    assert.equal(c.counts, true);
    assert.equal(c.minutes, 1);
  });
});

describe("sessionHeadline", () => {
  it("celebrates a partial honestly", () => {
    assert.equal(
      sessionHeadline({ counts: true, minutes: 4, endedEarly: true }),
      "4 minutes in. That counts.",
    );
    assert.equal(
      sessionHeadline({ counts: true, minutes: 1, endedEarly: true }),
      "1 minute in. That counts.",
    );
  });

  it("keeps the full-session line when they finished the flow", () => {
    assert.equal(
      sessionHeadline({ counts: true, minutes: 7, endedEarly: false }),
      "Beautiful practice",
    );
  });

  it("does not congratulate a skip-through", () => {
    assert.equal(
      sessionHeadline({ counts: false, minutes: 0, endedEarly: false }),
      "Too brief to save",
    );
  });
});

describe("sessionExitCopy", () => {
  it("offers to save a real partial instead of throwing it away", () => {
    const copy = sessionExitCopy(
      sessionCredit({
        holdSeconds: 4 * 60,
        elapsedSeconds: 4 * 60,
        posesCompleted: 6,
        posesSkipped: 0,
        posesTotal: 10,
      }),
    );
    assert.match(copy.description, /4 minutes in\. That counts/);
    assert.equal(copy.leaveLabel, "Save and leave");
  });

  it("does not pretend a four-second skip will be logged", () => {
    const copy = sessionExitCopy(
      sessionCredit({
        holdSeconds: 0,
        elapsedSeconds: 4,
        posesCompleted: 0,
        posesSkipped: 0,
        posesTotal: 4,
      }),
    );
    assert.match(copy.description, /too brief to count/i);
    assert.equal(copy.leaveLabel, "Leave");
  });
});
