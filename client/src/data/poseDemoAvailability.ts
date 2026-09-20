/**
 * Is there an honest movement demonstration for this pose?
 *
 * The generated clips under /videos/poses are NOT demonstrations of movement.
 * `script/gen-pose-videos.ts` crossfades 2–3 still illustrations with a 1.6s
 * hold and a 0.65s fade, and when a pose's own steps never leave its peak
 * shape it prepends a *different pose's* illustration chosen by category:
 *
 *   Standing     → tadasana      (Warrior II, Tree)
 *   Restorative  → sukhasana     (Cat–Cow)
 *   Backbends    → bhujangasana
 *   …
 *
 * That is why "Bend the right knee toward 90°" showed a figure standing with
 * its feet together, and why "Come to all fours" showed someone sitting
 * cross-legged. The clips are ~2.57s against 63–77s of narration, so scrubbing
 * a step cue into them lands on an unrelated body somewhere in a dissolve.
 *
 * A dissolve between two stills is not a body moving. This module refuses to
 * present one as instruction, and names what would have to be produced instead.
 */
import { ASANAS, asanaBySlug, type Asana } from "@/data/content";
import { humanStepSlug } from "@/data/poseKeyImages";
import { poseMediaFor } from "@/data/poseMedia";

export type VariationLevel = "beginner" | "intermediate" | "advanced";

export type DemoKind =
  /** A reviewed clip that actually shows the body moving. None exist yet. */
  | "movement"
  /** This pose's own illustration, shown as a still and labelled as one. */
  | "static_reference"
  /** Nothing honest to show at all. */
  | "none";

export type PoseDemoAvailability = {
  slug: string;
  level: VariationLevel;
  kind: DemoKind;
  /** Still image to show. Always THIS pose — never a sibling's illustration. */
  poster: string | null;
  /** Consumer-facing sentence. Never a raw asset path. */
  label: string;
  /** Production id to chase when movement media is missing. */
  missingAssetId: string | null;
  /** Foreign illustrations the generated clip would have blended in. */
  blendedForeignShapes: string[];
};

/** The label the UI must show whenever movement media is unavailable. */
export const STATIC_REFERENCE_LABEL = "Static reference — movement demonstration unavailable";

/**
 * Category → entry illustration, mirroring `defaultEntrySlug` in
 * script/gen-pose-videos.ts. Kept here so the app can detect that a generated
 * clip opens on a different pose without shelling out to the encoder.
 */
const CATEGORY_ENTRY_SLUG: Record<string, string> = {
  Standing: "tadasana",
  "Hip Openers": "anjaneyasana",
  Seated: "sukhasana",
  "Forward Bends": "tadasana",
  Backbends: "bhujangasana",
  Inversions: "adho-mukha-svanasana",
  Restorative: "sukhasana",
};

/**
 * Illustration slugs a generated clip for this pose would crossfade through,
 * excluding the pose itself. A non-empty result means the clip shows at least
 * one body that is not in this pose.
 */
export function blendedForeignShapes(asana: Asana): string[] {
  const seq: string[] = [];
  for (const step of asana.steps) {
    const s = humanStepSlug(asana.slug, asana.pose, step.pose);
    if (seq[seq.length - 1] !== s) seq.push(s);
  }
  if (seq[seq.length - 1] !== asana.slug) seq.push(asana.slug);
  if (seq.length === 1) {
    const entry = CATEGORY_ENTRY_SLUG[asana.category as string] ?? "tadasana";
    if (entry !== asana.slug) seq.unshift(entry);
  }
  return Array.from(new Set(seq.filter((s) => s !== asana.slug)));
}

/**
 * Reviewed movement demonstrations, keyed `${slug}/${level}`.
 *
 * Deliberately empty. Populating it is a content decision made after a
 * qualified reviewer has watched the footage — see
 * docs/pose-demo-production.md. Code must never add to it automatically.
 */
export const REVIEWED_MOVEMENT_DEMOS: Record<
  string,
  {
    mp4: string;
    webm?: string;
    poster: string;
    durationSec: number;
    reviewer: string;
    reviewedOn: string;
    version: string;
  }
> = {};

export function reviewedDemoKey(slug: string, level: VariationLevel): string {
  return `${slug}/${level}`;
}

/**
 * What the teaching UI is allowed to show for this pose and variation.
 *
 * Note this never consults whether a video *file* exists or plays. A clip
 * playing is not evidence that it teaches the pose — that assumption is what
 * shipped standing figures into Warrior II's knee-bend cue.
 */
export function poseDemoAvailability(
  slug: string,
  level: VariationLevel = "intermediate",
): PoseDemoAvailability {
  const asana = asanaBySlug(slug);
  if (!asana) {
    return {
      slug,
      level,
      kind: "none",
      poster: null,
      label: "Demonstration unavailable for this pose.",
      missingAssetId: null,
      blendedForeignShapes: [],
    };
  }

  const reviewed = REVIEWED_MOVEMENT_DEMOS[reviewedDemoKey(slug, level)];
  if (reviewed) {
    return {
      slug,
      level,
      kind: "movement",
      poster: reviewed.poster,
      label: "Reviewed movement demonstration",
      missingAssetId: null,
      blendedForeignShapes: [],
    };
  }

  // Fall back to this pose's own illustration, held still and labelled. A
  // still is honest; a dissolve between two stills pretending to be motion
  // is not.
  const poster = poseMediaFor(slug).poster ?? null;
  return {
    slug,
    level,
    kind: poster ? "static_reference" : "none",
    poster,
    label: poster ? STATIC_REFERENCE_LABEL : "Demonstration unavailable for this pose.",
    missingAssetId: `movement-demo/${slug}/${level}`,
    blendedForeignShapes: blendedForeignShapes(asana),
  };
}

/** True only for a reviewed clip that actually shows the body moving. */
export function hasMovementDemo(slug: string, level: VariationLevel = "intermediate"): boolean {
  return poseDemoAvailability(slug, level).kind === "movement";
}

export type MissingDemoEntry = {
  id: string;
  slug: string;
  english: string;
  level: VariationLevel;
  /** What has to be produced. */
  need: string;
  /** Why the existing generated clip cannot be used. */
  whyExistingClipFails: string;
};

const LEVELS: VariationLevel[] = ["beginner", "intermediate", "advanced"];

/**
 * Exact production manifest for the poses the teaching UI can reach.
 * `slugs` defaults to the three poses audited in the live app.
 */
export function missingDemoManifest(
  slugs: string[] = ["marjaryasana-bitilasana", "virabhadrasana-ii", "vrksasana"],
): MissingDemoEntry[] {
  const out: MissingDemoEntry[] = [];
  for (const slug of slugs) {
    const asana = asanaBySlug(slug);
    if (!asana) continue;
    const foreign = blendedForeignShapes(asana);
    for (const level of LEVELS) {
      if (hasMovementDemo(slug, level)) continue;
      out.push({
        id: `movement-demo/${slug}/${level}`,
        slug,
        english: asana.english,
        level,
        need: `Continuous ${level} demonstration: starting position → entry → ${
          isDynamicPractice(asana) ? "repeated movement cycles" : "hold"
        } → exit${asana.hold.includes("each side") ? ", both sides" : ""}`,
        whyExistingClipFails: foreign.length
          ? `Generated clip crossfades ${foreign.join(", ")} into this pose — it shows a body that is not in ${asana.english}.`
          : "Generated clip is a still held for a few seconds — it shows no movement.",
      });
    }
  }
  return out;
}

/**
 * Poses whose practice is repeated movement rather than a static hold.
 *
 * Labelling Cat–Cow "Hold ~45s" is wrong twice over: nothing is held, and the
 * instruction is to flow one movement per breath for a number of rounds.
 */
export function isDynamicPractice(asana: Asana): boolean {
  if (DYNAMIC_PRACTICE_SLUGS.has(asana.slug)) return true;
  return asana.steps.some((s) =>
    /\b(flow(ing)?|rounds?|one movement per breath|repeat(ing)? (the )?(movement|cycle))\b/i.test(
      s.text,
    ),
  );
}

/** Reviewed by a catalog editor as flowing practices, not held shapes. */
export const DYNAMIC_PRACTICE_SLUGS = new Set<string>([
  "marjaryasana-bitilasana",
  "surya-namaskar-a",
  "pawanmuktasana",
]);

/** Every catalog pose whose generated clip would blend in a foreign body. */
export function posesWithMisleadingGeneratedClips(): Array<{
  slug: string;
  english: string;
  foreign: string[];
}> {
  return ASANAS.map((a) => ({
    slug: a.slug,
    english: a.english,
    foreign: blendedForeignShapes(a),
  })).filter((x) => x.foreign.length > 0);
}
