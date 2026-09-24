/**
 * "No floor required" is a promise. The Chair & Limited Mobility program used
 * to open Day 1 with Legs on a Chair (which starts by lying on the floor) and
 * lean on margin notes like "or sit in a chair" beside poses whose own steps
 * said "sit cross-legged". The player narrates the steps, not the notes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PATHWAYS, asanaBySlug } from "./content.ts";
import { PROFILES } from "./profiles.ts";
import { NO_FLOOR_POSES, isFloorFree, requiresFloor, swapPreservesConstraints } from "./floorAccess.ts";
import { pickEasierSwap } from "../lib/adaptiveGenerator.ts";
import { buildSessionPreflight } from "../lib/sessionPreflight.ts";

const chair = PATHWAYS.find((p) => p.slug === "chair-limited-mobility");

describe("Chair & Limited Mobility is floor-free", () => {
  it("every day contains only chair or standing poses", () => {
    assert.ok(chair?.dailyPlan?.length, "program exists");
    for (const day of chair.dailyPlan!) {
      for (const pose of day.poses) {
        assert.equal(
          requiresFloor(pose.asanaSlug),
          false,
          `Day ${day.day}: ${pose.asanaSlug} needs the floor`,
        );
      }
    }
  });

  it("does not show a generic floor warm-up", () => {
    // The program page no longer mounts the universal warm-up; its own Day
    // opens with a seated arrival pose instead.
    for (const day of chair!.dailyPlan!) {
      const first = day.poses[0]!.asanaSlug;
      assert.ok(first in NO_FLOOR_POSES, `Day ${day.day} opens with ${first}`);
    }
  });

  it("each listed pose really is chair or standing by its own first step", () => {
    for (const [slug, row] of Object.entries(NO_FLOOR_POSES)) {
      const asana = asanaBySlug(slug);
      assert.ok(asana, slug);
      const first = asana.steps[0]?.text ?? "";
      assert.equal(first, row.step, `${slug}: quoted step drifted from the catalog`);
      assert.match(first, row.position === "chair" ? /chair/i : /stand|face a wall/i, slug);
      assert.doesNotMatch(
        asana.steps.map((s) => s.text).join(" "),
        /\b(lie|kneel|all fours|on the mat|to the floor)\b/i,
        `${slug} has a floor step`,
      );
    }
  });

  it("the senior profile recommends only floor-free poses", () => {
    const senior = PROFILES.find((p) => p.id === "senior-mobility");
    assert.ok(senior);
    assert.ok(isFloorFree(senior.recommendedAsanas));
  });

  it("the tagline no longer overclaims beyond what the poses do", () => {
    assert.match(chair!.tagline ?? "", /never get down to the floor/);
  });
});

describe("substitutions preserve the practitioner's constraints", () => {
  it("never raises difficulty", () => {
    // Supported Fish (Beginner) → Fish (Intermediate) used to be offered as a
    // prop-free swap.
    assert.equal(swapPreservesConstraints("salamba-matsyasana", "matsyasana"), false);
    assert.equal(swapPreservesConstraints("salamba-balasana", "balasana"), true);
  });

  it("keeps a floor-free practice off the floor and seated poses seated", () => {
    assert.equal(swapPreservesConstraints("tadasana", "balasana", { keepOffFloor: true }), false);
    assert.equal(
      swapPreservesConstraints("chair-forward-fold", "uttanasana", { keepOffFloor: true }),
      false,
      "standing up is not an easier version of sitting",
    );
    assert.equal(swapPreservesConstraints("tadasana", "womb-seat", { keepOffFloor: true }), true);
  });

  it("the Adaptive Plan's easier swap stays off the floor in a chair session", () => {
    const swap = pickEasierSwap("wall-angel", ["womb-seat", "chair-forward-fold", "wall-angel", "tadasana"]);
    // Both floor-free easy poses are used — no swap beats a floor swap.
    assert.equal(swap, null);
    const swap2 = pickEasierSwap("wall-angel", ["chair-forward-fold", "wall-angel"]);
    assert.equal(swap2, "womb-seat");
  });

  it("the preflight never offers a harder prop-free swap", () => {
    const fish = asanaBySlug("salamba-matsyasana")!;
    const pre = buildSessionPreflight({ poses: [{ ...fish, holdSeconds: 60, sides: "once" }] });
    assert.equal(pre.equipmentAlternatives.some((a) => a.swapToSlug === "matsyasana"), false);
  });
});
