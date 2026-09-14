import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INSTRUCTOR_PILOT_MISSING_ASSETS,
  INSTRUCTOR_PILOT_POSES,
  INSTRUCTOR_PILOT_SLUGS,
  instructorPoseBySlug,
} from "./instructorPilot.ts";
import {
  buildSessionTimeline,
  formatClock,
  phaseLabel,
  segmentAtTime,
} from "../lib/instructorTimeline.ts";
import {
  advanceClock,
  pauseClock,
  resumeClock,
  seekClock,
} from "../lib/instructorClock.ts";
import {
  effectiveLevel,
  evaluateSafetyPlan,
  relevantRules,
} from "../lib/instructorSafety.ts";

describe("instructor pilot catalog", () => {
  it("covers the five requested foundation poses", () => {
    assert.deepEqual([...INSTRUCTOR_PILOT_SLUGS], [
      "tadasana",
      "balasana",
      "marjaryasana-bitilasana",
      "virabhadrasana-ii",
      "kumbhakasana",
    ]);
    assert.equal(INSTRUCTOR_PILOT_POSES.length, 5);
    for (const slug of INSTRUCTOR_PILOT_SLUGS) {
      assert.ok(instructorPoseBySlug(slug), slug);
    }
  });

  it("never claims instructor-reviewed filmed media", () => {
    for (const pose of INSTRUCTOR_PILOT_POSES) {
      for (const level of ["beginner", "intermediate", "advanced"] as const) {
        const media = pose.variants[level].media;
        assert.notEqual(media.kind, "filmed_instructor");
        assert.notEqual(media.reviewStatus, "instructor_reviewed");
        assert.ok(media.missingAssetId);
        assert.match(media.label, /not|unavailable|Static|Presentation/i);
      }
    }
  });

  it("uses static reference for beginner variants without matching filmed demos", () => {
    assert.equal(
      instructorPoseBySlug("balasana")!.variants.beginner.media.kind,
      "static_reference",
    );
    assert.equal(
      instructorPoseBySlug("kumbhakasana")!.variants.beginner.media.kind,
      "static_reference",
    );
  });

  it("lists precise missing assets", () => {
    assert.ok(INSTRUCTOR_PILOT_MISSING_ASSETS.length >= 20);
    assert.ok(
      INSTRUCTOR_PILOT_MISSING_ASSETS.some((a) =>
        a.id.includes("filmed-instructor/tadasana/front"),
      ),
    );
  });
});

describe("instructor timeline", () => {
  it("builds longer Learn sessions than Flow and includes both Warrior II sides", () => {
    const poses = INSTRUCTOR_PILOT_POSES;
    const learn = buildSessionTimeline({ poses, mode: "learn", level: "intermediate" });
    const flow = buildSessionTimeline({ poses, mode: "flow", level: "intermediate" });
    assert.ok(learn.totalSec > flow.totalSec);
    assert.ok(learn.flat.some((s) => s.id.includes("virabhadrasana-ii-left")));
    assert.ok(learn.flat.some((s) => s.id.includes("virabhadrasana-ii-right")));
    assert.ok(learn.flat.some((s) => s.phase === "side_switch"));
    assert.equal(phaseLabel("preparation"), "Prepare");
    assert.match(formatClock(125), /2:05/);
  });

  it("keeps variation media honest when level changes", () => {
    const beginner = buildSessionTimeline({
      poses: [instructorPoseBySlug("kumbhakasana")!],
      mode: "learn",
      level: "beginner",
    });
    const advanced = buildSessionTimeline({
      poses: [instructorPoseBySlug("kumbhakasana")!],
      mode: "learn",
      level: "advanced",
    });
    assert.ok(beginner.totalSec > 0);
    assert.ok(advanced.totalSec > 0);
    assert.equal(beginner.poses[0].mediaKind, "static_reference");
    assert.equal(advanced.poses[0].mediaKind, "presentation_animation");
  });

  it("resolves the active segment from the shared clock", () => {
    const session = buildSessionTimeline({
      poses: [instructorPoseBySlug("tadasana")!],
      mode: "flow",
      level: "beginner",
    });
    const first = segmentAtTime(session.flat, 0);
    const later = segmentAtTime(session.flat, session.flat[0].durationSec + 1);
    assert.equal(first?.phase, "preparation");
    assert.ok(later && later.index >= 1);
  });
});

describe("instructor clock", () => {
  it("pauses, resumes, and seeks together", () => {
    let clock = { timeSec: 0, playing: true, rate: 1 };
    clock = advanceClock(clock, 2);
    assert.equal(clock.timeSec, 2);
    clock = pauseClock(clock);
    clock = advanceClock(clock, 5);
    assert.equal(clock.timeSec, 2);
    clock = resumeClock(clock);
    clock = advanceClock(clock, 1.5);
    assert.equal(clock.timeSec, 3.5);
    clock = seekClock(clock, 10);
    assert.equal(clock.timeSec, 10);
  });
});

describe("instructor safety intake", () => {
  it("does not claim adapted practice until answers are complete", () => {
    const poses = INSTRUCTOR_PILOT_POSES;
    const rules = relevantRules(poses);
    const blocked = evaluateSafetyPlan({
      poses,
      answers: [],
      requestedLevel: "intermediate",
    });
    assert.equal(blocked.ready, false);
    assert.equal(blocked.claimsAdapted, false);
    assert.ok(blocked.missingRuleIds.length > 0);

    const answered = evaluateSafetyPlan({
      poses,
      answers: rules.map((r) => ({ ruleId: r.id, applies: false })),
      requestedLevel: "intermediate",
    });
    assert.equal(answered.ready, true);
    assert.equal(answered.claimsAdapted, true);
    assert.equal(effectiveLevel("intermediate", answered), "intermediate");
  });

  it("forces beginner when a prefer_beginner rule applies", () => {
    const pose = instructorPoseBySlug("kumbhakasana")!;
    const modify = pose.restrictions.find((r) => r.action === "prefer_beginner");
    assert.ok(modify);
    const plan = evaluateSafetyPlan({
      poses: [pose],
      answers: pose.restrictions.map((r) => ({
        ruleId: r.id,
        applies: r.id === modify!.id,
      })),
      requestedLevel: "advanced",
    });
    assert.equal(plan.forcedLevel, "beginner");
    assert.equal(effectiveLevel("advanced", plan), "beginner");
  });
});
