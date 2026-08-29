import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adviseNextSession, scaleHoldSeconds, type SessionOutcome } from "./adaptiveRecovery";
import { generateAdaptiveSession, swapPose } from "./adaptiveGenerator";
import { parseVoiceCommand } from "./voiceControl";
import { PILOT_POSES, manualConfidence, isPilotPose } from "./poseCoach";
import { roleDefaults } from "./household";
import { PATHWAYS, asanaBySlug } from "../data/content";
import { profileById } from "../data/profiles";

function outcome(partial: Partial<SessionOutcome>): SessionOutcome {
  return {
    at: new Date().toISOString(),
    rpe: 5,
    skipRate: 0,
    minutes: 15,
    ...partial,
  };
}

describe("adaptive recovery", () => {
  it("chooses recovery after very high RPE", () => {
    const advice = adviseNextSession([outcome({ rpe: 9 })]);
    assert.equal(advice.intensity, "recover");
    assert.ok(advice.holdScale < 1);
  });

  it("scales holds within bounds", () => {
    assert.equal(scaleHoldSeconds(40, 0.5), 20);
    assert.ok(scaleHoldSeconds(200, 2) <= 180);
  });
});

describe("adaptive recovery — practice history", () => {
  const now = new Date(2026, 7, 28, 12);

  it("does not claim empty effort when sessions exist", () => {
    const advice = adviseNextSession([], {
      sessions: [
        { date: "2026-08-26", posesCompleted: 6, posesSkipped: 0, asanas: "[]" },
        { date: "2026-08-27", posesCompleted: 5, posesSkipped: 1, asanas: "[]" },
        { date: "2026-08-28", posesCompleted: 7, posesSkipped: 0, asanas: "[]" },
      ],
      journal: [],
    }, now);
    assert.ok(!/No recent effort data/i.test(advice.reasons.join(" ")));
    assert.match(advice.reasons.join(" "), /3 sessions recently/);
  });

  it("names skipped hip openers in plain language", () => {
    const hips = JSON.stringify(["Pigeon Pose", "Child's Pose"]);
    const advice = adviseNextSession([], {
      sessions: [
        { date: "2026-08-24", posesCompleted: 4, posesSkipped: 2, asanas: hips },
        { date: "2026-08-26", posesCompleted: 3, posesSkipped: 1, asanas: hips },
        { date: "2026-08-28", posesCompleted: 6, posesSkipped: 0, asanas: "[]" },
      ],
    }, now);
    assert.ok(
      advice.reasons.some((r) => /skipped hip openers twice this week/i.test(r)),
      advice.reasons.join(" | "),
    );
    assert.deepEqual(advice.soreParts, ["Hips"]);
  });

  it("eases intensity after a tired journal note", () => {
    const advice = adviseNextSession([], {
      sessions: [{ date: "2026-08-27", posesCompleted: 5, posesSkipped: 0, asanas: "[]" }],
      journal: [{ date: "2026-08-27", mood: "Tired" }],
    }, now);
    assert.equal(advice.intensity, "easy");
    assert.equal(advice.energy, "low");
    assert.ok(advice.reasons.some((r) => /tired or stressed/i.test(r)));
  });
});

describe("adaptive generator", () => {
  it("returns an explainable session with poses", () => {
    const result = generateAdaptiveSession({ intentMinutes: 15, need: "calm" });
    assert.ok(result.session.poses.length >= 3);
    assert.ok(result.explanations.length > 0);
    assert.ok(result.session.reasoning.length > 0);
  });

  it("can swap a pose", () => {
    const result = generateAdaptiveSession({ intentMinutes: 12, need: "calm" });
    const from = result.session.poses[0]!.slug;
    const swapped = swapPose(result.session, from, "balasana");
    assert.ok(swapped);
    assert.ok(swapped!.session.poses.some((p) => p.slug === "balasana"));
  });

  it("reshuffles within the arc when variant changes", () => {
    const a = generateAdaptiveSession({ intentMinutes: 20, need: "movement", variant: 0 });
    const b = generateAdaptiveSession({ intentMinutes: 20, need: "movement", variant: 1 });
    const key = (r: typeof a) => r.session.poses.map((p) => p.slug).join(",");
    assert.notEqual(key(a), key(b), `variant 1 matched variant 0: ${key(a)}`);
  });
});

describe("voice control", () => {
  it("parses core commands", () => {
    assert.equal(parseVoiceCommand("please pause now"), "pause");
    assert.equal(parseVoiceCommand("skip to the next pose"), "skip");
    assert.equal(parseVoiceCommand("go slower"), "slower");
    assert.equal(parseVoiceCommand("hello there"), null);
  });
});

describe("pose coach pilot", () => {
  it("covers ten foundational poses", () => {
    assert.equal(PILOT_POSES.length, 10);
    assert.ok(isPilotPose("tadasana"));
  });

  it("reports manual checklist confidence", () => {
    const fb = manualConfidence([true, true, false], 3);
    assert.ok(fb.confidence > 0.5 && fb.confidence < 1);
    assert.equal(fb.mode, "manual");
  });
});

describe("household roles", () => {
  it("maps prenatal and senior to safe hints", () => {
    assert.match(roleDefaults("prenatal").note, /Pregnancy/i);
    assert.match(roleDefaults("senior").pathwayHint, /chair/);
  });
});

describe("special population content", () => {
  it("includes prenatal week with real poses", () => {
    const p = PATHWAYS.find((x) => x.slug === "prenatal-gentle-week");
    assert.ok(p);
    for (const day of p!.dailyPlan ?? []) {
      for (const pose of day.poses) {
        assert.ok(asanaBySlug(pose.asanaSlug), pose.asanaSlug);
      }
    }
  });

  it("includes postnatal and senior profiles", () => {
    assert.ok(profileById("postnatal"));
    assert.ok(profileById("senior-mobility"));
  });
});
