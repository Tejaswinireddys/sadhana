import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeTrainerSession, NEED_OPTIONS, TIME_OPTIONS } from "./yogaTrainer";
import { generateAdaptiveSession } from "./adaptiveGenerator";
import { guidedSessionSeconds } from "./guidedDuration";
import { evaluateSessionFit, nearestOfferedMinutes, sessionOverheadSeconds } from "./sessionFit";
import { QUICK_SESSIONS, sessionMinutes } from "@/data/quickSessions";
import { asanaBySlug } from "@/data/content";

const base = {
  body: ["Great"],
  soreParts: [] as string[],
  energy: "Balanced",
  timeMinutes: 15,
  need: "movement",
};

/** Exactly how the guided player will time a composed queue. */
function playerSeconds(poses: { slug: string; holdSeconds: number; sides: "once" | "each" }[]) {
  return guidedSessionSeconds(
    poses.map((p) => ({
      holdSeconds: p.holdSeconds,
      sides: p.sides,
      slug: p.slug,
      stepCount: asanaBySlug(p.slug)?.steps.length ?? 0,
    })),
  );
}

describe("session length is one number, everywhere", () => {
  it("Trainer's badge is the length the player runs, not a sum of holds", () => {
    // The report: a 5-minute Trainer recommendation opened as 14 minutes in
    // Practice, because the badge counted holds and the player also spoke
    // 55-70s of narration per pose.
    for (const minutes of TIME_OPTIONS) {
      for (const { id } of NEED_OPTIONS) {
        const s = composeTrainerSession({ ...base, timeMinutes: minutes, need: id });
        const actual = playerSeconds(s.poses);
        assert.equal(
          s.totalMinutes,
          Math.max(1, Math.round(actual / 60)),
          `${minutes}min/${id}: badge ${s.totalMinutes} vs player ${(actual / 60).toFixed(1)}`,
        );
        assert.equal(Math.round(s.totalSeconds), Math.round(actual));
      }
    }
  });

  it("Adaptive Plan's badge survives easing, swaps and top-ups", () => {
    // The report: a 10-minute Adaptive selection ran 21 minutes. The generator
    // reshaped holds after composing and then reported the stale figure.
    for (const minutes of [10, 15, 20, 25]) {
      for (const { id } of NEED_OPTIONS) {
        const r = generateAdaptiveSession({ intentMinutes: minutes, need: id });
        const actual = playerSeconds(r.session.poses);
        assert.equal(
          r.session.totalMinutes,
          Math.max(1, Math.round(actual / 60)),
          `${minutes}min/${id}: badge ${r.session.totalMinutes} vs player ${(actual / 60).toFixed(1)}`,
        );
      }
    }
  });

  it("Home quick-session cards match the queue they open", () => {
    // The report: a 15-minute Better Sleep card opened as ~22 minutes.
    for (const q of QUICK_SESSIONS) {
      const timed = q.poses.map((p) => ({
        holdSeconds: p.holdSeconds,
        slug: p.slug,
        stepCount: asanaBySlug(p.slug)?.steps.length ?? 0,
      }));
      assert.equal(
        sessionMinutes(q.poses),
        Math.max(1, Math.round(guidedSessionSeconds(timed) / 60)),
        `${q.label} card disagrees with its own queue`,
      );
    }
  });

  it("never overruns a request without saying so before you start", () => {
    for (const minutes of TIME_OPTIONS) {
      for (const { id } of NEED_OPTIONS) {
        const s = composeTrainerSession({ ...base, timeMinutes: minutes, need: id });
        const overshoot = s.totalSeconds - minutes * 60;
        const tolerance = Math.max(45, minutes * 60 * 0.15);
        if (overshoot > tolerance) {
          assert.ok(
            s.fit.explanation,
            `${minutes}min/${id} ran ${s.totalMinutes}min with no explanation`,
          );
          assert.equal(s.fit.fits, false);
        }
      }
    }
  });

  it("offers a length that actually fits when the request cannot be met", () => {
    for (const minutes of TIME_OPTIONS) {
      const s = composeTrainerSession({ ...base, timeMinutes: minutes, need: "movement" });
      if (!s.fit.explanation) continue;
      const offer = nearestOfferedMinutes(s.fit.plannedMinutes, TIME_OPTIONS);
      assert.ok(offer != null, "no offer for an unmeetable request");
      assert.ok(
        offer! >= s.fit.plannedMinutes || offer === Math.max(...TIME_OPTIONS),
        `offered ${offer} for a ${s.fit.plannedMinutes}min practice`,
      );
    }
  });
});

describe("evaluateSessionFit", () => {
  const pose = (slug: string, holdSeconds: number, sides: "once" | "each" = "once") => ({
    holdSeconds,
    sides,
    slug,
    stepCount: asanaBySlug(slug)?.steps.length ?? 0,
  });

  it("counts narration and transitions as part of the practice", () => {
    const poses = [pose("tadasana", 30), pose("balasana", 60)];
    const overhead = sessionOverheadSeconds(poses);
    assert.ok(overhead > 60, `narration and transitions were not counted: ${overhead}s`);
    assert.equal(guidedSessionSeconds(poses), overhead + 90);
  });

  it("rounding is honest but a real overrun is not", () => {
    const poses = [pose("tadasana", 30)];
    const tight = evaluateSessionFit({ requestedMinutes: 2, poses });
    assert.equal(tight.fits, true, "a few seconds of rounding should not nag");

    // Six narrated poses cannot be delivered in two minutes at any hold length.
    const many = Array.from({ length: 6 }, () => pose("tadasana", 30));
    const impossible = evaluateSessionFit({
      requestedMinutes: 2,
      poses: many,
      minHoldSeconds: many.map(() => 10),
    });
    assert.equal(impossible.fits, false);
    assert.match(impossible.explanation ?? "", /including guidance — \d+ min is too short/);
    assert.equal(impossible.suggestedMinutes, impossible.floorMinutes);
  });

  it("offers no alternative duration when trimming holds would be enough", () => {
    // Requested 3 min, floor 2.6 min: the fix is shorter holds, not a longer
    // slot — so there is nothing to offer the user.
    const poses = [pose("tadasana", 300), pose("balasana", 300)];
    const fit = evaluateSessionFit({ requestedMinutes: 3, poses, minHoldSeconds: [20, 20] });
    assert.ok(fit.floorSeconds < fit.plannedSeconds, "floor should trim the holds");
    assert.ok(fit.floorSeconds <= fit.requestedSeconds, "this queue does fit at minimum holds");
    assert.equal(fit.suggestedMinutes, null);
  });

  it("offers the first duration that can hold the practice", () => {
    assert.equal(nearestOfferedMinutes(14, [5, 10, 15, 20, 30]), 15);
    assert.equal(nearestOfferedMinutes(15, [5, 10, 15, 20, 30]), 15);
    assert.equal(nearestOfferedMinutes(99, [5, 10, 15, 20, 30]), 30);
  });
});
