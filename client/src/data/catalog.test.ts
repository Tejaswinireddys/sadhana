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
import { EXTRAS } from "./variations.ts";
import { STRETCH_ZONES } from "./zones.ts";
import { BEST_FOR } from "./bestFor.ts";
import { POSE_KEYS } from "../components/PoseSvg.tsx";

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
