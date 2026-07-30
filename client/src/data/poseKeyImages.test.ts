/**
 * Guards that pose demos show the correct asana — never another pose's artwork
 * at idle or at the peak narration step.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ASANAS } from "./content.ts";
import { humanStepSlug, poseHasShapeJourney } from "./poseKeyImages.ts";

describe("humanStepSlug — correct pose demos", () => {
  it("keeps this pose's illustration when the step key matches the asana key", () => {
    assert.equal(humanStepSlug("vrksasana", "tree", "tree"), "vrksasana");
    assert.equal(humanStepSlug("tadasana", "mountain", "mountain"), "tadasana");
    assert.equal(humanStepSlug("balasana", "child", "child"), "balasana");
  });

  it("crossfades only for a deliberate different entry shape", () => {
    assert.equal(humanStepSlug("vrksasana", "tree", "mountain"), "tadasana");
    assert.equal(humanStepSlug("virabhadrasana-i", "warrior-1", "low-lunge"), "anjaneyasana");
  });

  it("never remaps when the mapped slug is this pose", () => {
    assert.equal(humanStepSlug("utthita-parsvakonasana", "side-angle", "side-angle"), "utthita-parsvakonasana");
  });

  it("idle (first step) shows this pose for Tree, Child, Side Angle, Frog, King Pigeon", () => {
    const critical = [
      "vrksasana",
      "balasana",
      "utthita-parsvakonasana",
      "mandukasana",
      "rajakapotasana",
    ];
    for (const slug of critical) {
      const a = ASANAS.find((x) => x.slug === slug);
      assert.ok(a, slug);
      // Idle UI pins to asana.pose — not the first step's entry key.
      assert.equal(
        humanStepSlug(a!.slug, a!.pose, a!.pose),
        slug,
        `${slug} idle must be its own illustration`,
      );
    }
  });

  it("every asana's peak (last) step resolves to its own illustration", () => {
    const wrong: string[] = [];
    for (const a of ASANAS) {
      const last = a.steps[a.steps.length - 1]?.pose;
      const peak = humanStepSlug(a.slug, a.pose, last);
      if (peak !== a.slug) wrong.push(`${a.slug}: last=${last} -> ${peak}`);
    }
    assert.deepEqual(wrong, [], `peak demo wrong:\n${wrong.join("\n")}`);
  });

  it("poseHasShapeJourney detects Tree's mountain → tree path", () => {
    const tree = ASANAS.find((a) => a.slug === "vrksasana")!;
    assert.equal(
      poseHasShapeJourney(
        tree.slug,
        tree.pose,
        tree.steps.map((s) => s.pose),
      ),
      true,
    );
    const mountain = ASANAS.find((a) => a.slug === "tadasana")!;
    assert.equal(
      poseHasShapeJourney(
        mountain.slug,
        mountain.pose,
        mountain.steps.map((s) => s.pose),
      ),
      false,
    );
  });
});
