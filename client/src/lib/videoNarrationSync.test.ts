import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampVideoTime,
  shouldSeekVideo,
  videoTimeForNarration,
} from "./videoNarrationSync.ts";

describe("videoTimeForNarration", () => {
  it("maps the first spoken cue to the start of the clip", () => {
    const t = videoTimeForNarration({
      videoDuration: 10,
      stepIndex: 0,
      stepProgress: 0,
      stepCount: 5,
    });
    assert.equal(t, 0);
  });

  it("scrubs the cue's slice as the sentence is spoken", () => {
    const t = videoTimeForNarration({
      videoDuration: 10,
      stepIndex: 0,
      stepProgress: 0.5,
      stepCount: 5,
    });
    assert.equal(t, 1);
  });

  it("lands the last cue on the peak / end of the journey", () => {
    const t = videoTimeForNarration({
      videoDuration: 10,
      stepIndex: 4,
      stepProgress: 1,
      stepCount: 5,
    });
    assert.ok(t >= 9.5, `expected near end, got ${t}`);
  });

  it("keeps hold (last step, settled) on the final frame", () => {
    const t = videoTimeForNarration({
      videoDuration: 4,
      stepIndex: 3,
      stepProgress: 1,
      stepCount: 4,
    });
    assert.equal(t, clampVideoTime(4, 4));
  });

  it("falls back to proportional mapping without step windows", () => {
    const t = videoTimeForNarration({
      videoDuration: 8,
      narrationTime: 15,
      narrationDuration: 30,
    });
    assert.equal(t, 4);
  });

  it("returns 0 for missing / invalid duration", () => {
    assert.equal(videoTimeForNarration({ videoDuration: 0, stepCount: 3 }), 0);
    assert.equal(videoTimeForNarration({ videoDuration: NaN, stepCount: 3 }), 0);
  });
});

describe("shouldSeekVideo", () => {
  it("ignores tiny decoder drift", () => {
    assert.equal(shouldSeekVideo(1.02, 1.05), false);
  });

  it("seeks when the spoken cue has moved on", () => {
    assert.equal(shouldSeekVideo(0.2, 1.4), true);
  });
});
