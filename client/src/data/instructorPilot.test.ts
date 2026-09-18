import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INSTRUCTOR_PILOT_MISSING_ASSETS,
  INSTRUCTOR_PILOT_POSES,
  instructorPoseBySlug,
  resolveTeachingVariant,
} from "./instructorPilot.ts";
import {
  advanceClock,
  pauseClock,
  resumeClock,
  seekClock,
} from "../lib/instructorClock.ts";
import { buildSessionTimeline, segmentAtTime } from "../lib/instructorTimeline.ts";
import {
  areaAnswerId,
  effectiveLevel,
  effectiveLevelForPose,
  evaluateSafetyPlan,
  intakePrompts,
  relevantRules,
  revalidateReplacement,
} from "../lib/instructorSafety.ts";

describe("instructor pilot catalog", () => {
  it("covers the five requested foundation poses", () => {
    assert.equal(INSTRUCTOR_PILOT_POSES.length, 5);
    assert.deepEqual(
      INSTRUCTOR_PILOT_POSES.map((p) => p.slug),
      [
        "tadasana",
        "balasana",
        "marjaryasana-bitilasana",
        "virabhadrasana-ii",
        "kumbhakasana",
      ],
    );
  });

  it("never claims instructor-reviewed filmed media", () => {
    for (const pose of INSTRUCTOR_PILOT_POSES) {
      for (const level of ["beginner", "intermediate", "advanced"] as const) {
        const media = pose.variants[level].media;
        assert.notEqual(media.reviewStatus, "instructor_reviewed");
        assert.ok(media.missingAssetId);
      }
    }
  });

  it("uses static reference for beginner variants without matching filmed demos", () => {
    const plank = instructorPoseBySlug("kumbhakasana")!;
    assert.equal(plank.variants.beginner.media.kind, "static_reference");
  });

  it("lists precise missing assets", () => {
    assert.ok(INSTRUCTOR_PILOT_MISSING_ASSETS.some((a) => /wrist-forearm/.test(a.id)));
    assert.ok(INSTRUCTOR_PILOT_MISSING_ASSETS.some((a) => /wrist-fist/.test(a.id)));
  });
});

describe("instructor timeline", () => {
  it("builds longer Learn sessions than Flow and includes both Warrior II sides", () => {
    const learn = buildSessionTimeline({
      poses: INSTRUCTOR_PILOT_POSES,
      mode: "learn",
      level: "beginner",
    });
    const flow = buildSessionTimeline({
      poses: INSTRUCTOR_PILOT_POSES,
      mode: "flow",
      level: "beginner",
    });
    assert.ok(learn.totalSec > flow.totalSec);
    const warriorSides = learn.flat.filter(
      (s) => s.id.startsWith("virabhadrasana-ii") && (s.side === "left" || s.side === "right"),
    );
    assert.ok(warriorSides.length >= 2);
  });

  it("keeps variation media honest when level changes", () => {
    const pose = instructorPoseBySlug("kumbhakasana")!;
    const beginner = resolveTeachingVariant(pose, "beginner", null);
    assert.equal(beginner.media.kind, "static_reference");
  });

  it("resolves the active segment from the shared clock", () => {
    const timeline = buildSessionTimeline({
      poses: [instructorPoseBySlug("tadasana")!],
      mode: "flow",
      level: "beginner",
    });
    const mid = timeline.flat[0]!;
    const hit = segmentAtTime(timeline.flat, mid.absStartSec + 0.1);
    assert.equal(hit?.id, mid.id);
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
    clock = seekClock(clock, 10);
    assert.equal(clock.timeSec, 10);
  });
});

describe("instructor safety intake", () => {
  it("dedupes intake to one prompt per body area", () => {
    const prompts = intakePrompts(INSTRUCTOR_PILOT_POSES);
    const areas = prompts.map((p) => p.bodyArea);
    assert.equal(areas.length, new Set(areas).size);
    assert.ok(prompts.length < relevantRules(INSTRUCTOR_PILOT_POSES).length);
    assert.ok(prompts.some((p) => p.bodyArea === "wrists"));
  });

  it("does not claim adapted practice until answers are complete", () => {
    const poses = INSTRUCTOR_PILOT_POSES;
    const prompts = intakePrompts(poses);
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
      answers: prompts.map((p) => ({ ruleId: p.id, applies: false })),
      requestedLevel: "intermediate",
    });
    assert.equal(answered.ready, true);
    assert.equal(answered.claimsAdapted, true);
    assert.equal(effectiveLevel("intermediate", answered), "intermediate");
  });

  it("forces beginner when a prefer_beginner rule applies", () => {
    const pose = instructorPoseBySlug("marjaryasana-bitilasana")!;
    const modify = pose.restrictions.find((r) => r.action === "prefer_beginner");
    assert.ok(modify);
    const plan = evaluateSafetyPlan({
      poses: [pose],
      answers: [
        { ruleId: areaAnswerId(modify!.bodyArea), applies: true },
        ...pose.restrictions
          .filter((r) => r.bodyArea !== modify!.bodyArea)
          .map((r) => ({ ruleId: areaAnswerId(r.bodyArea), applies: false })),
      ],
      requestedLevel: "advanced",
    });
    assert.ok(plan.forcedBeginnerPoseIds.includes(pose.poseId));
    assert.equal(effectiveLevelForPose(pose.poseId, "advanced", plan), "beginner");
  });

  it("maps wrist restriction to forearm-plank adaptation (not beginner)", () => {
    const pose = instructorPoseBySlug("kumbhakasana")!;
    const wrist = pose.restrictions.find((r) => r.adaptationId === "wrist_forearm_plank");
    assert.ok(wrist);
    const plan = evaluateSafetyPlan({
      poses: [pose],
      answers: pose.restrictions.map((r) => ({
        ruleId: areaAnswerId(r.bodyArea),
        applies: r.bodyArea === wrist!.bodyArea,
      })),
      requestedLevel: "advanced",
    });
    assert.equal(plan.forcedAdaptations[pose.poseId], "wrist_forearm_plank");
    assert.equal(effectiveLevelForPose(pose.poseId, "advanced", plan), "advanced");
    assert.ok(!plan.forcedBeginnerPoseIds.includes(pose.poseId));
    assert.ok(plan.activeBodyAreas.includes("wrists"));
  });

  it("revalidates Plank→Cat-Cow replacement so wrists stay adapted", () => {
    const plank = instructorPoseBySlug("kumbhakasana")!;
    const catCow = instructorPoseBySlug("marjaryasana-bitilasana")!;
    const plankAnswers = intakePrompts([plank]).map((p) => ({
      ruleId: p.id,
      applies: p.bodyArea === "wrists",
    }));
    const allPlank = evaluateSafetyPlan({
      poses: [plank],
      answers: plankAnswers,
      requestedLevel: "beginner",
    });
    assert.equal(allPlank.forcedAdaptations[plank.poseId], "wrist_forearm_plank");

    // First pass may require answers for areas Cat–Cow introduces (spine, knees).
    const pending = revalidateReplacement({
      currentPoses: [plank],
      replacement: catCow,
      replaceSlug: "kumbhakasana",
      answers: plankAnswers,
      requestedLevel: "beginner",
    });
    assert.ok(pending.missingPrompts.length > 0, "new areas must be asked before drop-in");

    const mergedAnswers = [
      ...plankAnswers,
      ...pending.missingPrompts.map((p) => ({ ruleId: p.id, applies: false })),
    ];
    const result = revalidateReplacement({
      currentPoses: [plank],
      replacement: catCow,
      replaceSlug: "kumbhakasana",
      answers: mergedAnswers,
      requestedLevel: "beginner",
    });
    assert.equal(result.missingPrompts.length, 0);
    assert.equal(
      result.plan.forcedAdaptations[catCow.poseId],
      "wrist_fist_catcow",
      "Cat–Cow must use fist/forearm adaptation, not ordinary wrists-under-shoulders",
    );
    const teaching = resolveTeachingVariant(
      catCow,
      "beginner",
      result.plan.forcedAdaptations[catCow.poseId],
    );
    assert.match(teaching.displayName ?? "", /fist|forearm/i);
    assert.ok(teaching.steps.some((s) => /fist|forearm/i.test(s)));
    assert.ok(!teaching.steps.some((s) => /wrists under the shoulders/i.test(s)));
  });

  it("keeps Pregnancy out of Knees and splits standing vs digestion", () => {
    const prompts = intakePrompts(INSTRUCTOR_PILOT_POSES);
    const knees = prompts.find((p) => p.bodyArea === "knees");
    const pregnancy = prompts.find((p) => p.bodyArea === "pregnancy");
    const standing = prompts.find((p) => p.bodyArea === "standing");
    const digestion = prompts.find((p) => p.bodyArea === "digestion");
    assert.ok(knees);
    assert.ok(pregnancy);
    assert.ok(standing);
    assert.ok(digestion);
    assert.ok(
      knees!.sampleConditions.every((c) => !/pregnan/i.test(c)),
      "Pregnancy notes must not live under Knees",
    );
    assert.ok(pregnancy!.sampleConditions.some((c) => /pregnan/i.test(c)));
    assert.ok(standing!.sampleConditions.some((c) => /standing|seated/i.test(c)));
    assert.ok(digestion!.sampleConditions.some((c) => /diarrh/i.test(c)));
    assert.ok(!standing!.sampleConditions.some((c) => /diarrh/i.test(c)));
  });

  it("does not load base Cat–Cow media for the fist/forearm adaptation", () => {
    const catCow = instructorPoseBySlug("marjaryasana-bitilasana")!;
    const teaching = resolveTeachingVariant(catCow, "beginner", "wrist_fist_catcow");
    assert.equal(teaching.media.kind, "missing");
    assert.equal(teaching.media.videoMp4 ?? null, null);
    assert.equal(teaching.media.videoWebm ?? null, null);
    assert.equal(teaching.media.poster ?? null, null);
    assert.match(teaching.media.label, /unavailable|fist|forearm/i);
    assert.ok(!/marjaryasana-bitilasana\.(webm|mp4)/.test(JSON.stringify(teaching.media)));
  });
});
