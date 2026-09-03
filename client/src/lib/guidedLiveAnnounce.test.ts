/**
 * Guided-player screen-reader announcements: pose + cue on change, last 10s
 * of a hold once, session lifecycle copy. Wiring into GuidedSession is
 * source-checked so captions-off cannot hide the live region.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GUIDED_SR,
  cueTextForGuidedPhase,
  poseAndCueAnnouncement,
  shouldAnnounceHoldEndingOnce,
  withSessionStarted,
} from "./guidedLiveAnnounce";

describe("poseAndCueAnnouncement", () => {
  it("joins pose name and cue", () => {
    assert.equal(
      poseAndCueAnnouncement("Mountain Pose", "Stand tall through the crown"),
      "Mountain Pose. Stand tall through the crown",
    );
  });

  it("does not duplicate when the cue already names the pose", () => {
    assert.equal(
      poseAndCueAnnouncement("Mountain Pose", "Get ready for Mountain Pose"),
      "Get ready for Mountain Pose",
    );
  });

  it("returns whichever side is present", () => {
    assert.equal(poseAndCueAnnouncement("Child's Pose", "  "), "Child's Pose");
    assert.equal(poseAndCueAnnouncement("", "Switch sides"), "Switch sides");
    assert.equal(poseAndCueAnnouncement("  ", "  "), "");
  });
});

describe("cueTextForGuidedPhase", () => {
  it("uses get-ready copy on transition-in", () => {
    assert.equal(
      cueTextForGuidedPhase({ phase: "transitionIn", poseName: "Downward Dog" }),
      "Get ready for Downward Dog",
    );
  });

  it("uses instruction and hold cues without a breath label", () => {
    assert.equal(
      cueTextForGuidedPhase({
        phase: "instruction",
        poseName: "Mountain Pose",
        instructionCue: "Press into all four corners of the feet",
      }),
      "Press into all four corners of the feet",
    );
    assert.equal(
      cueTextForGuidedPhase({
        phase: "hold",
        poseName: "Mountain Pose",
        holdCue: "Soften the jaw",
      }),
      "Soften the jaw",
    );
    assert.equal(
      cueTextForGuidedPhase({ phase: "sideSwitch", poseName: "Triangle" }),
      "Switch sides",
    );
  });
});

describe("shouldAnnounceHoldEndingOnce", () => {
  it("fires once when remaining first hits 10", () => {
    assert.equal(
      shouldAnnounceHoldEndingOnce({
        phase: "hold",
        remainingSeconds: 10,
        alreadyAnnounced: false,
      }),
      true,
    );
    assert.equal(
      shouldAnnounceHoldEndingOnce({
        phase: "hold",
        remainingSeconds: 9,
        alreadyAnnounced: true,
      }),
      false,
    );
  });

  it("fires once for a short hold that never ticks through 10", () => {
    assert.equal(
      shouldAnnounceHoldEndingOnce({
        phase: "hold",
        remainingSeconds: 7,
        alreadyAnnounced: false,
      }),
      true,
    );
  });

  it("does not fire on instruction, at zero, or after the flag", () => {
    assert.equal(
      shouldAnnounceHoldEndingOnce({
        phase: "instruction",
        remainingSeconds: 10,
        alreadyAnnounced: false,
      }),
      false,
    );
    assert.equal(
      shouldAnnounceHoldEndingOnce({
        phase: "hold",
        remainingSeconds: 0,
        alreadyAnnounced: false,
      }),
      false,
    );
    assert.equal(
      shouldAnnounceHoldEndingOnce({
        phase: "hold",
        remainingSeconds: 11,
        alreadyAnnounced: false,
      }),
      false,
    );
  });
});

describe("session lifecycle copy", () => {
  it("prefixes the first pose announcement with session started", () => {
    assert.equal(
      withSessionStarted("Get ready for Mountain Pose", false),
      "Session started. Get ready for Mountain Pose",
    );
    assert.equal(
      withSessionStarted("Child's Pose. Soften the jaw", true),
      "Child's Pose. Soften the jaw",
    );
  });

  it("exports pause, resume, and complete strings", () => {
    assert.equal(GUIDED_SR.paused, "Paused");
    assert.equal(GUIDED_SR.resumed, "Resumed");
    assert.equal(GUIDED_SR.sessionComplete, "Session complete");
    assert.equal(GUIDED_SR.holdEnding, "10 seconds remaining");
  });
});

describe("GuidedSession live region wiring", () => {
  const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");

  it("keeps a dedicated polite live region that is not gated on captions", () => {
    assert.match(src, /data-testid="guided-sr-announce"/);
    assert.match(src, /aria-live="polite"/);
    assert.match(src, /aria-atomic="true"/);
    assert.match(src, /role="status"/);
    assert.match(src, /GUIDED_SR/);
    assert.match(src, /shouldAnnounceHoldEndingOnce/);
    // Captions stay visual; they must not be the only live region, and they
    // must not re-announce the breath label every second.
    const caption = src.slice(src.indexOf("data-testid=\"guided-caption\""));
    const captionBlock = caption.slice(0, caption.indexOf("</p>") + 4);
    assert.equal(
      /aria-live/.test(captionBlock),
      false,
      "caption still has aria-live and would spam the breath label",
    );
  });

  it("announces start, pause, resume, complete, and the 10-second warning", () => {
    assert.match(src, /withSessionStarted/);
    assert.match(src, /GUIDED_SR\.paused/);
    assert.match(src, /GUIDED_SR\.resumed/);
    assert.match(src, /GUIDED_SR\.sessionComplete/);
    assert.match(src, /GUIDED_SR\.holdEnding/);
    assert.match(src, /poseAndCueAnnouncement/);
  });
});
