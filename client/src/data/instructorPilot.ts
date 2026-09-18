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
import {
  ADAPTATIONS,
  adaptationActionFor,
  type AdaptationId,
} from "@/lib/restrictionAdaptations";

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
  action: "exclude" | "prefer_beginner" | "warn" | "use_adaptation";
  adaptationId?: AdaptationId;
  alternativeSlug?: string;
  reviewedBy: "catalog_editor";
};

export type InstructorPoseVariant = {
  /** Difficulty level, or a restriction-specific adaptation id. */
  id: VariationLevel | AdaptationId;
  level: VariationLevel;
  displayName?: string;
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
  adaptations: Partial<Record<AdaptationId, InstructorPoseVariant>>;
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
      label: "Static reference — beginner filmed demonstration is not available yet.",
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
        "Presentation animation — not a filmed instructor lesson. Filmed front/side demos are still needed.",
    };
  }
  return {
    kind: "missing",
    reviewStatus: "not_reviewed",
    angle: "unknown",
    poster: sources.poster,
    missingAssetId: `filmed-instructor/${slug}/any`,
    label: "Demonstration unavailable for this pose right now.",
  };
}

function mediaForAdaptation(adaptationId: AdaptationId): InstructorMediaRef {
  const a = ADAPTATIONS[adaptationId];
  const sources = poseMediaFor(a.mediaSlug);
  const hasAnim = poseHasVideo(a.mediaSlug);
  return {
    kind: hasAnim ? "presentation_animation" : "static_reference",
    reviewStatus: "editor_catalog_note",
    angle: "front",
    videoMp4: hasAnim ? sources.mp4 ?? null : null,
    videoWebm: hasAnim ? sources.webm ?? null : null,
    poster: sources.poster,
    captionsVtt: sources.captions ?? null,
    narrationUrl: poseNarrationSrc(a.mediaSlug),
    missingAssetId: a.missingAssetId,
    label: a.mediaConsumerLabel,
  };
}

function adaptationVariant(adaptationId: AdaptationId): InstructorPoseVariant {
  const a = ADAPTATIONS[adaptationId];
  return {
    id: adaptationId,
    level: "beginner",
    displayName: a.displayName,
    description: a.description,
    props: a.props,
    holdSeconds: a.holdSeconds,
    cues: a.cues,
    steps: a.steps,
    commonMistakes: [],
    media: mediaForAdaptation(adaptationId),
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
    const bodyArea = bodyAreaFor(row.condition);
    const mapped = adaptationActionFor({
      poseSlug: slug,
      bodyArea,
      severity: row.severity,
      condition: row.condition,
    });
    if (mapped.type === "use_adaptation") {
      return {
        id: `${slug}-r${i}`,
        bodyArea,
        condition: row.condition,
        severity: row.severity,
        action: "use_adaptation" as const,
        adaptationId: mapped.adaptationId,
        reviewedBy: "catalog_editor" as const,
      };
    }
    if (mapped.type === "exclude") {
      return {
        id: `${slug}-r${i}`,
        bodyArea,
        condition: row.condition,
        severity: row.severity,
        action: "exclude" as const,
        alternativeSlug: mapped.substituteSlug,
        reviewedBy: "catalog_editor" as const,
      };
    }
    if (mapped.type === "prefer_beginner") {
      return {
        id: `${slug}-r${i}`,
        bodyArea,
        condition: row.condition,
        severity: row.severity,
        action: "prefer_beginner" as const,
        reviewedBy: "catalog_editor" as const,
      };
    }
    return {
      id: `${slug}-r${i}`,
      bodyArea,
      condition: row.condition,
      severity: row.severity,
      action: "warn" as const,
      reviewedBy: "catalog_editor" as const,
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
    id: level,
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

function adaptationsFor(slug: InstructorPilotSlug): Partial<Record<AdaptationId, InstructorPoseVariant>> {
  const out: Partial<Record<AdaptationId, InstructorPoseVariant>> = {};
  for (const [id, content] of Object.entries(ADAPTATIONS) as Array<
    [AdaptationId, (typeof ADAPTATIONS)[AdaptationId]]
  >) {
    if (content.poseSlug === slug) out[id] = adaptationVariant(id);
  }
  return out;
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
    adaptations: adaptationsFor(slug),
  };
}

/** Resolve teaching content for a pose given difficulty + optional adaptation. */
export function resolveTeachingVariant(
  pose: InstructorPoseDef,
  level: VariationLevel,
  adaptationId?: AdaptationId | null,
): InstructorPoseVariant {
  if (adaptationId && pose.adaptations[adaptationId]) {
    return pose.adaptations[adaptationId]!;
  }
  return pose.variants[level];
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
  pose: InstructorPilotSlug | "kumbhakasana";
  need: string;
  status: "needed";
}> = [
  ...INSTRUCTOR_PILOT_SLUGS.flatMap((pose) => [
    {
      id: `filmed-instructor/${pose}/front`,
      pose,
      need: "Full-body filmed instructor, front view, prep→entry→hold→exit",
      status: "needed" as const,
    },
    {
      id: `filmed-instructor/${pose}/side`,
      pose,
      need: "Matching side view with same instructor/studio/lighting",
      status: "needed" as const,
    },
    {
      id: `filmed-instructor/${pose}/beginner-front`,
      pose,
      need: "Beginner / supported variation demonstration with accurate props",
      status: "needed" as const,
    },
    {
      id: `human-narration/${pose}`,
      pose,
      need: "Approved human voiceover aligned to timeline segments",
      status: "needed" as const,
    },
  ]),
  {
    id: "filmed-instructor/kumbhakasana/wrist-forearm",
    pose: "kumbhakasana",
    need: "Filmed forearm-plank adaptation (elbows under shoulders) matching wrist-injury teaching",
    status: "needed",
  },
  {
    id: "filmed-instructor/kumbhakasana/pregnancy-modify",
    pose: "kumbhakasana",
    need: "Filmed knees-down pregnancy plank modification",
    status: "needed",
  },
  {
    id: "filmed-instructor/marjaryasana-bitilasana/wrist-fist",
    pose: "marjaryasana-bitilasana",
    need: "Filmed Cat–Cow on fists or forearms for wrist restriction",
    status: "needed",
  },
];
