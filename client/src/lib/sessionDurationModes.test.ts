import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BRIEF_INSTRUCTION_SECONDS,
  SIDE_SWITCH_SECONDS,
  TRANSITION_SECONDS,
  guidedSessionSeconds,
  remainingFromPhases,
  resolveInstructionSeconds,
  type GuidedTimedPose,
} from "./guidedDuration.ts";
import { evaluateSessionFit } from "./sessionFit.ts";
import { asanaBySlug } from "../data/content.ts";
import { QUICK_SESSIONS, sessionMinutes } from "../data/quickSessions.ts";

const pose = (
  slug: string,
  holdSeconds: number,
  sides: "once" | "each" = "once",
): GuidedTimedPose => ({
  slug,
  holdSeconds,
  sides,
  stepCount: asanaBySlug(slug)?.steps.length ?? 0,
});

describe("one duration per teaching mode", () => {
  it("a voice-off session is not the length of the narrated one", () => {
    // The player reads the steps for BRIEF_INSTRUCTION_SECONDS when voice is
    // off. Advertising the 55-70s narration figure overstated a four-pose
    // wind-down by minutes.
    const poses = QUICK_SESSIONS.find((q) => q.id === "tired")!.poses;
    const guided = sessionMinutes(poses, "guided");
    const brief = sessionMinutes(poses, "brief");
    const timer = sessionMinutes(poses, "timer");
    assert.ok(guided > brief, `guided ${guided} should exceed brief ${brief}`);
    assert.ok(brief >= timer, `brief ${brief} should be at least timer ${timer}`);
  });

  it("brief mode charges exactly the silent walkthrough window", () => {
    const p = pose("balasana", 60);
    assert.equal(resolveInstructionSeconds(p, "brief"), BRIEF_INSTRUCTION_SECONDS);
    assert.equal(resolveInstructionSeconds(p, "timer"), 0);
    assert.ok(resolveInstructionSeconds(p, "guided") > BRIEF_INSTRUCTION_SECONDS);
  });

  it("the player's silent window IS the brief constant", () => {
    // Two constants drifting apart is how the estimate and the clock disagree.
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(src, /const SILENT_INSTRUCTION_SECONDS = BRIEF_INSTRUCTION_SECONDS;/);
  });

  it("timer-only is transitions plus holds and nothing else", () => {
    const poses = [pose("tadasana", 30), pose("virabhadrasana-ii", 40, "each")];
    assert.equal(
      guidedSessionSeconds(poses, "timer"),
      TRANSITION_SECONDS + 30 + (TRANSITION_SECONDS + 40 + SIDE_SWITCH_SECONDS + 40),
    );
  });

  it("fit is judged against the mode the practitioner will get", () => {
    // Five *different* poses: Learn re-teaches nothing, so a repeat is cheap.
    const poses = ["tadasana", "uttanasana", "balasana", "bhujangasana", "savasana"].map((s) =>
      pose(s, 30),
    );
    const guided = evaluateSessionFit({ requestedMinutes: 6, poses, mode: "guided" });
    const brief = evaluateSessionFit({ requestedMinutes: 6, poses, mode: "brief" });
    assert.equal(guided.fits, false, "five narrated poses do not fit six minutes");
    assert.equal(brief.fits, true, "the same five read on screen do");
  });
});

describe("remaining time survives the controls", () => {
  const bilateral = [pose("virabhadrasana-ii", 30, "each"), pose("balasana", 60)];

  it("counts the far side of a bilateral pose", () => {
    // Before: the footer treated Warrior II as done after side one, hiding the
    // second narration, the switch and the second hold — 99 seconds.
    const total = guidedSessionSeconds(bilateral);
    const atStart = remainingFromPhases({
      poses: bilateral,
      index: 0,
      phase: "transitionIn",
      instructionLeft: 0,
      phaseRemaining: TRANSITION_SECONDS,
      side: 1,
    });
    assert.equal(atStart, Math.round(total));
  });

  it("stops counting the far side once it is the near side", () => {
    const onSideTwo = remainingFromPhases({
      poses: bilateral,
      index: 0,
      phase: "hold",
      instructionLeft: 0,
      phaseRemaining: 30,
      side: 2,
    });
    const onSideOne = remainingFromPhases({
      poses: bilateral,
      index: 0,
      phase: "hold",
      instructionLeft: 0,
      phaseRemaining: 30,
      side: 1,
    });
    // Learn teaches the far side with the short Flow cue, not the full setup.
    assert.equal(onSideOne - onSideTwo, SIDE_SWITCH_SECONDS + BRIEF_INSTRUCTION_SECONDS + 30);
  });

  it("counts time banked by +30s before the hold starts", () => {
    const base = remainingFromPhases({
      poses: [pose("balasana", 60)],
      index: 0,
      phase: "instruction",
      instructionLeft: 20,
      phaseRemaining: 20,
    });
    const extended = remainingFromPhases({
      poses: [pose("balasana", 60)],
      index: 0,
      phase: "instruction",
      instructionLeft: 20,
      phaseRemaining: 20,
      pendingHoldExtension: 30,
    });
    assert.equal(extended - base, 30);
  });

  it("slow pace makes the wall-clock longer, not the same", () => {
    const normal = remainingFromPhases({
      poses: [pose("balasana", 60)],
      index: 0,
      phase: "hold",
      instructionLeft: 0,
      phaseRemaining: 60,
      pace: 1,
    });
    const slow = remainingFromPhases({
      poses: [pose("balasana", 60)],
      index: 0,
      phase: "hold",
      instructionLeft: 0,
      phaseRemaining: 60,
      pace: 0.75,
    });
    assert.equal(normal, 60);
    assert.equal(slow, 80);
  });

  it("skipping ahead drops the skipped poses from the estimate", () => {
    const queue = [pose("tadasana", 30), pose("balasana", 60), pose("savasana", 90)];
    const atFirst = remainingFromPhases({
      poses: queue,
      index: 0,
      phase: "transitionIn",
      instructionLeft: 0,
      phaseRemaining: TRANSITION_SECONDS,
    });
    const atThird = remainingFromPhases({
      poses: queue,
      index: 2,
      phase: "transitionIn",
      instructionLeft: 0,
      phaseRemaining: TRANSITION_SECONDS,
    });
    assert.ok(atThird < atFirst);
    assert.equal(atThird, Math.round(guidedSessionSeconds(queue.slice(2))));
  });
});
