import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adviseNextSession, scaleHoldSeconds, type SessionOutcome } from "./adaptiveRecovery";
import { generateAdaptiveSession, swapPose } from "./adaptiveGenerator";
import { parseVoiceCommand } from "./voiceControl";
import { PILOT_POSES, manualConfidence, isPilotPose } from "./poseCoach";
import { roleDefaults } from "./household";
import { PATHWAYS, asanaBySlug } from "../data/content";
import { poseArcRank } from "./yogaTrainer";
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
    assert.ok(scaleHoldSeconds(200, 2) <= 300);
  });

  it("treats a first visit as a steady movement practice, not a wind-down", () => {
    const advice = adviseNextSession([]);
    assert.equal(advice.intensity, "steady");
    assert.equal(advice.preferNeed, "movement");
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

  it("eases intensity after a Home mood-session tap persisted as preMood", () => {
    const advice = adviseNextSession([], {
      sessions: [
        { date: "2026-08-27", posesCompleted: 5, posesSkipped: 0, asanas: "[]", preMood: "Tired" },
      ],
      journal: [],
    }, now);
    assert.equal(advice.intensity, "easy");
    assert.equal(advice.energy, "low");
    assert.ok(advice.reasons.some((r) => /tired or stressed/i.test(r)));
  });

  it("treats a conversational Home label on a session as tired too", () => {
    const advice = adviseNextSession([], {
      sessions: [
        { date: "2026-08-27", posesCompleted: 5, posesSkipped: 0, asanas: "[]", preMood: "I'm tired" },
      ],
    }, now);
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

  it("a default steady plan includes standing poses and never opens on a closer", () => {
    const result = generateAdaptiveSession({ intentMinutes: 20 });
    const slugs = result.session.poses.map((p) => p.slug);
    const standing = slugs.filter((s) => asanaBySlug(s)?.category === "Standing");
    assert.ok(standing.length >= 1, `no standing poses: ${slugs.join(", ")}`);
    assert.notEqual(slugs[0], "supta-matsyendrasana");
    assert.ok(poseArcRank(slugs[0]!) <= 1, `opened on ${slugs[0]} (arc ${poseArcRank(slugs[0]!)})`);
    for (let i = 1; i < slugs.length; i++) {
      assert.ok(
        poseArcRank(slugs[i]!) >= poseArcRank(slugs[i - 1]!),
        `arc broke: ${slugs.join(" → ")}`,
      );
    }
  });

  it("regenerate keeps closers at the end", () => {
    for (const variant of [0, 1, 2, 3]) {
      const result = generateAdaptiveSession({ intentMinutes: 20, variant });
      const slugs = result.session.poses.map((p) => p.slug);
      assert.notEqual(slugs[0], "supta-matsyendrasana", `v${variant} opened on Supine Twist`);
      const ranks = slugs.map(poseArcRank);
      for (let i = 1; i < ranks.length; i++) {
        assert.ok(ranks[i]! >= ranks[i - 1]!, `v${variant} arc: ${slugs.join(" → ")}`);
      }
    }
  });

  it("sorts the whole plan by arc slot, not just the closing bucket", () => {
    for (const minutes of [10, 15, 20, 25]) {
      for (let variant = 0; variant < 20; variant++) {
        for (const need of ["movement", "calm"] as const) {
          const result = generateAdaptiveSession({ intentMinutes: minutes, need, variant });
          const poses = result.session.poses;
          const slots = poses.map((p) => p.arcSlot ?? poseArcRank(p.slug));
          for (let i = 1; i < slots.length; i++) {
            assert.ok(
              slots[i]! >= slots[i - 1]!,
              `${minutes}min ${need} v${variant} not monotonic: ${poses.map((p, j) => `${p.slug}:${slots[j]}`).join(" → ")}`,
            );
          }
          let seenLate = false;
          for (let i = 0; i < slots.length; i++) {
            if (slots[i]! >= 4) seenLate = true;
            if (seenLate && slots[i]! <= 1) {
              assert.fail(
                `${minutes}min ${need} v${variant} slot ≥4 before slot ≤1: ${poses.map((p) => p.slug).join(" → ")}`,
              );
            }
          }
          const warmupAt = slots.findIndex((s) => s === 1);
          assert.ok(
            warmupAt === 1 || warmupAt === 2,
            `${minutes}min ${need} v${variant} warm-up at ${warmupAt + 1}`,
          );
          const peakAt = slots.findIndex((s) => s === 3);
          assert.ok(peakAt >= 0, `${minutes}min ${need} v${variant} has no peak`);
          const frac = (peakAt + 1) / poses.length;
          assert.ok(
            frac >= 0.45 && frac <= 0.65,
            `${minutes}min ${need} v${variant} peak at ${peakAt + 1}/${poses.length} (${frac.toFixed(2)})`,
          );
        }
      }
    }
  });

  it("does not silently shorten a length the practitioner picked", () => {
    const result = generateAdaptiveSession({
      intentMinutes: 20,
      adviceOverride: {
        intensity: "easy",
        holdScale: 0.85,
        preferNeed: "calm",
        maxMinutes: 15,
        reasons: ["Several poses were skipped recently — easing intensity."],
        headline: "An easier practice to rebuild momentum",
      },
    });
    assert.ok(
      result.explanations.some((e) => /Target about 20 minutes/.test(e)),
      result.explanations.join(" | "),
    );
    assert.ok(!result.explanations.some((e) => /Target about 15 minutes/.test(e)));
    assert.ok(
      result.session.totalMinutes >= 17,
      `easing capped a 20-minute request to ${result.session.totalMinutes}`,
    );

    const recover = generateAdaptiveSession({
      intentMinutes: 20,
      energy: "low",
      adviceOverride: {
        intensity: "recover",
        holdScale: 0.7,
        preferNeed: "calm",
        maxMinutes: 12,
        reasons: ["Last effort was RPE 9/10 — choosing recovery."],
        headline: "A gentle recovery session",
        energy: "low",
      },
    });
    assert.ok(
      recover.explanations.some((e) => /Target about 20 minutes/.test(e)),
      recover.explanations.join(" | "),
    );
    assert.ok(
      recover.session.totalMinutes >= 17,
      `recovery capped a 20-minute request to ${recover.session.totalMinutes}`,
    );
  });

  it("honors every duration chip even when easing suggested 15", () => {
    const easy = {
      intensity: "easy" as const,
      holdScale: 0.85,
      preferNeed: "calm",
      maxMinutes: 15,
      reasons: ["Several poses were skipped recently — easing intensity."],
      headline: "An easier practice to rebuild momentum",
    };
    const byLength = new Map<number, string>();
    for (const mins of [10, 15, 20, 25]) {
      const result = generateAdaptiveSession({ intentMinutes: mins, adviceOverride: easy });
      assert.ok(
        result.explanations.some((e) => new RegExp(`Target about ${mins} minutes`).test(e)),
        `${mins} min chip: ${result.explanations.join(" | ")}`,
      );
      assert.ok(
        !result.explanations.some((e) => /Target about 15 minutes/.test(e)) || mins === 15,
        `${mins} min chip still advertised 15: ${result.explanations.join(" | ")}`,
      );
      assert.ok(
        result.session.totalMinutes >= mins - 3,
        `${mins} min chip composed ${result.session.totalMinutes}`,
      );
      if (mins > easy.maxMinutes) {
        assert.ok(
          result.explanations.some((e) => /keeping the \d+ you picked/.test(e)),
          `${mins} min chip did not explain it ignored the 15-min suggestion`,
        );
      }
      byLength.set(mins, result.session.poses.map((p) => `${p.slug}:${p.holdSeconds}`).join(","));
    }
    assert.notEqual(byLength.get(15), byLength.get(20), "20 min matched the 15-minute plan");
    assert.notEqual(byLength.get(20), byLength.get(25), "25 min matched the 20-minute plan");
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
