/**
 * Build a shared instructor timeline for Learn / Flow modes.
 * Segments coordinate demo windows, captions, breath cues, and holds.
 */
import type {
  InstructorMode,
  InstructorPoseDef,
  InstructionSegment,
  TimelinePhase,
  VariationLevel,
} from "@/data/instructorPilot";

export type PoseTimeline = {
  slug: string;
  mode: InstructorMode;
  level: VariationLevel;
  prepExtraSec: number;
  segments: InstructionSegment[];
  totalSec: number;
  props: string[];
  mediaKind: string;
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
  level: VariationLevel;
  mode: InstructorMode;
  side: "left" | "right" | "both";
  prepExtraSec: number;
  cursor: { t: number };
  out: InstructionSegment[];
  includeTransition: boolean;
}) {
  const { pose, level, mode, side, prepExtraSec, cursor, out, includeTransition } = opts;
  const variant = pose.variants[level];
  const learn = mode === "learn";
  const sideTag = side === "both" ? "both" : side;
  const suffix = side === "both" ? "" : `-${side}`;
  const anim = variant.media.kind === "presentation_animation";

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
    cue: `Prepare for ${pose.english}${sideLabel(side)}. ${propsLine}`,
    caption: `${pose.english} · prepare${sideLabel(side)}`,
    breathCue: "Take a steady breath while you set up.",
    side: sideTag,
    mediaWindow: anim ? { start: 0, end: 0.35 } : null,
  });

  const entryCue = learn
    ? variant.steps[0] ?? `Move carefully into ${pose.english}.`
    : `Enter ${pose.english}${sideLabel(side)}.`;

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
    cue: learn
      ? `Leave ${pose.english} with control${sideLabel(side)}.`
      : `Exit${sideLabel(side)}.`,
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
  prepExtraSec?: number;
}): PoseTimeline {
  const prepExtraSec = Math.max(0, opts.prepExtraSec ?? 0);
  const out: InstructionSegment[] = [];
  const cursor = { t: 0 };
  const variant = opts.pose.variants[opts.level];

  if (opts.pose.sides === "each") {
    buildSideSegments({
      pose: opts.pose,
      level: opts.level,
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
      level: opts.level,
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
      level: opts.level,
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
    prepExtraSec,
    segments: out,
    totalSec: cursor.t,
    props: variant.props,
    mediaKind: variant.media.kind,
  };
}

export function buildSessionTimeline(opts: {
  poses: InstructorPoseDef[];
  mode: InstructorMode;
  level: VariationLevel;
  prepExtraSec?: number;
}): {
  poses: PoseTimeline[];
  totalSec: number;
  flat: FlatSegment[];
} {
  const poses = opts.poses.map((pose) =>
    buildPoseTimeline({
      pose,
      mode: opts.mode,
      level: opts.level,
      prepExtraSec: opts.prepExtraSec,
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
