import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asanaBySlug } from "../data/content.ts";
import { QUICK_SESSIONS } from "../data/quickSessions.ts";
import { WARMUP } from "../data/content.ts";
import {
  equipmentSentence,
  poseEquipment,
  sessionEquipment,
} from "./sessionEquipment.ts";
import {
  buildSessionPreflight,
  preflightSpecLine,
  sessionDifficulty,
  sessionIntensity,
  type PreflightPose,
} from "./sessionPreflight.ts";

const asana = (slug: string) => {
  const a = asanaBySlug(slug);
  assert.ok(a, `missing ${slug}`);
  return a!;
};

const queue = (slugs: string[]): PreflightPose[] =>
  slugs.map((slug) => ({ ...asana(slug), holdSeconds: asana(slug).holdSeconds }));

describe("equipment read from the instructions", () => {
  it("a step you cannot follow without the prop is required", () => {
    // "Sit beside a chair, then lie back and swing the calves onto the seat."
    assert.deepEqual(poseEquipment(asana("chair-viparita-karani")).required, [
      { options: ["chair"] },
    ]);
    // "Sit sideways against a wall…" — the wall is the pose.
    assert.deepEqual(poseEquipment(asana("viparita-karani")).required, [
      { options: ["wall"] },
    ]);
  });

  it("a prop offered as one option among several is not required", () => {
    // "Hold the shins, feet, or a strap."
    const p = poseEquipment(asana("paschimottanasana"));
    assert.deepEqual(p.required, []);
    assert.ok(p.optional.includes("strap"));
  });

  it("'if needed' means not needed", () => {
    // "…sitting between the heels on a block if needed."
    const p = poseEquipment(asana("vajrasana"));
    assert.deepEqual(p.required, []);
    assert.ok(p.optional.includes("block"));
  });

  it("props named only in modifications stay optional", () => {
    const p = poseEquipment(asana("savasana"));
    assert.deepEqual(p.required, []);
    assert.ok(p.optional.includes("bolster"));
  });

  it("a pose named after furniture does not ask for furniture", () => {
    // "Bend the knees into Chair Pose, weight in the heels…"
    const p = poseEquipment(asana("parivrtta-utkatasana"));
    assert.equal(
      p.required.some((c) => c.options.includes("chair")),
      false,
    );
  });

  it("either prop satisfies one requirement, not two", () => {
    // "Kneel and place a bolster or stack of pillows lengthwise…" plus a later
    // "Arms can wrap the bolster" — one thing to fetch, two ways to fetch it.
    assert.deepEqual(poseEquipment(asana("salamba-balasana")).required, [
      { options: ["bolster", "pillow"] },
    ]);
  });

  it("'I'm tired' discloses its chair and its bolster before you lie down", () => {
    const tired = QUICK_SESSIONS.find((q) => q.id === "tired")!;
    const eq = sessionEquipment(tired.poses.map((p) => asana(p.slug)));
    const sentence = equipmentSentence(eq.required);
    assert.match(sentence, /chair/);
    assert.match(sentence, /bolster|pillow/);
    assert.deepEqual(
      eq.requiredBy.map((r) => r.slug).sort(),
      ["chair-viparita-karani", "salamba-balasana"],
    );
  });
});

describe("preflight facts come from the queue", () => {
  it("names the hardest level present, not the average", () => {
    const d = sessionDifficulty([asana("balasana"), asana("bakasana")]);
    assert.equal(d.level, "Advanced");
    assert.equal(d.total, 2);
  });

  it("separates effort from skill", () => {
    const gentle = sessionIntensity(queue(["balasana", "savasana", "constructive-rest"]));
    assert.equal(gentle.level, "Gentle");
    const strong = sessionIntensity(
      queue(["virabhadrasana-ii", "utkatasana", "adho-mukha-svanasana", "tadasana"]),
    );
    assert.equal(strong.level, "Strong");
  });

  it("the spec line is the length the chosen mode will run", () => {
    const poses = queue(["salamba-balasana", "chair-viparita-karani"]);
    const guided = buildSessionPreflight({ poses, mode: "guided" });
    const brief = buildSessionPreflight({ poses, mode: "brief" });
    assert.ok(guided.totalSeconds > brief.totalSeconds);
    assert.match(preflightSpecLine(guided), /Beginner/);
    assert.match(preflightSpecLine(guided), /Gentle/);
  });

  it("offers a prop-free swap only where one has been reviewed", () => {
    const p = buildSessionPreflight({ poses: queue(["salamba-balasana", "balasana"]) });
    assert.deepEqual(
      p.equipmentAlternatives.map((a) => [a.slug, a.swapToSlug]),
      [["salamba-balasana", "balasana"]],
    );
  });

  it("admits when nothing in the queue has a reviewed movement demo", () => {
    const p = buildSessionPreflight({ poses: queue(["balasana"]) });
    assert.equal(p.usesStaticReference, true);
  });

  it("carries the fit explanation when a requested length cannot be met", () => {
    const poses = queue(["tadasana", "balasana", "savasana", "uttanasana", "vrksasana"]);
    const p = buildSessionPreflight({ poses, mode: "guided", requestedMinutes: 3 });
    assert.ok(p.fit);
    assert.equal(p.fit!.fits, false);
    assert.ok(p.fit!.explanation);
  });
});

describe("intensity is effort, weighted by time spent", () => {
  const warmup = () =>
    WARMUP.steps.map((s) => {
      const a = asana(s.asanaSlug);
      return { ...a, holdSeconds: s.holdSeconds, sides: s.sides };
    });

  it("does not call the warm-up a strong practice", () => {
    // Half its poses are Standing, which a headcount read as "Strong" — for a
    // minute of Cat/Cow, twenty seconds of Bird Dog and a Low Lunge.
    assert.notEqual(sessionIntensity(warmup()).level, "Strong");
  });

  it("a long final rest does not erase the class that preceded it", () => {
    const withoutRest = queue(["virabhadrasana-ii", "utkatasana", "adho-mukha-svanasana"]);
    const withRest = [...withoutRest, { ...asana("savasana"), holdSeconds: 300 }];
    assert.equal(sessionIntensity(withRest).level, sessionIntensity(withoutRest).level);
  });

  it("holding a demanding shape longer makes a practice stronger", () => {
    const brief = [{ ...asana("virabhadrasana-ii"), holdSeconds: 15 }, { ...asana("savasana"), holdSeconds: 90 }];
    const long = [{ ...asana("virabhadrasana-ii"), holdSeconds: 90 }, { ...asana("savasana"), holdSeconds: 90 }];
    const order = { Gentle: 0, Moderate: 1, Strong: 2 } as const;
    assert.ok(
      order[sessionIntensity(long).level] >= order[sessionIntensity(brief).level],
      "a longer hold in the same pose should never read as gentler",
    );
  });
});
