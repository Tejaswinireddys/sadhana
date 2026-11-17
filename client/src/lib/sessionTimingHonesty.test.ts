/**
 * QA Priority 2 — hold / session timing honesty.
 *
 * A pose list that prints "30 sec" next to Mountain Pose looks like total pose
 * time. The guided player then spends ~58–62s on recorded instruction before
 * the hold begins. Session cards that said "10 min" while holds alone summed to
 * a few minutes had the opposite problem: the label must be the wall-clock from
 * guidedDuration / sessionFit (actualMinutes), never a holds-only sum and never
 * an authored minutesPerSession literal.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { asanaBySlug, PATHWAYS } from "../data/content.ts";
import { narrationSecondsFor } from "../data/narrationDurations.ts";
import {
  QUICK_SESSIONS,
  sessionMinutes,
  sessionSeconds,
  sessionTimeLabel,
} from "../data/quickSessions.ts";
import { SAMPLE_PRACTICE } from "../data/samplePractice.ts";
import { formatHoldLabel } from "./formatDuration.ts";
import {
  BRIEF_INSTRUCTION_SECONDS,
  guidedSessionSeconds,
  guidedTimeLabel,
  holdPhaseSeconds,
  poseTimingParts,
  TRANSITION_SECONDS,
} from "./guidedDuration.ts";
import {
  catalogSessionLabel,
  catalogSessionMinutes,
  catalogSessionSeconds,
  flowSessionLabel,
  flowSessionMinutes,
  poseSides,
} from "./pathwayTiming.ts";
import { buildSessionPreflight } from "./sessionPreflight.ts";
import { evaluateSessionFit } from "./sessionFit.ts";
import { composeTrainerSession } from "./yogaTrainer.ts";

function timedFromCatalog(
  poses: Array<{
    slug?: string;
    asanaSlug?: string;
    holdSeconds: number;
    sides?: "each" | "once" | "single";
    note?: string;
  }>,
) {
  return poses.map((p) => {
    const slug = p.slug ?? p.asanaSlug!;
    const asana = asanaBySlug(slug);
    return {
      slug,
      holdSeconds: p.holdSeconds,
      sides: poseSides(p),
      stepCount: asana?.steps.length ?? 0,
    };
  });
}

describe("hold phase is hold-only — narration is not the hold", () => {
  it("Mountain Pose listed hold matches the player's hold phase", () => {
    const asana = asanaBySlug("tadasana");
    assert.ok(asana);
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      const listed = asana.variations[level].holdSeconds;
      assert.equal(
        holdPhaseSeconds(listed),
        listed,
        `${level}: listed hold must be what the player holds`,
      );
      const parts = poseTimingParts({
        slug: "tadasana",
        holdSeconds: listed,
        stepCount: asana.steps.length,
      });
      assert.equal(parts.holdSeconds, listed);
      assert.equal(parts.transitionSeconds, TRANSITION_SECONDS);
      assert.ok(
        parts.instructionSeconds >= 55,
        `${level}: expected ~58–62s Mountain narration, got ${parts.instructionSeconds}`,
      );
      assert.notEqual(
        parts.holdSeconds,
        parts.instructionSeconds,
        "hold must not equal narration length",
      );
      assert.equal(
        parts.totalSeconds,
        TRANSITION_SECONDS + parts.instructionSeconds + listed,
      );
      assert.ok(
        parts.totalSeconds > listed + TRANSITION_SECONDS,
        "total pose time includes guidance beyond the hold",
      );
    }
    const recorded = narrationSecondsFor("tadasana");
    assert.ok(recorded > 55, `expected recorded Mountain narration, got ${recorded}`);
  });

  it("formatHoldLabel always names the hold so lists cannot look like totals", () => {
    assert.equal(formatHoldLabel(20), "Hold 20 sec");
    assert.equal(formatHoldLabel(45, "each"), "Hold 45 sec each side");
    assert.match(formatHoldLabel(30), /^Hold /);
  });

  it("pose detail and preflight copy keep Hold in the string", () => {
    for (const rel of [
      "pages/AsanaDetail.tsx",
      "components/SessionPreflightCard.tsx",
      "components/home/TodayPracticeCard.tsx",
    ]) {
      const src = readFileSync(resolve("client/src", rel), "utf8");
      assert.match(src, /formatHoldLabel/, `${rel} should label holds explicitly`);
      assert.equal(
        /formatDuration\(p\.holdSeconds\)/.test(src),
        false,
        `${rel} still prints a bare hold duration`,
      );
    }
    const detail = readFileSync(resolve("client/src/pages/AsanaDetail.tsx"), "utf8");
    assert.match(detail, /aria-hidden \/> Hold/);
    assert.match(detail, /with guidance/);
    assert.match(detail, /TRANSITION_SECONDS/);
  });
});

describe("session length labels equal guidedDuration actual minutes", () => {
  it("sample practice (includes tadasana) label == computed sum", () => {
    const timed = timedFromCatalog(SAMPLE_PRACTICE.poses);
    const seconds = guidedSessionSeconds(timed);
    const label = guidedTimeLabel(seconds);
    assert.equal(sessionTimeLabel(SAMPLE_PRACTICE.poses), label);
    assert.equal(sessionSeconds(SAMPLE_PRACTICE.poses), seconds);
    assert.equal(
      sessionMinutes(SAMPLE_PRACTICE.poses),
      Math.max(1, Math.round(seconds / 60)),
    );
    const preflight = buildSessionPreflight({
      poses: SAMPLE_PRACTICE.poses.map((p) => {
        const a = asanaBySlug(p.slug)!;
        return { ...a, holdSeconds: p.holdSeconds };
      }),
    });
    assert.equal(preflight.timeLabel, label);
    assert.equal(preflight.minutes, Math.max(1, Math.round(seconds / 60)));
    assert.ok(
      seconds > SAMPLE_PRACTICE.poses.reduce((s, p) => s + p.holdSeconds, 0),
      "guided total must exceed the holds-only sum",
    );
  });

  it("Home quick sessions: card label == guided sum", () => {
    for (const q of QUICK_SESSIONS) {
      const timed = timedFromCatalog(q.poses);
      const seconds = guidedSessionSeconds(timed);
      assert.equal(sessionTimeLabel(q.poses), guidedTimeLabel(seconds), q.id);
      assert.equal(sessionMinutes(q.poses), Math.max(1, Math.round(seconds / 60)), q.id);
    }
  });

  it("Morning Wake-Up is not the authored '10 min' holds-only figure", () => {
    const morning = PATHWAYS.find((p) => p.slug === "morning-wake-up");
    assert.ok(morning);
    const poses = morning.weekPlan[0]!.poses;
    const holdOnlySec = poses.reduce(
      (s, p) => s + p.holdSeconds * (poseSides(p) === "each" ? 2 : 1),
      0,
    );
    const guidedSec = catalogSessionSeconds(poses);
    const label = flowSessionLabel(morning);
    const minutes = flowSessionMinutes(morning);
    assert.equal(label, catalogSessionLabel(poses));
    assert.equal(label, guidedTimeLabel(guidedSec));
    assert.equal(minutes, catalogSessionMinutes(poses));
    assert.equal(minutes, Math.max(1, Math.round(guidedSec / 60)));
    // Authored marketing said "10 min"; holds alone are far below guided wall-clock.
    assert.equal(morning.timePerSession, "10 min");
    assert.notEqual(label, "10 min");
    assert.ok(guidedSec > holdOnlySec, `guided ${guidedSec} vs holds ${holdOnlySec}`);
    assert.ok(
      minutes >= 15,
      `Morning Wake-Up guided length should reflect narration, got ${minutes} min`,
    );
  });

  it("every quick flow label equals its computed guided sum", () => {
    for (const p of PATHWAYS.filter((x) => x.kind === "flow")) {
      const poses = p.weekPlan[0]?.poses ?? [];
      assert.ok(poses.length, p.slug);
      const timed = timedFromCatalog(poses);
      const seconds = guidedSessionSeconds(timed);
      assert.equal(flowSessionLabel(p), guidedTimeLabel(seconds), p.slug);
      assert.equal(flowSessionMinutes(p), Math.max(1, Math.round(seconds / 60)), p.slug);
      if (p.timePerSession && /^\d+ min$/.test(p.timePerSession)) {
        const authored = Number(p.timePerSession.replace(/ min$/, ""));
        if (Math.abs(authored - flowSessionMinutes(p)) > 1) {
          assert.notEqual(
            flowSessionLabel(p),
            p.timePerSession,
            `${p.slug}: UI still showing authored ${p.timePerSession}`,
          );
        }
      }
    }
  });

  it("Trainer actualMinutes badge matches evaluateSessionFit planned minutes", () => {
    const s = composeTrainerSession({
      body: ["Great"],
      soreParts: [],
      energy: "Balanced",
      timeMinutes: 10,
      need: "movement",
    });
    const timed = timedFromCatalog(s.poses);
    const seconds = guidedSessionSeconds(timed);
    assert.equal(s.totalMinutes, Math.max(1, Math.round(seconds / 60)));
    assert.equal(Math.round(s.totalSeconds), Math.round(seconds));
    const fit = evaluateSessionFit({ requestedMinutes: 10, poses: timed });
    assert.equal(s.totalMinutes, fit.plannedMinutes);
    assert.ok(s.poses.some((p) => p.slug === "tadasana") || timed.length > 0);
  });

  it("brief mode still separates hold from the short cue window", () => {
    const parts = poseTimingParts(
      { slug: "tadasana", holdSeconds: 30, stepCount: 4 },
      "brief",
    );
    assert.equal(parts.holdSeconds, 30);
    assert.equal(parts.instructionSeconds, BRIEF_INSTRUCTION_SECONDS);
    assert.equal(parts.totalSeconds, TRANSITION_SECONDS + BRIEF_INSTRUCTION_SECONDS + 30);
  });
});

describe("wiring stays on derived helpers", () => {
  it("sessionTimingHonesty test file is registered in package.json", () => {
    const pkg = readFileSync(resolve("package.json"), "utf8");
    assert.match(pkg, /sessionTimingHonesty\.test\.ts/);
    assert.equal(existsSync(resolve("client/src/lib/sessionTimingHonesty.test.ts")), true);
  });
});
