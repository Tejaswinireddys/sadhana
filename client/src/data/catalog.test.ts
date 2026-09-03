/**
 * Catalog integrity — guards the invariants that make a pose feel finished.
 *
 * A pose that ships without its own illustration, variations, stretch zones, or
 * "best for" copy renders as a generic stub, and reusing another pose's artwork
 * makes two different asanas look identical in the library.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ASANAS, CATEGORIES } from "./content.ts";
import {
  CORE_FAMILY_SLUGS,
  SUPINE_PRONE_FAMILY_SLUGS,
  expectedFamily,
  isClassicalAsanaName,
  isSupineOrProneBase,
} from "./poseTaxonomy.ts";
import { EXTRAS } from "./variations.ts";
import { STRETCH_ZONES } from "./zones.ts";
import { BEST_FOR } from "./bestFor.ts";
import { POSE_KEYS } from "../components/PoseSvg.tsx";
import { buildPoseExplanation, cueEchoesSteps } from "../lib/poseExplanation.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const POSE_IMAGE_DIR = path.join(ROOT, "client/public/poses");

const duplicates = <T>(values: T[]): T[] => {
  const seen = new Set<T>();
  const dupes = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
};

test("slugs and names are unique", () => {
  assert.deepEqual(duplicates(ASANAS.map((a) => a.slug)), []);
  assert.deepEqual(duplicates(ASANAS.map((a) => a.english)), []);
  assert.deepEqual(duplicates(ASANAS.map((a) => a.sanskrit)), []);
  assert.deepEqual(duplicates(ASANAS.map((a) => a.summary)), []);
});

test("every pose ships its own illustration", () => {
  const missing = ASANAS.filter((a) => !existsSync(path.join(POSE_IMAGE_DIR, `${a.slug}.png`)));
  assert.deepEqual(missing.map((a) => a.slug), []);

  const bySignature = new Map<string, string[]>();
  for (const asana of ASANAS) {
    const bytes = readFileSync(path.join(POSE_IMAGE_DIR, `${asana.slug}.png`));
    const signature = createHash("md5").update(bytes).digest("hex");
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), asana.slug]);
  }
  const shared = [...bySignature.values()].filter((slugs) => slugs.length > 1);
  assert.deepEqual(shared, [], "poses share the same illustration");
});

test("every pose has authored depth, not fallbacks", () => {
  const withoutExtras = ASANAS.filter((a) => !EXTRAS[a.slug]).map((a) => a.slug);
  const withoutZones = ASANAS.filter((a) => !STRETCH_ZONES[a.slug]).map((a) => a.slug);
  const withoutBestFor = ASANAS.filter((a) => !BEST_FOR[a.slug]).map((a) => a.slug);
  assert.deepEqual(withoutExtras, [], "missing variations / avoidIf");
  assert.deepEqual(withoutZones, [], "missing stretch zones");
  assert.deepEqual(withoutBestFor, [], "missing best-for copy");
});

test("every pose is described, not stubbed", () => {
  const thin = ASANAS.filter(
    (a) =>
      a.summary.length < 40 ||
      a.breathing.length < 20 ||
      a.modifications.length < 20 ||
      a.benefits.length < 2 ||
      a.steps.length < 3 ||
      a.contraindications.length === 0 ||
      a.avoidIf.length === 0,
  ).map((a) => a.slug);
  assert.deepEqual(thin, []);
});

test("step motions cover every step", () => {
  const mismatched = ASANAS.filter((a) => {
    const motions = EXTRAS[a.slug]?.stepMotions;
    return !motions || motions.length !== a.steps.length;
  }).map((a) => a.slug);
  assert.deepEqual(mismatched, []);
});

test("pose and step shape keys resolve to real line art", () => {
  const known = new Set(POSE_KEYS);
  const unknown = new Set<string>();
  for (const asana of ASANAS) {
    if (!known.has(asana.pose)) unknown.add(`${asana.slug}:${asana.pose}`);
    for (const step of asana.steps) {
      if (step.pose && !known.has(step.pose)) unknown.add(`${asana.slug} step:${step.pose}`);
    }
  }
  assert.deepEqual([...unknown], []);
});

test("form cues are pose-specific, not a shared placeholder", () => {
  const placeholder = "Aligned joints|Long spine|Steady gaze";
  const generic = ASANAS.filter(
    (a) => a.variations.intermediate.cues.join("|") === placeholder,
  ).map((a) => a.slug);
  assert.deepEqual(generic, [], "intermediate cues still use the placeholder triplet");

  const bySlug = Object.fromEntries(ASANAS.map((a) => [a.slug, a]));
  const dolphin = bySlug["dolphin-plank"]!;
  const dead = bySlug["dead-bug"]!;
  const table = bySlug["reverse-tabletop"]!;
  assert.notEqual(
    dolphin.variations.intermediate.cues.join("|"),
    dead.variations.intermediate.cues.join("|"),
  );
  assert.notEqual(
    dead.variations.intermediate.cues.join("|"),
    table.variations.intermediate.cues.join("|"),
  );
  assert.ok(
    !dead.variations.intermediate.cues.some((c) => /steady gaze/i.test(c)),
    "Dead Bug should not be coached with a standing gaze",
  );

  const sharedTriples = new Map<string, string[]>();
  for (const a of ASANAS) {
    const key = a.variations.intermediate.cues.join("|");
    sharedTriples.set(key, [...(sharedTriples.get(key) ?? []), a.slug]);
  }
  const clones = [...sharedTriples.values()].filter((slugs) => slugs.length > 1);
  assert.deepEqual(clones, [], "unrelated poses share the same three form cues");
});

test("Form tab cues are not a permutation of How to practice", () => {
  const bySlug = Object.fromEntries(ASANAS.map((a) => [a.slug, a]));

  for (const slug of ["dead-bug", "reverse-tabletop", "wall-angel", "tadasana"]) {
    const asana = bySlug[slug]!;
    const { formCues } = buildPoseExplanation(asana);
    assert.ok(formCues.length >= 3, `${slug} should have three form cues`);
    for (const cue of formCues) {
      assert.equal(
        cueEchoesSteps(cue, asana.steps),
        false,
        `${slug} form cue still echoes a step: ${cue}`,
      );
    }
  }

  const dead = buildPoseExplanation(bySlug["dead-bug"]!);
  const table = buildPoseExplanation(bySlug["reverse-tabletop"]!);
  assert.notEqual(dead.formCues.join("|"), table.formCues.join("|"));
  assert.ok(
    dead.formCues.some((c) => /low back/i.test(c)),
    "Dead Bug should coach the low-back brace, not the entry lie-down",
  );
  assert.ok(
    !dead.formCues.some((c) => /lie on your back/i.test(c)),
    "Dead Bug Form must not repeat the first how-to step",
  );
  assert.ok(
    table.formCues.some((c) => /chest|hips|knees/i.test(c)),
    "Reverse Tabletop should coach the lifted shape",
  );

  const mountain = buildPoseExplanation(bySlug["tadasana"]!);
  assert.ok(
    mountain.formCues.some((c) => /crown|feet|kneecaps|shoulders/i.test(c)),
    "Mountain should keep authored alignment cues",
  );

  for (const asana of ASANAS) {
    const { formCues } = buildPoseExplanation(asana);
    assert.ok(formCues.length >= 3, `${asana.slug} should have three form cues`);
    for (const cue of formCues) {
      assert.equal(
        cueEchoesSteps(cue, asana.steps),
        false,
        `${asana.slug} form cue still echoes a step: ${cue}`,
      );
    }
  }
});

test("categories follow base position, not marketing vibe", () => {
  const bySlug = Object.fromEntries(ASANAS.map((a) => [a.slug, a]));
  const dolphin = bySlug["dolphin-plank"]!;
  const dead = bySlug["dead-bug"]!;
  const plank = bySlug["kumbhakasana"]!;
  const chaturanga = bySlug["chaturanga-dandasana"]!;
  const boat = bySlug["navasana"]!;
  const birdDog = bySlug["chakravakasana"]!;

  assert.equal(dolphin.category, "Core", "Dolphin Plank is a forearm plank");
  assert.equal(dead.category, "Core", "Dead Bug is a core drill");
  assert.notEqual(plank.category, "Standing", "Plank is not on the feet");
  assert.notEqual(chaturanga.category, "Standing", "Chaturanga is not on the feet");
  assert.notEqual(birdDog.category, "Restorative", "Bird Dog is a core drill, not a wind-down");
  // Classical assignments stay in the seven original families.
  assert.equal(plank.category, "Backbends");
  assert.equal(boat.category, "Seated");
  assert.equal(birdDog.category, "Backbends");
});

test("every pose carries a 0–5 practice-arc slot", () => {
  const bySlug = Object.fromEntries(ASANAS.map((a) => [a.slug, a]));
  const bad = ASANAS.filter((a) => a.arcSlot < 0 || a.arcSlot > 5).map((a) => a.slug);
  assert.deepEqual(bad, []);
  assert.equal(bySlug["sukhasana"]?.arcSlot, 0);
  assert.equal(bySlug["marjaryasana-bitilasana"]?.arcSlot, 1);
  assert.equal(bySlug["setu-bandhasana"]?.arcSlot, 3);
  assert.equal(bySlug["supta-matsyendrasana"]?.arcSlot, 4);
  assert.equal(bySlug["balasana"]?.arcSlot, 4);
  assert.equal(bySlug["savasana"]?.arcSlot, 5);
  assert.equal(bySlug["makarasana"]?.arcSlot, 5);
  assert.equal(bySlug["supta-baddha-konasana"]?.arcSlot, 5);
});

test("Core and Supine/Prone families exist and only hold the audited drills", () => {
  assert.ok(CATEGORIES.includes("Core"));
  assert.ok(CATEGORIES.includes("Supine/Prone"));
  assert.equal(ASANAS.length, 207);

  const bySlug = Object.fromEntries(ASANAS.map((a) => [a.slug, a]));
  for (const slug of CORE_FAMILY_SLUGS) {
    assert.equal(bySlug[slug]?.category, "Core", slug);
  }
  for (const slug of SUPINE_PRONE_FAMILY_SLUGS) {
    assert.equal(bySlug[slug]?.category, "Supine/Prone", slug);
  }

  const core = ASANAS.filter((a) => a.category === "Core");
  const floor = ASANAS.filter((a) => a.category === "Supine/Prone");
  assert.deepEqual(
    core.map((a) => a.slug).sort(),
    [...CORE_FAMILY_SLUGS].sort(),
  );
  assert.deepEqual(
    floor.map((a) => a.slug).sort(),
    [...SUPINE_PRONE_FAMILY_SLUGS].sort(),
  );
});

test("no supine or prone base is filed under Standing or Seated", () => {
  const leaked = ASANAS.filter(
    (a) => isSupineOrProneBase(a) && (a.category === "Standing" || a.category === "Seated"),
  ).map((a) => `${a.slug} [${a.category}]`);
  assert.deepEqual(leaked, []);
});

test("classical asana families are unchanged except Raised Legs (supine core)", () => {
  const bySlug = Object.fromEntries(ASANAS.map((a) => [a.slug, a]));
  assert.equal(bySlug["savasana"]?.category, "Restorative");
  assert.equal(bySlug["sirsasana"]?.category, "Inversions");
  assert.equal(bySlug["setu-bandhasana"]?.category, "Backbends");
  assert.equal(bySlug["navasana"]?.category, "Seated");
  assert.equal(bySlug["kumbhakasana"]?.category, "Backbends");
  assert.equal(bySlug["chakravakasana"]?.category, "Backbends");
  assert.equal(bySlug["bhujangasana"]?.category, "Backbends");
  assert.equal(bySlug["salabhasana"]?.category, "Backbends");

  const movedClassical = ASANAS.filter(
    (a) =>
      isClassicalAsanaName(a) &&
      (a.category === "Core" || a.category === "Supine/Prone") &&
      expectedFamily(a.slug) == null,
  ).map((a) => a.slug);
  assert.deepEqual(movedClassical, []);
  assert.equal(bySlug["uttana-padasana"]?.category, "Core");
});

test("filtering by Core and Supine/Prone returns only genuine members", () => {
  const core = ASANAS.filter((a) => a.category === "Core");
  assert.ok(core.length >= 5, `Core family too small: ${core.length}`);
  const coreSpot = [
    "dolphin-plank",
    "dead-bug",
    "scapular-plank-push",
    "glute-bridge-march",
    "uttana-padasana",
  ];
  for (const slug of coreSpot) {
    const pose = core.find((a) => a.slug === slug);
    assert.ok(pose, `missing ${slug} in Core filter`);
    assert.equal(expectedFamily(slug), "Core");
    const blob = `${pose.summary} ${pose.steps[0]?.text ?? ""}`.toLowerCase();
    assert.ok(
      /plank|core|brace|bridge|legs/.test(blob),
      `${slug} Core membership looks unrelated: ${pose.summary}`,
    );
  }

  const floor = ASANAS.filter((a) => a.category === "Supine/Prone");
  assert.ok(floor.length >= 4, `Supine/Prone family too small: ${floor.length}`);
  const floorSpot = [
    "pelvic-clock",
    "prone-y-lift",
    "active-hamstring-raise",
    "soft-bridge-pulse",
  ];
  for (const slug of floorSpot) {
    const pose = floor.find((a) => a.slug === slug);
    assert.ok(pose, `missing ${slug} in Supine/Prone filter`);
    assert.equal(expectedFamily(slug), "Supine/Prone");
    assert.ok(
      isSupineOrProneBase(pose),
      `${slug} should start on the back or belly`,
    );
  }
  for (const pose of floor) {
    assert.ok(isSupineOrProneBase(pose), `${pose.slug} in Supine/Prone is not a floor-lying shape`);
  }
});
