/**
 * Learn / Flow / Timer — the three ways a queue is taught, and what each
 * costs on the clock. Sun Salutation A used to advertise 28 minutes guided
 * against 4 minutes timer-only because every repeated Downward Dog replayed
 * its full setup narration.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BRIEF_INSTRUCTION_SECONDS,
  INSTRUCTION_MODE_LABEL,
  SIDE_SWITCH_SECONDS,
  TRANSITION_SECONDS,
  guidedSessionSeconds,
  remainingFromPhases,
  repeatFlags,
  resolveInstructionSeconds,
  teachesFully,
} from "./guidedDuration.ts";
import { PATHWAYS } from "../data/content.ts";
import { catalogSessionSeconds, flowPoses } from "./pathwayTiming.ts";

const pose = (slug: string, holdSeconds: number, sides: "once" | "each" = "once") => ({
  slug,
  holdSeconds,
  sides,
});

describe("Learn / Flow / Timer", () => {
  it("names the modes the way the player presents them", () => {
    assert.deepEqual(INSTRUCTION_MODE_LABEL, { guided: "Learn", brief: "Flow", timer: "Timer only" });
  });

  it("Learn teaches a pose fully once, then cues it briefly", () => {
    const once = [pose("adho-mukha-svanasana", 30)];
    const twice = [pose("adho-mukha-svanasana", 30), pose("adho-mukha-svanasana", 30)];
    const full = resolveInstructionSeconds(once[0]!, "guided");
    assert.ok(full > BRIEF_INSTRUCTION_SECONDS, "recorded setup is longer than a cue");
    assert.equal(
      guidedSessionSeconds(twice, "guided") - guidedSessionSeconds(once, "guided"),
      TRANSITION_SECONDS + BRIEF_INSTRUCTION_SECONDS + 30,
    );
  });

  it("Learn gives the far side of a bilateral pose the short cue", () => {
    const w2 = pose("virabhadrasana-ii", 40, "each");
    const full = resolveInstructionSeconds(w2, "guided");
    assert.equal(
      guidedSessionSeconds([w2], "guided"),
      TRANSITION_SECONDS + full + 40 + SIDE_SWITCH_SECONDS + BRIEF_INSTRUCTION_SECONDS + 40,
    );
    assert.equal(teachesFully("guided", { repeat: false, side: 2 }), false);
    assert.equal(teachesFully("brief", { repeat: false, side: 1 }), false);
  });

  it("Flow and Timer are unaffected by repeats", () => {
    const twice = [pose("tadasana", 20), pose("tadasana", 20)];
    assert.equal(guidedSessionSeconds(twice, "brief"), 2 * (TRANSITION_SECONDS + BRIEF_INSTRUCTION_SECONDS + 20));
    assert.equal(guidedSessionSeconds(twice, "timer"), 2 * (TRANSITION_SECONDS + 20));
  });

  it("orders Learn > Flow > Timer and keeps Sun Salutations near their real length", () => {
    for (const slug of ["surya-namaskar-a", "surya-namaskar-b"]) {
      const p = PATHWAYS.find((x) => x.slug === slug);
      assert.ok(p, slug);
      const poses = flowPoses(p);
      const learn = catalogSessionSeconds(poses, "guided");
      const flow = catalogSessionSeconds(poses, "brief");
      const timer = catalogSessionSeconds(poses, "timer");
      assert.ok(learn > flow && flow > timer, slug);
      // A repeated sequence may not cost more than ~3× its timer-only length.
      assert.ok(learn <= timer * 3.5, `${slug}: learn ${learn}s vs timer ${timer}s`);
    }
  });

  it("remaining time mid-session agrees with the session total", () => {
    const q = [pose("tadasana", 30), pose("uttanasana", 30), pose("tadasana", 30)];
    const total = guidedSessionSeconds(q, "guided");
    const fromStart = remainingFromPhases({
      poses: q,
      index: 0,
      phase: "transitionIn",
      instructionLeft: 0,
      phaseRemaining: TRANSITION_SECONDS,
    });
    assert.equal(fromStart, total);
    // At the repeat of Mountain, the remaining time is the brief cue + hold.
    const atRepeat = remainingFromPhases({
      poses: q,
      index: 2,
      phase: "transitionIn",
      instructionLeft: 0,
      phaseRemaining: TRANSITION_SECONDS,
    });
    assert.equal(atRepeat, TRANSITION_SECONDS + BRIEF_INSTRUCTION_SECONDS + 30);
    assert.deepEqual(repeatFlags(q), [false, false, true]);
  });

  it("the player uses the same rule, and Replay restores the full setup", () => {
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(src, /teachesFully\(instructionMode, \{ repeat: isRepeatPose, side: whichSide \}\)/);
    assert.match(src, /startInstruction\(side, \{ full: true \}\)/);
  });
});
