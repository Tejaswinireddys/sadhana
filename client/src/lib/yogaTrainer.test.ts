import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeTrainerSession, NEED_OPTIONS, SEQUENCES, poseArcRank, isStandingBuild, standingFloorFor } from "./yogaTrainer";
import { asanaBySlug } from "@/data/content";
import { profileById } from "@/data/profiles";

const base = {
  body: ["Great"],
  soreParts: [] as string[],
  energy: "Balanced",
  timeMinutes: 15,
  need: "movement",
};

describe("composeTrainerSession — honors the stated need", () => {
  it("returns a strength practice for an injured user who asked for strength", () => {
    // The original P0: "Injured" replaced the whole sequence with a fixed
    // restorative list, so a strength request came back as six rest poses.
    const s = composeTrainerSession(
      { ...base, body: ["Injured"], soreParts: ["Lower back"], energy: "Low", need: "strength" },
      { preferSlugs: profileById("mens-strength")?.recommendedAsanas, audience: "Men" },
    );
    assert.equal(s.requestedNeed, "strength");
    assert.equal(s.deliveredNeed, "strength");
    const onTheme = s.poses.filter((p) => SEQUENCES.strength.includes(p.slug));
    assert.ok(onTheme.length >= 2, `expected strength poses, got ${s.poses.map((p) => p.slug)}`);
  });

  it("honors every need for a healthy practitioner", () => {
    for (const { id } of NEED_OPTIONS) {
      const s = composeTrainerSession({ ...base, need: id });
      assert.equal(s.deliveredNeed, id, `need ${id} was not delivered`);
      assert.equal(s.adjustments.length, 0, `need ${id} reported adjustments unexpectedly`);
    }
  });

  it("never silently substitutes — a changed focus always carries an explanation", () => {
    const s = composeTrainerSession({
      ...base,
      body: ["Injured"],
      soreParts: ["Knees"],
      energy: "Low",
      need: "sleep",
    });
    if (s.deliveredNeed !== s.requestedNeed) {
      assert.ok(s.adjustments.length > 0, "focus changed with no explanation");
    }
  });

  it("keeps a downgraded session genuinely restful", () => {
    const s = composeTrainerSession({
      ...base,
      body: ["Injured"],
      soreParts: ["Knees"],
      energy: "Low",
      need: "sleep",
    });
    if (s.deliveredNeed === "restorative") {
      for (const p of s.poses) {
        const pose = asanaBySlug(p.slug)!;
        assert.notEqual(pose.difficulty, "Advanced", `${p.slug} is not restorative`);
      }
    }
  });
});

describe("composeTrainerSession — safety", () => {
  it("drops poses that load a reported sore region", () => {
    const s = composeTrainerSession({ ...base, soreParts: ["Wrists"], need: "strength" });
    assert.ok(!s.poses.some((p) => p.slug === "kumbhakasana"));
    assert.ok(!s.poses.some((p) => p.slug === "adho-mukha-svanasana"));
  });

  it("explains what it removed", () => {
    const s = composeTrainerSession({ ...base, soreParts: ["Wrists"], need: "strength" });
    assert.ok(s.adjustments.some((a) => /wrists/i.test(a)));
  });
});

describe("composeTrainerSession — profile / audience", () => {
  it("does not serve pregnancy-framed copy to a non-pregnancy profile", () => {
    for (const { id } of NEED_OPTIONS) {
      for (const audience of ["Men", "Women", "All"] as const) {
        const s = composeTrainerSession(
          { ...base, body: ["Injured"], soreParts: ["Lower back"], need: id },
          { audience },
        );
        for (const p of s.poses) {
          assert.ok(
            !/pregnan|trimester|prenatal/i.test(p.why),
            `${audience}/${id}: "${p.why}" leaked to the wrong audience`,
          );
        }
      }
    }
  });

  it("excludes pregnancy-contraindicated shapes on the pregnancy path", () => {
    for (const { id } of NEED_OPTIONS) {
      const s = composeTrainerSession(
        { ...base, need: id },
        { preferSlugs: profileById("pregnancy")?.recommendedAsanas, audience: "Pregnancy" },
      );
      for (const p of s.poses) {
        const pose = asanaBySlug(p.slug)!;
        assert.notEqual(pose.category, "Inversions", `${p.slug} is an inversion`);
      }
      assert.ok(s.poses.length > 0, `pregnancy/${id} produced an empty session`);
    }
  });

  it("lets profile poses flavour a session without hijacking its focus", () => {
    const s = composeTrainerSession(
      { ...base, need: "sleep" },
      { preferSlugs: profileById("mens-strength")?.recommendedAsanas, audience: "Men" },
    );
    assert.equal(s.deliveredNeed, "sleep");
    // A restful session must not open on a standing or load-bearing shape.
    const opener = asanaBySlug(s.poses[0].slug)!;
    assert.notEqual(opener.category, "Standing", `opened on ${s.poses[0].slug}`);
  });
});

const CLOSING = [
  "savasana",
  "parsva-savasana",
  "constructive-rest",
  "viparita-karani",
  "chair-viparita-karani",
  "balasana",
  "salamba-balasana",
];
const LOADED = [
  "kumbhakasana",
  "utkatasana",
  "navasana",
  "ardha-navasana",
  "vasisthasana",
  "chaturanga-dandasana",
  "virabhadrasana-ii",
];

describe("composeTrainerSession — hold times and arc", () => {
  it("never prescribes a load-bearing hold longer than 60s", () => {
    // The report: a 30-minute strength sequence assigned 2m30s to every pose,
    // Plank and Chair included, to someone whose onboarding said "new".
    for (const minutes of [5, 10, 15, 20, 30]) {
      for (const experience of ["new", "some", "regular"] as const) {
        const s = composeTrainerSession(
          { ...base, timeMinutes: minutes, need: "strength" },
          { experience },
        );
        for (const p of s.poses) {
          if (LOADED.includes(p.slug)) {
            assert.ok(
              p.holdSeconds <= 60,
              `${p.slug} held ${p.holdSeconds}s at ${minutes}min/${experience}`,
            );
          }
        }
      }
    }
  });

  it("gives a beginner shorter effort holds than a regular practitioner", () => {
    const forNew = composeTrainerSession({ ...base, need: "strength" }, { experience: "new" });
    const forRegular = composeTrainerSession(
      { ...base, need: "strength" },
      { experience: "regular" },
    );
    const plank = (s: typeof forNew) => s.poses.find((p) => p.slug === "kumbhakasana")?.holdSeconds;
    if (plank(forNew) && plank(forRegular)) {
      assert.ok(plank(forNew)! < plank(forRegular)!, "beginner hold was not shorter");
    }
  });

  it("actually closes in rest, as the reasoning claims", () => {
    for (const minutes of [5, 10, 15, 20, 30]) {
      for (const { id } of NEED_OPTIONS) {
        const s = composeTrainerSession({ ...base, timeMinutes: minutes, need: id });
        const last = s.poses[s.poses.length - 1];
        assert.ok(
          CLOSING.includes(last.slug),
          `${minutes}min/${id} ended on ${last.slug}, not a rest pose`,
        );
        assert.match(s.reasoning, /closes in rest|closing in rest/);
      }
    }
  });

  it("does not open a session on its peak pose", () => {
    const s = composeTrainerSession({ ...base, timeMinutes: 30, need: "strength" });
    assert.ok(!LOADED.includes(s.poses[0].slug), `opened on ${s.poses[0].slug}`);
  });

  it("delivers close to the requested length, or says why not", () => {
    for (const minutes of [10, 20, 30]) {
      for (const { id } of NEED_OPTIONS) {
        const s = composeTrainerSession(
          { ...base, timeMinutes: minutes, need: id },
          { experience: "new" },
        );
        const short = s.totalMinutes < minutes - 3;
        if (short) {
          assert.ok(
            s.adjustments.some((a) => /minutes rather than/.test(a)),
            `${minutes}min/${id} delivered ${s.totalMinutes} with no explanation`,
          );
        }
      }
    }
  });
});

describe("composeTrainerSession — reasoning copy", () => {
  it("reads as a whole sentence when no sore area is given", () => {
    // Was: "with 30 minutes for strength, I've shaped a sequence…"
    const s = composeTrainerSession({ ...base, timeMinutes: 30, need: "strength" });
    assert.match(s.reasoning, /^[A-Z]/, `reasoning started mid-clause: "${s.reasoning}"`);
    assert.ok(!s.reasoning.startsWith("with "), "reasoning still starts with a dangling clause");
  });

  it("reads as a whole sentence when sore areas are given", () => {
    const s = composeTrainerSession({ ...base, soreParts: ["Hips"], need: "flexibility" });
    assert.match(s.reasoning, /^Because your hips/);
  });
});

describe("composeTrainerSession — regenerate variants", () => {
  it("keeps variant 0 identical to the default authored order", () => {
    const unset = composeTrainerSession({ ...base, need: "movement" });
    const v0 = composeTrainerSession({ ...base, need: "movement" }, { variant: 0 });
    assert.deepEqual(
      v0.poses.map((p) => p.slug),
      unset.poses.map((p) => p.slug),
    );
  });

  it("changes order or poses when variant is greater than 0", () => {
    const v0 = composeTrainerSession({ ...base, need: "movement" }, { variant: 0 });
    const v1 = composeTrainerSession({ ...base, need: "movement" }, { variant: 1 });
    assert.notDeepEqual(
      v1.poses.map((p) => p.slug),
      v0.poses.map((p) => p.slug),
    );
  });

  it("keeps the warm-up → build → peak → cool-down → rest arc on every variant", () => {
    for (const { id } of NEED_OPTIONS) {
      for (const variant of [0, 1, 2, 3]) {
        const s = composeTrainerSession({ ...base, timeMinutes: 20, need: id }, { variant });
        const ranks = s.poses.map((p) => poseArcRank(p.slug));
        for (let i = 1; i < ranks.length; i++) {
          assert.ok(
            ranks[i]! >= ranks[i - 1]!,
            `${id} v${variant} broke the arc: ${s.poses.map((p) => p.slug).join(" → ")}`,
          );
        }
        assert.ok(
          CLOSING.includes(s.poses[s.poses.length - 1]!.slug),
          `${id} v${variant} ended on ${s.poses[s.poses.length - 1]!.slug}`,
        );
      }
    }
  });

  it("never opens a calm practice on a closing twist", () => {
    for (const variant of [0, 1, 2, 3, 4]) {
      const s = composeTrainerSession({ ...base, need: "calm" }, { variant });
      assert.notEqual(s.poses[0]!.slug, "supta-matsyendrasana", `v${variant} opened on Supine Twist`);
      const twist = s.poses.findIndex((p) => p.slug === "supta-matsyendrasana");
      const seat = s.poses.findIndex((p) => p.slug === "sukhasana");
      if (twist >= 0 && seat >= 0) {
        assert.ok(seat < twist, `Easy Seat after twist in v${variant}`);
      }
    }
  });

  it("gives a longer calm request more poses, not the same five stretched", () => {
    const short = composeTrainerSession({ ...base, timeMinutes: 10, need: "calm" });
    const long = composeTrainerSession({ ...base, timeMinutes: 25, need: "calm" });
    assert.ok(
      long.poses.length > short.poses.length,
      `10min had ${short.poses.length} poses, 25min had ${long.poses.length}`,
    );
    assert.ok(long.totalMinutes >= 22, `25min calm composed ${long.totalMinutes}`);
  });
});

describe("composeTrainerSession — a steady practice stands up", () => {
  it("meets the standing-pose floor in slot 2 for movement at every duration", () => {
    for (const minutes of [10, 15, 20, 25]) {
      for (const variant of [0, 1, 2]) {
        const s = composeTrainerSession(
          { ...base, timeMinutes: minutes, need: "movement" },
          { variant },
        );
        const standing = s.poses.filter((p) => isStandingBuild(p.slug));
        const floor = standingFloorFor(minutes);
        assert.ok(
          standing.length >= floor,
          `${minutes}min v${variant} had ${standing.length} standing build poses, need ${floor}: ${s.poses.map((p) => `${p.slug}:${p.arcSlot}`).join(", ")}`,
        );
        assert.ok(
          standing.every((p) => p.arcSlot === 2),
          `${minutes}min v${variant} standing work left slot 2: ${standing.map((p) => `${p.slug}:${p.arcSlot}`).join(", ")}`,
        );
        const slots = s.poses.map((p) => p.arcSlot);
        const firstStanding = slots.findIndex((slot) => slot === 2);
        const firstPeak = slots.findIndex((slot) => slot === 3);
        const lastWarmup = slots.lastIndexOf(1);
        if (firstStanding >= 0 && lastWarmup >= 0) {
          assert.ok(firstStanding > lastWarmup, `${minutes}min v${variant} standing before warm-up`);
        }
        if (firstStanding >= 0 && firstPeak >= 0) {
          assert.ok(firstStanding < firstPeak, `${minutes}min v${variant} standing after peak`);
        }
        assert.equal(s.standingExclusion, null);
      }
    }
  });
});

function assertArcShape(
  poses: { slug: string; arcSlot?: number }[],
  label: string,
) {
  const slots = poses.map((p) => p.arcSlot ?? poseArcRank(p.slug));
  for (let i = 1; i < slots.length; i++) {
    assert.ok(
      slots[i]! >= slots[i - 1]!,
      `${label} slot order broke: ${poses.map((p, j) => `${p.slug}:${slots[j]}`).join(" → ")}`,
    );
  }
  const n = poses.length;
  const warmupAt = slots.findIndex((s) => s === 1);
  assert.ok(warmupAt === 1 || warmupAt === 2, `${label} warm-up at position ${warmupAt + 1}, expected 2 or 3`);
  const peakAt = slots.findIndex((s) => s === 3);
  assert.ok(peakAt >= 0, `${label} has no peak`);
  const frac = (peakAt + 1) / n;
  assert.ok(
    frac >= 0.45 && frac <= 0.65,
    `${label} peak at position ${peakAt + 1}/${n} (${frac.toFixed(2)}), expected 45–65%`,
  );
  const lateBeforeEarly = poses.some((_, i) =>
    poses.slice(0, i).some((_, j) => slots[j]! >= 4 && slots[i]! <= 1),
  );
  assert.equal(lateBeforeEarly, false, `${label} placed cool-down/rest before centering/warm-up`);
}

describe("composeTrainerSession — full-plan arc slots", () => {
  it("sorts the generated array by monotonically non-decreasing slot", () => {
    for (const minutes of [10, 15, 20, 25]) {
      for (const { id } of NEED_OPTIONS) {
        for (const variant of [0, 1, 2, 3]) {
          const s = composeTrainerSession({ ...base, timeMinutes: minutes, need: id }, { variant });
          assertArcShape(s.poses, `${minutes}min/${id}/v${variant}`);
          assert.ok(
            s.poses.every((p) => p.arcSlot === poseArcRank(p.slug)),
            `${id} v${variant} pose.arcSlot drifted from catalog`,
          );
        }
      }
    }
  });

  it("never places slot ≥ 4 before slot ≤ 1 across 20 regenerations", () => {
    for (const minutes of [10, 15, 20, 25]) {
      for (let variant = 0; variant < 20; variant++) {
        const s = composeTrainerSession(
          { ...base, timeMinutes: minutes, need: "movement" },
          { variant },
        );
        const slots = s.poses.map((p) => p.arcSlot);
        let seenLate = false;
        for (const slot of slots) {
          if (slot >= 4) seenLate = true;
          if (seenLate && slot <= 1) {
            assert.fail(
              `${minutes}min v${variant} rest before warm-up: ${s.poses.map((p) => `${p.slug}:${p.arcSlot}`).join(" → ")}`,
            );
          }
        }
      }
    }
  });
});
