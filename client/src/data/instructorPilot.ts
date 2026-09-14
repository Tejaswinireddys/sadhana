/**
 * Virtual instructor pilot — five poses with a structured teaching model.
 *
 * Media honesty: catalog presentation animations exist for motion continuity,
 * but filmed instructor / anatomically reviewed 3D assets are NOT shipped.
 * Review status is never claimed beyond editor catalog notes.
 * See docs/instructor-pilot-media.md for the asset gap list.
 */
import { asanaBySlug, type AvoidRow, type Variation } from "@/data/content";
import { poseMediaFor, poseHasVideo, poseNarrationSrc } from "@/data/poseMedia";

export const INSTRUCTOR_PILOT_SLUGS = [
  "tadasana",
  "balasana",
  "marjaryasana-bitilasana",
  "virabhadrasana-ii",
  "kumbhakasana",
] as const;

export type InstructorPilotSlug = (typeof INSTRUCTOR_PILOT_SLUGS)[number];
export type InstructorMode = "learn" | "flow";
export type VariationLevel = "beginner" | "intermediate" | "advanced";
export type CameraAngle = "front" | "side" | "unknown";
export type MediaKind =
  | "filmed_instructor"
  | "reviewed_3d"
  | "presentation_animation"
  | "static_reference"
  | "missing";
export type MediaReviewStatus =
  | "not_reviewed"
  | "editor_catalog_note"
  | "instructor_reviewed";
export type TimelinePhase =
  | "preparation"
  | "entry"
  | "hold"
  | "exit"
  | "side_switch"
  | "transition";

export type InstructionSegment = {
  id: string;
  phase: TimelinePhase;
  startSec: number;
  durationSec: number;
  cue: string;
  caption: string;
  breathCue?: string;
  side: "left" | "right" | "both";
  quiet?: boolean;
  mediaWindow?: { start: number; end: number } | null;
};

export type InstructorMediaRef = {
  kind: MediaKind;
  reviewStatus: MediaReviewStatus;
  angle: CameraAngle;
  videoMp4?: string | null;
  videoWebm?: string | null;
  poster: string;
  captionsVtt?: string | null;
  narrationUrl?: string | null;
  missingAssetId?: string;
  label: string;
};

export type InstructorRestrictionRule = {
  id: string;
  bodyArea: string;
  condition: string;
  severity: AvoidRow["severity"];
  action: "exclude" | "prefer_beginner" | "warn";
  alternativeSlug?: InstructorPilotSlug;
  reviewedBy: "catalog_editor";
};

export type InstructorPoseVariant = {
  level: VariationLevel;
  description: string;
  props: string[];
  holdSeconds: number;
  cues: string[];
  steps: string[];
  commonMistakes: string[];
  media: InstructorMediaRef;
};

export type InstructorPoseDef = {
  poseId: string;
  slug: InstructorPilotSlug;
  english: string;
  sanskrit: string;
  sides: "once" | "each";
  breathing: string;
  restrictions: InstructorRestrictionRule[];
  variants: Record<VariationLevel, InstructorPoseVariant>;
};

const BODY_AREA_HINTS: Array<{ area: string; match: RegExp }> = [
  { area: "wrists", match: /wrist|carpal/i },
  { area: "knees", match: /knee/i },
  { area: "ankles", match: /ankle/i },
  { area: "shoulders", match: /shoulder/i },
  { area: "spine", match: /spinal|spine|back|disc/i },
  { area: "neck", match: /neck/i },
  { area: "pregnancy", match: /pregnan/i },
  { area: "blood_pressure", match: /blood pressure|dizziness|vertigo/i },
];

function bodyAreaFor(condition: string): string {
  for (const h of BODY_AREA_HINTS) {
    if (h.match.test(condition)) return h.area;
  }
  return "general";
}

function mediaForVariant(
  slug: InstructorPilotSlug,
  level: VariationLevel,
): InstructorMediaRef {
  const sources = poseMediaFor(slug);
  const hasAnim = poseHasVideo(slug);
  const narrationUrl = poseNarrationSrc(slug);

  if (level === "beginner" && slug !== "tadasana") {
    return {
      kind: "static_reference",
      reviewStatus: "editor_catalog_note",
      angle: "front",
      videoMp4: null,
      videoWebm: null,
      poster: sources.poster,
      captionsVtt: sources.captions ?? null,
      narrationUrl,
      missingAssetId: `filmed-instructor/${slug}/beginner-front`,
      label:
        "Static reference — beginner filmed demonstration is not available yet. " +
        `Missing asset: filmed-instructor/${slug}/beginner-front`,
    };
  }
  if (hasAnim) {
    return {
      kind: "presentation_animation",
      reviewStatus: "not_reviewed",
      angle: "front",
      videoMp4: sources.mp4 ?? null,
      videoWebm: sources.webm ?? null,
      poster: sources.poster,
      captionsVtt: sources.captions ?? null,
      narrationUrl,
      missingAssetId: `filmed-instructor/${slug}/front-and-side`,
      label:
        "Presentation animation (not a filmed instructor). Filmed front/side demos are still needed.",
    };
  }
  return {
    kind: "missing",
    reviewStatus: "not_reviewed",
    angle: "unknown",
    poster: sources.poster,
    missingAssetId: `filmed-instructor/${slug}/any`,
    label: `Demonstration unavailable — missing asset: filmed-instructor/${slug}/any`,
  };
}

const COMMON_MISTAKES: Record<InstructorPilotSlug, Record<VariationLevel, string[]>> = {
  tadasana: {
    beginner: [
      "Locking the knees hard",
      "Holding the breath",
      "Shrugging the shoulders toward the ears",
    ],
    intermediate: ["Tucking the chin too hard", "Collapsing the arches"],
    advanced: ["Overarching the low back while reaching up"],
  },
  balasana: {
    beginner: ["Forcing hips to the heels", "Turning the head hard to one side"],
    intermediate: ["Collapsing into the shoulders"],
    advanced: ["Holding tension in the jaw"],
  },
  "marjaryasana-bitilasana": {
    beginner: ["Dumping into the wrists", "Moving faster than the breath"],
    intermediate: ["Only moving the neck, not the whole spine"],
    advanced: ["Losing a long neck in Cat"],
  },
  "virabhadrasana-ii": {
    beginner: ["Front knee collapsing inward", "Leaning the torso over the front thigh"],
    intermediate: ["Back arm going slack", "Raising the front heel"],
    advanced: ["Holding the breath in the deep bend"],
  },
  kumbhakasana: {
    beginner: ["Hips sagging or piking", "Collapsing into the wrists"],
    intermediate: ["Looking too far forward and compressing the neck"],
    advanced: ["Breath holding under load"],
  },
};

function restrictionRules(
  slug: InstructorPilotSlug,
  avoidIf: AvoidRow[],
): InstructorRestrictionRule[] {
  return avoidIf.map((row, i) => {
    const action =
      row.severity === "avoid"
        ? "exclude"
        : row.severity === "modify"
          ? "prefer_beginner"
          : "warn";
    return {
      id: `${slug}-r${i}`,
      bodyArea: bodyAreaFor(row.condition),
      condition: row.condition,
      severity: row.severity,
      action,
      alternativeSlug:
        action === "exclude" && slug !== "balasana" ? "balasana" : undefined,
      reviewedBy: "catalog_editor",
    };
  });
}

function variantFromAsana(
  slug: InstructorPilotSlug,
  level: VariationLevel,
  v: Variation,
  fallbackSteps: string[],
): InstructorPoseVariant {
  return {
    level,
    description: v.description,
    props: v.props.length ? v.props : ["none"],
    holdSeconds: v.holdSeconds,
    cues: v.cues,
    steps: (v.steps?.map((s) => s.text) ?? fallbackSteps).filter(Boolean),
    commonMistakes: COMMON_MISTAKES[slug][level],
    media: mediaForVariant(slug, level),
  };
}

function buildPose(slug: InstructorPilotSlug, sides: "once" | "each"): InstructorPoseDef {
  const asana = asanaBySlug(slug);
  if (!asana) throw new Error(`Instructor pilot missing asana: ${slug}`);
  const fallbackSteps = asana.steps.map((s) => s.text);
  return {
    poseId: `pilot-${slug}`,
    slug,
    english: asana.english,
    sanskrit: asana.sanskrit,
    sides,
    breathing: asana.breathing,
    restrictions: restrictionRules(slug, asana.avoidIf ?? []),
    variants: {
      beginner: variantFromAsana(slug, "beginner", asana.variations.beginner, fallbackSteps),
      intermediate: variantFromAsana(
        slug,
        "intermediate",
        asana.variations.intermediate,
        fallbackSteps,
      ),
      advanced: variantFromAsana(slug, "advanced", asana.variations.advanced, fallbackSteps),
    },
  };
}

export const INSTRUCTOR_PILOT_POSES: InstructorPoseDef[] = [
  buildPose("tadasana", "once"),
  buildPose("balasana", "once"),
  buildPose("marjaryasana-bitilasana", "once"),
  buildPose("virabhadrasana-ii", "each"),
  buildPose("kumbhakasana", "once"),
];

export function instructorPoseBySlug(slug: string): InstructorPoseDef | undefined {
  return INSTRUCTOR_PILOT_POSES.find((p) => p.slug === slug);
}

export function isInstructorPilotSlug(slug: string): slug is InstructorPilotSlug {
  return (INSTRUCTOR_PILOT_SLUGS as readonly string[]).includes(slug);
}

export const INSTRUCTOR_PILOT_MISSING_ASSETS: Array<{
  id: string;
  pose: InstructorPilotSlug;
  need: string;
  status: "needed";
}> = INSTRUCTOR_PILOT_SLUGS.flatMap((pose) => [
  {
    id: `filmed-instructor/${pose}/front`,
    pose,
    need: "Full-body filmed instructor, front view, prep→entry→hold→exit",
    status: "needed",
  },
  {
    id: `filmed-instructor/${pose}/side`,
    pose,
    need: "Matching side view with same instructor/studio/lighting",
    status: "needed",
  },
  {
    id: `filmed-instructor/${pose}/beginner-front`,
    pose,
    need: "Beginner / supported variation demonstration with accurate props",
    status: "needed",
  },
  {
    id: `human-narration/${pose}`,
    pose,
    need: "Approved human voiceover aligned to timeline segments",
    status: "needed",
  },
]);
