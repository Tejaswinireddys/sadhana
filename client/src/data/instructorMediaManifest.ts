/**
 * Typed manifest for instructor demonstration media.
 *
 * This is the record that decides whether the player is allowed to present
 * something as a demonstration of how a pose is entered, held and exited.
 *
 * The rule the whole feature rests on: a clip counts as a real movement
 * demonstration only when it is `published`, carries a real source, and names
 * the person who reviewed it and when. Anything else — a looping illustration,
 * a poster, a draft render — is a placeholder, and the UI must say so.
 *
 * Nothing in this file may be promoted to `published` by code. Promotion is a
 * human review step; see docs/instructor-content-workflow.md.
 */
import { ADAPTATIONS, type AdaptationId } from "@/lib/restrictionAdaptations";

export type VariationLevel = "beginner" | "intermediate" | "advanced";
export type VariantId = VariationLevel | AdaptationId;
export type CameraAngle = "front" | "side" | "unknown";
export type BodySide = "left" | "right" | "both";

export type TimelinePhase =
  | "preparation"
  | "entry"
  | "hold"
  | "exit"
  | "side_switch"
  | "transition";

/**
 * Where an asset came from. `presentation_animation` and `static_reference`
 * are the placeholders already in the app — they are listed here so the
 * manifest can describe what is actually on screen, not so they can pass as
 * instruction.
 */
export type MediaSourceKind =
  | "filmed_instructor"
  | "reviewed_3d"
  | "ai_generated"
  | "presentation_animation"
  | "static_reference";

/** Source kinds that can depict real movement once reviewed and published. */
const MOVEMENT_SOURCE_KINDS: ReadonlySet<MediaSourceKind> = new Set([
  "filmed_instructor",
  "reviewed_3d",
  "ai_generated",
]);

export type UsageRights =
  | "owned_original"
  | "licensed"
  | "public_domain"
  | "internal_render";

export type AssetProvenance = {
  sourceKind: MediaSourceKind;
  /** Studio, rigger, or generator responsible for the asset. */
  creator: string;
  /** ISO date the footage was captured or the render produced. */
  capturedOn: string | null;
  rights: UsageRights;
  rightsNote: string;
  /** Required when sourceKind is `ai_generated` — which system produced it. */
  generatedWith?: string;
};

/**
 * Draft → Content review → Playback QA → Published.
 * `missing` means the asset does not exist at all.
 */
export type ReviewStage =
  | "missing"
  | "draft"
  | "content_review"
  | "playback_qa"
  | "published";

export const REVIEW_STAGES: ReviewStage[] = [
  "missing",
  "draft",
  "content_review",
  "playback_qa",
  "published",
];

export type AssetReview = {
  stage: ReviewStage;
  /** Named human who signed off. Never a tool, never a model. */
  reviewer: string | null;
  /** ISO date of that sign-off. */
  reviewedOn: string | null;
  /** Semver-ish asset version so a re-shoot can supersede a published clip. */
  version: string;
  notes?: string;
};

/** Phase window inside a single clip, in seconds from the clip's start. */
export type PhaseSegmentRef = {
  phase: TimelinePhase;
  startSec: number;
  endSec: number;
};

export type NarrationCue = { t: number; text: string };

export type InstructorClipManifest = {
  clipId: string;
  poseId: string;
  variantId: VariantId;
  side: BodySide;
  angle: CameraAngle;
  /** Which part of the clip shows which phase. Empty until the asset exists. */
  segments: PhaseSegmentRef[];
  durationSec: number | null;
  sources: { hls?: string | null; mp4?: string | null; webm?: string | null };
  poster: string | null;
  captionsVtt: string | null;
  narration: { url: string | null; cues: NarrationCue[] };
  /** Props that must be visible in frame. */
  equipment: string[];
  /** Set when this clip demonstrates a modification of another variant. */
  modifies: { poseId: string; variantId: VariantId } | null;
  provenance: AssetProvenance;
  review: AssetReview;
  /** Consumer-facing sentence. Never a raw asset path. */
  label: string;
  /** Production id to chase when the asset is not yet available. */
  missingAssetId: string | null;
};

export function hasPlayableSource(clip: InstructorClipManifest): boolean {
  return Boolean(clip.sources.hls || clip.sources.mp4 || clip.sources.webm);
}

/**
 * The only predicate allowed to gate "this shows how the pose is performed".
 *
 * Deliberately strict: an unreviewed render, a clip still in playback QA, and
 * a looping illustration all return false. If this returns false the player
 * shows text cues and an explicit unavailable state instead.
 */
export function isMovementDemonstration(clip: InstructorClipManifest): boolean {
  return (
    clip.review.stage === "published" &&
    Boolean(clip.review.reviewer) &&
    Boolean(clip.review.reviewedOn) &&
    MOVEMENT_SOURCE_KINDS.has(clip.provenance.sourceKind) &&
    hasPlayableSource(clip) &&
    clip.segments.length > 0
  );
}

/** Every phase a demonstration has to cover before it can be published. */
export const REQUIRED_PHASES: TimelinePhase[] = ["preparation", "entry", "hold", "exit"];

export function coversRequiredPhases(clip: InstructorClipManifest): boolean {
  const present = new Set(clip.segments.map((s) => s.phase));
  return REQUIRED_PHASES.every((p) => present.has(p));
}

/**
 * Structural problems that must block promotion to `published`.
 * Returned as sentences so the workflow test and any future admin screen can
 * show the same list.
 */
export function manifestViolations(clip: InstructorClipManifest): string[] {
  const out: string[] = [];
  const { review, provenance } = clip;

  if (review.stage === "published") {
    if (!review.reviewer) out.push(`${clip.clipId}: published with no named reviewer`);
    if (!review.reviewedOn) out.push(`${clip.clipId}: published with no review date`);
    if (!review.version) out.push(`${clip.clipId}: published with no asset version`);
    if (!hasPlayableSource(clip)) out.push(`${clip.clipId}: published with no media source`);
    if (!coversRequiredPhases(clip)) {
      out.push(`${clip.clipId}: published without prepare/enter/hold/exit segments`);
    }
    if (!MOVEMENT_SOURCE_KINDS.has(provenance.sourceKind)) {
      out.push(
        `${clip.clipId}: ${provenance.sourceKind} cannot be published as a movement demonstration`,
      );
    }
  }

  if (review.stage === "missing" && hasPlayableSource(clip)) {
    out.push(`${clip.clipId}: marked missing but carries a media source`);
  }

  if (provenance.sourceKind === "ai_generated" && !provenance.generatedWith) {
    out.push(`${clip.clipId}: AI-generated asset does not record what generated it`);
  }

  if (provenance.rights === "licensed" && !provenance.rightsNote.trim()) {
    out.push(`${clip.clipId}: licensed asset does not record its licence terms`);
  }

  for (const seg of clip.segments) {
    if (seg.endSec <= seg.startSec) {
      out.push(`${clip.clipId}: ${seg.phase} segment ends before it starts`);
    }
    if (clip.durationSec != null && seg.endSec > clip.durationSec + 0.001) {
      out.push(`${clip.clipId}: ${seg.phase} segment runs past the end of the clip`);
    }
  }

  return out;
}

/** A not-yet-produced clip. Every pilot entry starts here. */
function needed(opts: {
  poseId: string;
  slug: string;
  variantId: VariantId;
  side: BodySide;
  angle: CameraAngle;
  equipment?: string[];
  modifies?: { poseId: string; variantId: VariantId } | null;
  label: string;
  missingAssetId: string;
}): InstructorClipManifest {
  return {
    clipId: `${opts.poseId}/${opts.variantId}/${opts.side}/${opts.angle}`,
    poseId: opts.poseId,
    variantId: opts.variantId,
    side: opts.side,
    angle: opts.angle,
    segments: [],
    durationSec: null,
    sources: { hls: null, mp4: null, webm: null },
    poster: null,
    captionsVtt: null,
    narration: { url: null, cues: [] },
    equipment: opts.equipment ?? [],
    modifies: opts.modifies ?? null,
    provenance: {
      sourceKind: "filmed_instructor",
      creator: "unassigned",
      capturedOn: null,
      rights: "owned_original",
      rightsNote: "To be shot for Sadhana under a full buy-out performer release.",
    },
    review: {
      stage: "missing",
      reviewer: null,
      reviewedOn: null,
      version: "0.0.0",
      notes: "Not yet produced.",
    },
    label: opts.label,
    missingAssetId: opts.missingAssetId,
  };
}

type PilotSpec = {
  slug: string;
  sides: BodySide[];
  /** Props the base variants require in frame. */
  equipment: string[];
  /** Supported / easier variation and the props it needs. */
  supported: { variantId: VariantId; equipment: string[] };
  adaptations: Array<{ variantId: AdaptationId; equipment: string[] }>;
};

const PILOT_SPECS: PilotSpec[] = [
  {
    slug: "tadasana",
    sides: ["both"],
    equipment: [],
    supported: { variantId: "beginner", equipment: ["wall"] },
    adaptations: [{ variantId: "wall_supported_mountain", equipment: ["wall"] }],
  },
  {
    slug: "balasana",
    sides: ["both"],
    equipment: [],
    supported: { variantId: "beginner", equipment: ["bolster", "blanket"] },
    adaptations: [{ variantId: "knee_supported_child", equipment: ["bolster", "blanket"] }],
  },
  {
    slug: "marjaryasana-bitilasana",
    sides: ["both"],
    equipment: ["blanket"],
    supported: { variantId: "beginner", equipment: ["blanket"] },
    adaptations: [{ variantId: "wrist_fist_catcow", equipment: ["blanket"] }],
  },
  {
    slug: "virabhadrasana-ii",
    sides: ["left", "right"],
    equipment: [],
    supported: { variantId: "beginner", equipment: ["block"] },
    adaptations: [],
  },
  {
    slug: "kumbhakasana",
    sides: ["both"],
    equipment: [],
    supported: { variantId: "beginner", equipment: ["blanket"] },
    adaptations: [
      { variantId: "wrist_forearm_plank", equipment: ["blanket"] },
      { variantId: "pregnancy_plank_modify", equipment: ["blanket"] },
    ],
  },
];

const ANGLES: CameraAngle[] = ["front", "side"];

/**
 * The full pilot manifest.
 *
 * Every entry is `missing`: no filmed, rigged, or reviewed AI movement has been
 * produced for this pilot. The list is exhaustive on purpose — it is the
 * production order, and `isMovementDemonstration` returns false for all of it.
 */
export const INSTRUCTOR_CLIP_MANIFEST: InstructorClipManifest[] = PILOT_SPECS.flatMap((spec) => {
  const poseId = `pilot-${spec.slug}`;
  const clips: InstructorClipManifest[] = [];

  for (const side of spec.sides) {
    for (const angle of ANGLES) {
      const sideTag = side === "both" ? "" : `-${side}`;
      clips.push(
        needed({
          poseId,
          slug: spec.slug,
          variantId: "intermediate",
          side,
          angle,
          equipment: spec.equipment,
          label: `Filmed ${angle} view of the full pose — not produced yet.`,
          missingAssetId: `filmed-instructor/${spec.slug}/${angle}${sideTag}`,
        }),
      );
    }
    // Supported / easier variation, front only — the angle that shows props.
    clips.push(
      needed({
        poseId,
        slug: spec.slug,
        variantId: spec.supported.variantId,
        side,
        angle: "front",
        equipment: spec.supported.equipment,
        modifies: { poseId, variantId: "intermediate" },
        label: "Filmed supported variation — not produced yet.",
        missingAssetId: `filmed-instructor/${spec.slug}/beginner-front${side === "both" ? "" : `-${side}`}`,
      }),
    );
  }

  for (const adaptation of spec.adaptations) {
    clips.push(
      needed({
        poseId,
        slug: spec.slug,
        variantId: adaptation.variantId,
        side: spec.sides[0],
        angle: "front",
        equipment: adaptation.equipment,
        modifies: { poseId, variantId: "intermediate" },
        label: "Filmed restriction adaptation — not produced yet.",
        // Reuse the id the adaptation already publishes, so one production
        // deliverable is not tracked under two different names.
        missingAssetId: ADAPTATIONS[adaptation.variantId].missingAssetId,
      }),
    );
  }

  return clips;
});

export function clipsFor(opts: {
  poseId: string;
  variantId: VariantId;
  side?: BodySide;
}): InstructorClipManifest[] {
  return INSTRUCTOR_CLIP_MANIFEST.filter(
    (c) =>
      c.poseId === opts.poseId &&
      c.variantId === opts.variantId &&
      (opts.side == null || c.side === opts.side || c.side === "both"),
  );
}

/**
 * Camera angles that can actually be offered for a variant — only angles whose
 * clip passes `isMovementDemonstration`. The alternate-view control is hidden
 * when this has fewer than two entries, so the UI never offers a dead toggle.
 */
export function availableAngles(opts: {
  poseId: string;
  variantId: VariantId;
  side?: BodySide;
}): CameraAngle[] {
  const seen = new Set<CameraAngle>();
  for (const clip of clipsFor(opts)) {
    if (isMovementDemonstration(clip)) seen.add(clip.angle);
  }
  return ANGLES.filter((a) => seen.has(a));
}

export function resolveClip(opts: {
  poseId: string;
  variantId: VariantId;
  side?: BodySide;
  angle?: CameraAngle;
}): InstructorClipManifest | null {
  const candidates = clipsFor(opts);
  if (candidates.length === 0) return null;
  if (opts.angle) {
    const exact = candidates.find((c) => c.angle === opts.angle);
    if (exact) return exact;
  }
  return candidates.find((c) => c.angle === "front") ?? candidates[0];
}

export type ManifestCoverage = {
  total: number;
  byStage: Record<ReviewStage, number>;
  /** Clips that would actually play as instruction. */
  publishedDemonstrations: number;
  missingAssetIds: string[];
};

/** Honest, countable status for the setup screen and the production docs. */
export function manifestCoverage(
  clips: InstructorClipManifest[] = INSTRUCTOR_CLIP_MANIFEST,
): ManifestCoverage {
  const byStage = REVIEW_STAGES.reduce(
    (acc, stage) => ({ ...acc, [stage]: 0 }),
    {} as Record<ReviewStage, number>,
  );
  const missingAssetIds: string[] = [];
  let publishedDemonstrations = 0;

  for (const clip of clips) {
    byStage[clip.review.stage] += 1;
    if (isMovementDemonstration(clip)) publishedDemonstrations += 1;
    else if (clip.missingAssetId) missingAssetIds.push(clip.missingAssetId);
  }

  return {
    total: clips.length,
    byStage,
    publishedDemonstrations,
    missingAssetIds: Array.from(new Set(missingAssetIds)).sort(),
  };
}
