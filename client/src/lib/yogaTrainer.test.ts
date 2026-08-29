import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeTrainerSession, NEED_OPTIONS, SEQUENCES } from "./yogaTrainer";
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
});
