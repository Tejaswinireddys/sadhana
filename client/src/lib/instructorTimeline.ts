/**
 * Build a shared instructor timeline for Learn / Flow modes.
 * Segments coordinate demo windows, captions, breath cues, and holds.
 */
import type {
  InstructorMode,
  InstructorPoseDef,
  InstructorPoseVariant,
  InstructionSegment,
  TimelinePhase,
  VariationLevel,
} from "@/data/instructorPilot";
import { resolveTeachingVariant } from "@/data/instructorPilot";
import type { AdaptationId } from "@/lib/restrictionAdaptations";

export type PoseTimeline = {
  slug: string;
  mode: InstructorMode;
  level: VariationLevel;
  adaptationId?: AdaptationId | null;
  prepExtraSec: number;
  segments: InstructionSegment[];
  totalSec: number;
  props: string[];
  mediaKind: string;
  displayName: string;
};

export type FlatSegment = InstructionSegment & {
  poseIndex: number;
  absStartSec: number;
};

function pushSeg(
  out: InstructionSegment[],
  cursor: { t: number },
  partial: Omit<InstructionSegment, "startSec"> & { durationSec: number },
) {
  out.push({ ...partial, startSec: cursor.t });
  cursor.t += Math.max(0, partial.durationSec);
}

function sideLabel(side: "left" | "right" | "both"): string {
  if (side === "both") return "";
  return side === "left" ? " on the left side" : " on the right side";
}

function buildSideSegments(opts: {
  pose: InstructorPoseDef;
  variant: InstructorPoseVariant;
  mode: InstructorMode;
  side: "left" | "right" | "both";
  /** Extra seconds applied only to THIS preparation segment. */
  prepExtraSec: number;
  cursor: { t: number };
  out: InstructionSegment[];
  includeTransition: boolean;
}) {
  const { pose, variant, mode, side, prepExtraSec, cursor, out, includeTransition } = opts;
  const learn = mode === "learn";
  const sideTag = side === "both" ? "both" : side;
  const suffix = side === "both" ? "" : `-${side}`;
  const anim = variant.media.kind === "presentation_animation";
  const title = variant.displayName ?? pose.english;

  const prepSec = (learn ? 12 : 5) + Math.max(0, prepExtraSec);
  const entrySec = learn ? 18 : 8;
  const holdSec = Math.max(
    learn ? 12 : 8,
    Math.round(variant.holdSeconds * (learn ? 1 : 0.85)),
  );
  const exitSec = learn ? 10 : 5;
  const transitionSec = includeTransition ? (learn ? 8 : 4) : 0;

  const propsLine =
    variant.props.filter((p) => p !== "none").length > 0
      ? `Props: ${variant.props.filter((p) => p !== "none").join(", ")}.`
      : "No props required.";

  pushSeg(out, cursor, {
    id: `${pose.slug}${suffix}-prep`,
    phase: "preparation",
    durationSec: prepSec,
    cue: `Prepare for ${title}${sideLabel(side)}. ${propsLine}`,
    caption: `${title} · prepare${sideLabel(side)}`,
    breathCue: "Take a steady breath while you set up.",
    side: sideTag,
    mediaWindow: anim ? { start: 0, end: 0.35 } : null,
  });

  const entryCue = learn
    ? variant.steps[0] ?? `Move carefully into ${title}.`
    : `Enter ${title}${sideLabel(side)}.`;

  pushSeg(out, cursor, {
    id: `${pose.slug}${suffix}-entry`,
    phase: "entry",
    durationSec: entrySec,
    cue: entryCue,
    caption: learn ? variant.steps.slice(0, 2).join(" ") : entryCue,
    breathCue: pose.breathing,
    side: sideTag,
    mediaWindow: anim ? { start: 0, end: 1 } : null,
  });

  if (learn && variant.commonMistakes[0]) {
    const tipSec = Math.min(8, Math.floor(holdSec / 3));
    pushSeg(out, cursor, {
      id: `${pose.slug}${suffix}-hold-cue`,
      phase: "hold",
      durationSec: tipSec,
      cue: `Watch for: ${variant.commonMistakes[0]}.`,
      caption: variant.cues[0] ?? variant.commonMistakes[0],
      breathCue: "Keep breathing evenly.",
      side: sideTag,
      quiet: false,
      mediaWindow: null,
    });
    pushSeg(out, cursor, {
      id: `${pose.slug}${suffix}-hold`,
      phase: "hold",
      durationSec: Math.max(6, holdSec - tipSec),
      cue: variant.cues[1] ?? "Hold with soft, even breath.",
      caption: "Hold",
      breathCue: pose.breathing,
      side: sideTag,
      quiet: true,
      mediaWindow: null,
    });
  } else {
    pushSeg(out, cursor, {
      id: `${pose.slug}${suffix}-hold`,
      phase: "hold",
      durationSec: holdSec,
      cue: learn ? variant.cues[0] ?? "Hold steadily." : "Hold. Soft breath.",
      caption: "Hold",
      breathCue: pose.breathing,
      side: sideTag,
      quiet: true,
      mediaWindow: null,
    });
  }

  pushSeg(out, cursor, {
    id: `${pose.slug}${suffix}-exit`,
    phase: "exit",
    durationSec: exitSec,
    cue: learn ? `Leave ${title} with control${sideLabel(side)}.` : `Exit${sideLabel(side)}.`,
    caption: "Exit",
    side: sideTag,
    mediaWindow: anim ? { start: 0.55, end: 1 } : null,
  });

  if (includeTransition && transitionSec > 0) {
    pushSeg(out, cursor, {
      id: `${pose.slug}${suffix}-transition`,
      phase: "transition",
      durationSec: transitionSec,
      cue: "Reset your mat space for what comes next.",
      caption: "Transition",
      side: "both",
      mediaWindow: null,
    });
  }
}

export function buildPoseTimeline(opts: {
  pose: InstructorPoseDef;
  mode: InstructorMode;
  level: VariationLevel;
  adaptationId?: AdaptationId | null;
  /** Extra prep seconds for this pose only (first prep segment). */
  prepExtraSec?: number;
}): PoseTimeline {
  const prepExtraSec = Math.max(0, opts.prepExtraSec ?? 0);
  const out: InstructionSegment[] = [];
  const cursor = { t: 0 };
  const variant = resolveTeachingVariant(opts.pose, opts.level, opts.adaptationId);

  if (opts.pose.sides === "each") {
    buildSideSegments({
      pose: opts.pose,
      variant,
      mode: opts.mode,
      side: "left",
      prepExtraSec,
      cursor,
      out,
      includeTransition: false,
    });
    pushSeg(out, cursor, {
      id: `${opts.pose.slug}-side-switch`,
      phase: "side_switch",
      durationSec: opts.mode === "learn" ? 6 : 4,
      cue: "Switch sides when you are ready.",
      caption: "Switch sides",
      side: "both",
      mediaWindow: null,
    });
    buildSideSegments({
      pose: opts.pose,
      variant,
      mode: opts.mode,
      side: "right",
      prepExtraSec: 0,
      cursor,
      out,
      includeTransition: true,
    });
  } else {
    buildSideSegments({
      pose: opts.pose,
      variant,
      mode: opts.mode,
      side: "both",
      prepExtraSec,
      cursor,
      out,
      includeTransition: true,
    });
  }

  return {
    slug: opts.pose.slug,
    mode: opts.mode,
    level: opts.level,
    adaptationId: opts.adaptationId ?? null,
    prepExtraSec,
    segments: out,
    totalSec: cursor.t,
    props: variant.props,
    mediaKind: variant.media.kind,
    displayName: variant.displayName ?? opts.pose.english,
  };
}

export function buildSessionTimeline(opts: {
  poses: InstructorPoseDef[];
  mode: InstructorMode;
  level: VariationLevel;
  /** Optional per-poseId level overrides (e.g. forced beginner). */
  levelByPoseId?: Record<string, VariationLevel>;
  /** Per poseId adaptation overrides. */
  adaptations?: Record<string, AdaptationId>;
  /** Per poseIndex prep extras (only current prep when player bumps). */
  prepExtraByPoseIndex?: Record<number, number>;
  prepExtraSec?: number;
}): {
  poses: PoseTimeline[];
  totalSec: number;
  flat: FlatSegment[];
} {
  const poses = opts.poses.map((pose, poseIndex) =>
    buildPoseTimeline({
      pose,
      mode: opts.mode,
      level: opts.levelByPoseId?.[pose.poseId] ?? opts.level,
      adaptationId: opts.adaptations?.[pose.poseId] ?? null,
      prepExtraSec:
        opts.prepExtraByPoseIndex?.[poseIndex] ??
        (poseIndex === 0 ? opts.prepExtraSec ?? 0 : 0),
    }),
  );
  const flat: FlatSegment[] = [];
  let abs = 0;
  poses.forEach((pt, poseIndex) => {
    for (const seg of pt.segments) {
      flat.push({ ...seg, poseIndex, absStartSec: abs + seg.startSec });
    }
    abs += pt.totalSec;
  });
  return { poses, totalSec: abs, flat };
}

/**
 * After extending the current preparation segment, remap the clock so the
 * user stays at the same relative position in the current prep (or at the
 * end of prep if they already passed the old duration).
 */
export function remapClockAfterPrepExtend(opts: {
  flatBefore: FlatSegment[];
  flatAfter: FlatSegment[];
  timeSec: number;
  prepSegmentId: string;
  addedSec: number;
}): number {
  const before = opts.flatBefore.find((s) => s.id === opts.prepSegmentId);
  const after = opts.flatAfter.find((s) => s.id === opts.prepSegmentId);
  if (!before || !after) return opts.timeSec + opts.addedSec;
  const local = opts.timeSec - before.absStartSec;
  if (local < 0) return opts.timeSec;
  if (local >= before.durationSec) {
    // Already past prep — shift by the inserted duration so later segments stay aligned.
    return opts.timeSec + opts.addedSec;
  }
  return after.absStartSec + local;
}

export function segmentAtTime(flat: FlatSegment[], timeSec: number) {
  if (flat.length === 0) return null;
  const t = Math.max(0, timeSec);
  for (let i = flat.length - 1; i >= 0; i--) {
    const s = flat[i];
    if (t >= s.absStartSec) return { ...s, index: i };
  }
  return { ...flat[0], index: 0 };
}

export function phaseLabel(phase: TimelinePhase): string {
  switch (phase) {
    case "preparation":
      return "Prepare";
    case "entry":
      return "Enter";
    case "hold":
      return "Hold";
    case "exit":
      return "Exit";
    case "side_switch":
      return "Switch sides";
    case "transition":
      return "Transition";
    default:
      return "";
  }
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
