import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BREATHING, breathBySlug } from "@/data/content";
import { breathHasAlignedRecording, breathIsLocked } from "./breathLibrary.ts";

const REQUIRED = [
  "dirga",
  "nadi-shodhana",
  "ujjayi",
  "bhramari",
  "sama-vritti",
  "four-seven-eight",
  "sitali",
  "kapalabhati",
  "bhastrika",
];

describe("pranayama library", () => {
  it("includes the practices, each with steps, a safety note, and who should avoid", () => {
    for (const slug of REQUIRED) {
      const breath = breathBySlug(slug);
      assert.ok(breath, slug);
      assert.ok(breath.steps.length >= 3, slug);
      assert.ok(breath.safety.length > 20, slug);
      assert.ok(breath.avoid.length > 20, slug);
      assert.equal(breath.benefits.length, 3, slug);
      assert.ok(breath.phases.every((p) => p.seconds > 0), slug);
    }
  });

  it("describes Dirga as three parts in and three parts out", () => {
    const dirga = breathBySlug("dirga")!;
    assert.deepEqual(
      dirga.phases.map((p) => p.label),
      [
        "Inhale — belly",
        "Inhale — ribs",
        "Inhale — chest",
        "Exhale — chest",
        "Exhale — ribs",
        "Exhale — belly",
      ],
    );
  });

  it("keeps Sama Vritti equal and without holds, and does not call box breathing Sama Vritti", () => {
    const sama = breathBySlug("sama-vritti")!;
    assert.deepEqual(
      sama.phases.map((p) => p.seconds),
      [4, 4],
    );
    assert.equal(sama.phases.some((p) => /hold/i.test(p.label)), false);
    const box = breathBySlug("box-breathing")!;
    assert.equal(box.sanskrit, undefined);
    assert.match(box.description, /not Sama Vritti/);
  });

  it("teaches Nadi Shodhana as one round of both sides and no retention", () => {
    const nadi = breathBySlug("nadi-shodhana")!;
    assert.deepEqual(
      nadi.phases.map((p) => p.label),
      ["Inhale left", "Exhale right", "Inhale right", "Exhale left"],
    );
    assert.equal(nadi.phases.some((p) => /hold/i.test(p.label)), false);
  });

  it("gates Kapalabhati and Bhastrika, and says who should avoid them", () => {
    for (const slug of ["kapalabhati", "bhastrika"]) {
      const breath = breathBySlug(slug)!;
      assert.equal(breath.level, "experienced");
      assert.match(breath.avoid, /pregnant/i);
      assert.match(breath.avoid, /blood pressure/i);
      assert.match(breath.safety, /Stop/i);
      assert.equal(breathIsLocked(breath, "new"), true);
      assert.equal(breathIsLocked(breath, null), true);
      assert.equal(breathIsLocked(breath, "some"), false);
      assert.equal(breathIsLocked(breath, "regular"), false);
    }
    assert.equal(breathIsLocked(breathBySlug("dirga")!, "new"), false);
  });

  it("does not offer a recording that no longer matches the timer", () => {
    assert.equal(breathHasAlignedRecording("ujjayi"), true);
    assert.equal(breathHasAlignedRecording("nadi-shodhana"), false);
    assert.equal(breathHasAlignedRecording("dirga"), false);
    assert.equal(breathHasAlignedRecording("bhastrika"), false);
    assert.equal(BREATHING.length >= REQUIRED.length, true);
  });
});
