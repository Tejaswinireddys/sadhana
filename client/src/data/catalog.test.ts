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

import { ASANAS } from "./content.ts";
import { POSE_IMAGE_ALT } from "./poseImageAlts.ts";
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

test("every pose illustration has stored body-shape alt text", () => {
  const missing = ASANAS.filter((a) => !a.imageAlt).map((a) => a.slug);
  assert.deepEqual(missing, []);
  assert.equal(ASANAS.length, Object.keys(POSE_IMAGE_ALT).length);
  assert.equal(
    POSE_IMAGE_ALT["couch-hip-flexor"],
    "Kneeling with the back foot raised on a chair, torso upright, hands on the front thigh.",
  );
  const tooShort = ASANAS.filter((a) => a.imageAlt.length < 40).map((a) => a.slug);
  assert.deepEqual(tooShort, []);
  const justTheName = ASANAS.filter(
    (a) => a.imageAlt === a.english || a.imageAlt.toLowerCase() === a.english.toLowerCase(),
  ).map((a) => a.slug);
  assert.deepEqual(justTheName, []);
  assert.deepEqual(duplicates(ASANAS.map((a) => a.imageAlt)), []);
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

  assert.notEqual(dolphin.category, "Standing", "Dolphin Plank is a forearm plank, not a standing pose");
  assert.notEqual(dead.category, "Restorative", "Dead Bug is a core drill, not a wind-down");
  assert.notEqual(plank.category, "Standing", "Plank is not on the feet");
  assert.notEqual(chaturanga.category, "Standing", "Chaturanga is not on the feet");
  assert.notEqual(birdDog.category, "Restorative", "Bird Dog is a core drill, not a wind-down");
  assert.equal(dolphin.category, plank.category, "Dolphin Plank should match Plank");
  assert.equal(dead.category, boat.category, "Dead Bug should match Boat as core work");
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

test("pose illustrations read stored imageAlt; decorative images stay empty", () => {
  const poseImage = readFileSync(path.join(ROOT, "client/src/components/PoseImage.tsx"), "utf8");
  assert.match(poseImage, /asana\?\.imageAlt/);
  assert.match(poseImage, /alt=\{resolvedAlt\}/);
  // Blur-up duplicate of the same asset is decorative.
  assert.match(poseImage, /alt=""\s*\n\s*aria-hidden/);

  const demo = readFileSync(path.join(ROOT, "client/src/components/PoseDemoStage.tsx"), "utf8");
  assert.match(demo, /asanaBySlug\(slug\)\?\.imageAlt/);

  const header = readFileSync(path.join(ROOT, "client/src/components/home/HomeWelcomeHeader.tsx"), "utf8");
  assert.match(header, /data-testid="home-hero-scene"/);
  assert.match(header, /aria-hidden/);
  assert.match(header, /alt=""/);

  const home = readFileSync(path.join(ROOT, "client/src/pages/Home.tsx"), "utf8");
  assert.match(home, /alt=\{a\.imageAlt\}/);
});
