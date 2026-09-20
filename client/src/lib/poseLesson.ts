/**
 * One authoritative timeline for teaching a catalog pose.
 *
 * Everything the lesson shows — demonstration segment, narration, caption,
 * step number, body-area highlight, side, variation, phase and remaining time
 * — is read from the segment that is current at time t. Previously the step
 * index came from narration timing, the figure came from a video scrub, the
 * highlight came from a regex over the cue text, and the "Hold ~45s" label came
 * from a catalog field none of them consulted, so they routinely disagreed.
 *
 * Static poses:   preparation → entry → hold → exit ( → side change → repeat )
 * Dynamic poses:  preparation → entry → cycle × rounds → exit
 */
import type { Asana, Variation } from "@/data/content";
import { asanaBySlug } from "@/data/content";
import {
  isDynamicPractice,
  poseDemoAvailability,
  type PoseDemoAvailability,
  type VariationLevel,
} from "@/data/poseDemoAvailability";
import type { FocusZone } from "@/lib/poseMoments";

export type LessonPhase =
  | "preparation"
  | "entry"
  | "hold"
  | "cycle"
  | "exit"
  | "side_change";

export type BreathMovement = "inhale" | "exhale" | "neutral";

export type LessonSegment = {
  id: string;
  phase: LessonPhase;
  /** 1-based teaching step, or null for transitions that are not steps. */
  stepNumber: number | null;
  startSec: number;
  durationSec: number;
  /** The single primary instruction on screen. */
  cue: string;
  caption: string;
  breathCue: string | null;
  side: "left" | "right" | "both";
  /**
   * Authored highlight only. Inferred coordinates pointed at the wrong body
   * part often enough (Warrior II "arms extended" → the head) that guessing is
   * worse than omitting.
   */
  focus: FocusZone | null;
  /** Present on `cycle` segments. */
  cycle: { round: number; totalRounds: number; movement: BreathMovement } | null;
};

export type PoseLesson = {
  slug: string;
  english: string;
  level: VariationLevel;
  kind: "dynamic" | "static";
  sides: "once" | "each";
  segments: LessonSegment[];
  totalSec: number;
  /** Rounds for a dynamic practice; null for a hold. */
  rounds: number | null;
  /** "8 rounds · about 1:20" or "Hold about 40s each side" — never both. */
  durationLabel: string;
  props: string[];
  demo: PoseDemoAvailability;
  /**
   * Set when the picture on screen does not depict the selected variation —
   * e.g. Tree's beginner setup is toes-down with a hand on a wall, but the only
   * image is the unsupported balance. Disclosing beats silently showing a
   * different variation.
   */
  variationVisualMismatch: string | null;
  /** Steps as displayed in the numbered list, matching the segments. */
  steps: Array<{ number: number; text: string }>;
};

function pushSegment(
  out: LessonSegment[],
  cursor: { t: number },
  seg: Omit<LessonSegment, "startSec">,
): void {
  out.push({ ...seg, startSec: cursor.t });
  cursor.t += Math.max(0, seg.durationSec);
}

/**
 * Poses whose authored focus zones have been checked against the illustration
 * that is actually on screen, at the framing it is actually rendered at.
 *
 * Empty, deliberately. The catalog's zones are hand-written normalized
 * coordinates that assume a particular figure framing, and at least one is
 * demonstrably wrong: Warrior II's "Arms extended" is {cy: 0.30, r: 0.26},
 * which spans from the crown to the waist — the reported bug where the arms
 * cue highlighted the head. Until a reviewer confirms a pose's zones land on
 * the right body parts, no halo is drawn for it.
 */
export const VERIFIED_FOCUS_POSES = new Set<string>();

/**
 * Authored zones only, and only for poses whose zones have been verified.
 * Pointing at the wrong body part teaches the wrong thing, so the fallback is
 * no highlight rather than an approximate one.
 */
function authoredFocus(
  slug: string,
  step: { focusZone?: FocusZone | null } | undefined,
): FocusZone | null {
  if (!VERIFIED_FOCUS_POSES.has(slug)) return null;
  return step?.focusZone ?? null;
}

function variationFor(asana: Asana, level: VariationLevel): Variation | undefined {
  return asana.variations?.[level];
}

function stepsFor(asana: Asana, level: VariationLevel): Array<{ text: string; focusZone?: FocusZone | null }> {
  const v = variationFor(asana, level);
  if (v?.steps && v.steps.length > 0) return v.steps;
  return asana.steps;
}

function sidesFor(asana: Asana): "once" | "each" {
  return /each side/i.test(asana.hold ?? "") ? "each" : "once";
}

/**
 * Swap the left/right words in a cue.
 *
 * Catalog steps are written for one side ("turn the right foot out 90°").
 * Replaying that verbatim on the second side tells the practitioner to set up
 * the side they have just finished.
 */
export function mirrorCue(text: string): string {
  return text.replace(/\b(left|right|Left|Right)\b/g, (m) => {
    switch (m) {
      case "left":
        return "right";
      case "right":
        return "left";
      case "Left":
        return "Right";
      default:
        return "Left";
    }
  });
}

/** Which side the catalog steps are written for, so the mirror goes the right way. */
export function namedSideIn(steps: Array<{ text: string }>): "left" | "right" {
  let left = 0;
  let right = 0;
  for (const s of steps) {
    left += (s.text.match(/\bleft\b/gi) ?? []).length;
    right += (s.text.match(/\bright\b/gi) ?? []).length;
  }
  // Warrior II and Tree both name the working side more often than the
  // supporting one; ties fall back to right, the conventional first side.
  return left > right ? "left" : "right";
}

/**
 * The variation actually changes the shape, but the catalog authors no
 * per-variation steps — every level falls back to the same generic cues. That
 * is how a beginner reading "place the sole on the inner thigh" was shown a
 * variation described as "toes on the floor, one hand on a wall".
 *
 * The variation's own description is authored content, so surface it as the
 * setup instruction rather than inventing new cueing.
 */
export function variationSetupCue(asana: Asana, level: VariationLevel): string | null {
  const v = variationFor(asana, level);
  const description = v?.description?.trim();
  if (!description) return null;
  const props = (v?.props ?? []).filter((p) => p && p !== "none");
  const propLine = props.length ? ` Props: ${props.join(", ")}.` : "";
  return `${description}${propLine}`;
}

function sideSuffix(side: "left" | "right" | "both"): string {
  return side === "both" ? "" : ` · ${side} side`;
}

/** Rounds for a flowing practice, derived from the variation's time budget. */
export function roundsFor(asana: Asana, level: VariationLevel): number {
  const seconds = variationFor(asana, level)?.holdSeconds ?? asana.holdSeconds ?? 60;
  // One round is one full breath in and out — about 8 seconds at a teaching pace.
  return Math.max(4, Math.min(12, Math.round(seconds / 8)));
}

const SECONDS_PER_HALF_CYCLE = 4;

/**
 * Cat–Cow and friends: a neutral setup, then distinct inhale and exhale
 * movements repeated for a number of rounds, finishing back in neutral.
 */
function buildDynamicSegments(opts: {
  asana: Asana;
  level: VariationLevel;
  steps: Array<{ text: string; focusZone?: FocusZone | null }>;
  out: LessonSegment[];
  cursor: { t: number };
}): number {
  const { asana, level, steps, out, cursor } = opts;
  const rounds = roundsFor(asana, level);
  const slug = asana.slug;

  // Step 1 — the starting position, held still long enough to copy.
  const setup = variationSetupCue(asana, level);
  pushSegment(out, cursor, {
    id: `${slug}-prep`,
    phase: "preparation",
    stepNumber: 1,
    durationSec: 10,
    cue: setup
      ? `${steps[0]?.text ?? "Set up your starting position."} ${setup}`.trim()
      : steps[0]?.text ?? "Set up your starting position.",
    caption: `${asana.english} · set up`,
    breathCue: "Settle your breath before you move.",
    side: "both",
    focus: authoredFocus(slug, steps[0]),
    cycle: null,
  });

  // The two shapes taught once each, slowly, before they are repeated.
  const inhaleStep = steps[1];
  const exhaleStep = steps[2];

  pushSegment(out, cursor, {
    id: `${slug}-teach-inhale`,
    phase: "entry",
    stepNumber: 2,
    durationSec: 8,
    cue: inhaleStep?.text ?? "Inhale into the first shape.",
    caption: `${asana.english} · first shape`,
    breathCue: "Inhale",
    side: "both",
    focus: authoredFocus(slug, inhaleStep),
    cycle: null,
  });

  pushSegment(out, cursor, {
    id: `${slug}-teach-exhale`,
    phase: "entry",
    stepNumber: 3,
    durationSec: 8,
    cue: exhaleStep?.text ?? "Exhale into the second shape.",
    caption: `${asana.english} · second shape`,
    breathCue: "Exhale",
    side: "both",
    focus: authoredFocus(slug, exhaleStep),
    cycle: null,
  });

  // Then the practice itself: one movement per breath, for real rounds.
  for (let round = 1; round <= rounds; round++) {
    pushSegment(out, cursor, {
      id: `${slug}-cycle-${round}-inhale`,
      phase: "cycle",
      stepNumber: 4,
      durationSec: SECONDS_PER_HALF_CYCLE,
      cue: inhaleStep?.text ?? "Inhale into the first shape.",
      caption: `Round ${round} of ${rounds} · inhale`,
      breathCue: "Inhale",
      side: "both",
      focus: authoredFocus(slug, inhaleStep),
      cycle: { round, totalRounds: rounds, movement: "inhale" },
    });
    pushSegment(out, cursor, {
      id: `${slug}-cycle-${round}-exhale`,
      phase: "cycle",
      stepNumber: 4,
      durationSec: SECONDS_PER_HALF_CYCLE,
      cue: exhaleStep?.text ?? "Exhale into the second shape.",
      caption: `Round ${round} of ${rounds} · exhale`,
      breathCue: "Exhale",
      side: "both",
      focus: authoredFocus(slug, exhaleStep),
      cycle: { round, totalRounds: rounds, movement: "exhale" },
    });
  }

  // Finish where we started.
  pushSegment(out, cursor, {
    id: `${slug}-exit`,
    phase: "exit",
    stepNumber: steps.length,
    durationSec: 8,
    cue: steps[steps.length - 1]?.text ?? "Return to a neutral starting position.",
    caption: `${asana.english} · return to neutral`,
    breathCue: "Let the breath settle.",
    side: "both",
    focus: authoredFocus(slug, steps[steps.length - 1]),
    cycle: null,
  });

  return rounds;
}

/** A held shape: prepare, enter, hold, exit — per side when the pose needs both. */
function buildStaticSideSegments(opts: {
  asana: Asana;
  level: VariationLevel;
  steps: Array<{ text: string; focusZone?: FocusZone | null }>;
  side: "left" | "right" | "both";
  holdSec: number;
  /** True when this side's cues must be mirrored from the authored text. */
  mirrored: boolean;
  out: LessonSegment[];
  cursor: { t: number };
}): void {
  const { asana, level, steps, side, holdSec, mirrored, out, cursor } = opts;
  const slug = asana.slug;
  const tag = side === "both" ? "" : `-${side}`;
  const say = (text: string) => (mirrored ? mirrorCue(text) : text);

  // Everything before the last step teaches getting in; the last step is the
  // hold itself. Splitting here is what lets the hold timer start after entry.
  const entrySteps = steps.slice(0, Math.max(1, steps.length - 1));
  const holdStep = steps[steps.length - 1];
  const setup = variationSetupCue(asana, level);

  pushSegment(out, cursor, {
    id: `${slug}${tag}-prep`,
    phase: "preparation",
    stepNumber: 1,
    durationSec: 10,
    // The variation's own setup leads, because it is what the practitioner is
    // about to do; the generic first step follows it.
    cue: setup
      ? `${setup} ${say(entrySteps[0]?.text ?? "")}`.trim()
      : say(entrySteps[0]?.text ?? `Set up for ${asana.english}.`),
    caption: `${asana.english} · ${level} · set up${sideSuffix(side)}`,
    breathCue: "Find your starting position.",
    side,
    focus: authoredFocus(slug, entrySteps[0]),
    cycle: null,
  });

  for (let i = 1; i < entrySteps.length; i++) {
    pushSegment(out, cursor, {
      id: `${slug}${tag}-entry-${i}`,
      phase: "entry",
      stepNumber: i + 1,
      durationSec: 8,
      cue: say(entrySteps[i]!.text),
      caption: `${asana.english} · step ${i + 1}${sideSuffix(side)}`,
      breathCue: null,
      side,
      focus: authoredFocus(slug, entrySteps[i]),
      cycle: null,
    });
  }

  pushSegment(out, cursor, {
    id: `${slug}${tag}-hold`,
    phase: "hold",
    stepNumber: steps.length,
    durationSec: holdSec,
    cue: say(holdStep?.text ?? "Hold with steady breath."),
    caption: `Hold${sideSuffix(side)}`,
    breathCue: asana.breathing,
    side,
    focus: authoredFocus(slug, holdStep),
    cycle: null,
  });

  pushSegment(out, cursor, {
    id: `${slug}${tag}-exit`,
    phase: "exit",
    stepNumber: null,
    durationSec: 6,
    cue: `Come out of ${asana.english} with control${sideSuffix(side)}.`,
    caption: `Exit${sideSuffix(side)}`,
    breathCue: null,
    side,
    focus: null,
    cycle: null,
  });
}

/**
 * There is exactly one illustration per pose, so any variation whose setup
 * differs visibly from that picture is being misrepresented. Say so.
 */
export function variationVisualMismatchFor(
  asana: Asana,
  level: VariationLevel,
): string | null {
  const v = variationFor(asana, level);
  const description = v?.description?.trim();
  if (!v || !description) return null;
  const props = (v.props ?? []).filter((p) => p && p !== "none");
  // A prop in the shape, or an explicitly different limb position, means the
  // single catalog illustration cannot be showing this variation.
  const changesTheShape =
    props.length > 0 ||
    /\b(kickstand|toes? on the floor|hand on a wall|knees? down|forearms?|fists?|partway|shorten(ed)? (the )?stance|chair|blanket|bolster|block|strap|wall)\b/i.test(
      description,
    );
  if (!changesTheShape) return null;
  return `The picture shows ${asana.english} in its standard shape, not the ${level} variation described here${
    props.length ? ` (${props.join(", ")})` : ""
  }. Follow the written setup.`;
}

export function buildPoseLesson(opts: {
  slug: string;
  level?: VariationLevel;
}): PoseLesson | null {
  const asana = asanaBySlug(opts.slug);
  if (!asana) return null;
  const level = opts.level ?? "intermediate";
  const steps = stepsFor(asana, level);
  const dynamic = isDynamicPractice(asana);
  const sides = dynamic ? "once" : sidesFor(asana);
  const variation = variationFor(asana, level);
  const holdSec = variation?.holdSeconds ?? asana.holdSeconds ?? 30;

  const segments: LessonSegment[] = [];
  const cursor = { t: 0 };
  let rounds: number | null = null;

  if (dynamic) {
    rounds = buildDynamicSegments({ asana, level, steps, out: segments, cursor });
  } else if (sides === "each") {
    // Teach the side the catalog text is written for first, then mirror.
    const firstSide = namedSideIn(steps);
    const secondSide = firstSide === "right" ? "left" : "right";
    buildStaticSideSegments({
      asana,
      level,
      steps,
      side: firstSide,
      holdSec,
      mirrored: false,
      out: segments,
      cursor,
    });
    pushSegment(segments, cursor, {
      id: `${asana.slug}-side-change`,
      phase: "side_change",
      stepNumber: null,
      durationSec: 8,
      cue: `Release ${asana.english}, come back to your starting position, and set up on the ${secondSide} side.`,
      caption: `Switch sides · now the ${secondSide} side`,
      breathCue: null,
      side: "both",
      focus: null,
      cycle: null,
    });
    buildStaticSideSegments({
      asana,
      level,
      steps,
      side: secondSide,
      holdSec,
      mirrored: true,
      out: segments,
      cursor,
    });
  } else {
    buildStaticSideSegments({
      asana,
      level,
      steps,
      side: "both",
      holdSec,
      mirrored: false,
      out: segments,
      cursor,
    });
  }

  return {
    slug: asana.slug,
    english: asana.english,
    level,
    kind: dynamic ? "dynamic" : "static",
    sides,
    segments,
    totalSec: cursor.t,
    rounds,
    durationLabel: durationLabelFor({
      dynamic,
      rounds,
      totalSec: cursor.t,
      holdSec,
      sides,
    }),
    props: variation?.props?.length ? variation.props.filter((p) => p !== "none") : [],
    demo: poseDemoAvailability(asana.slug, level),
    variationVisualMismatch: variationVisualMismatchFor(asana, level),
    steps: steps.map((s, i) => ({ number: i + 1, text: s.text })),
  };
}

export function formatLessonClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * A flowing practice gets rounds and a duration; a held shape gets a hold.
 * Never "Hold ~45s" for something the instructions tell you to keep moving in.
 */
export function durationLabelFor(opts: {
  dynamic: boolean;
  rounds: number | null;
  totalSec: number;
  holdSec: number;
  sides: "once" | "each";
}): string {
  if (opts.dynamic && opts.rounds) {
    return `${opts.rounds} rounds · about ${formatLessonClock(opts.totalSec)}`;
  }
  const each = opts.sides === "each" ? " each side" : "";
  return `Hold about ${Math.round(opts.holdSec)}s${each}`;
}

export function segmentAt(lesson: PoseLesson, timeSec: number): (LessonSegment & { index: number }) | null {
  const segs = lesson.segments;
  if (segs.length === 0) return null;
  const t = Math.max(0, timeSec);
  for (let i = segs.length - 1; i >= 0; i--) {
    if (t >= segs[i]!.startSec) return { ...segs[i]!, index: i };
  }
  return { ...segs[0]!, index: 0 };
}

/** Start of the segment containing `timeSec` — used by Replay. */
export function segmentStartAt(lesson: PoseLesson, timeSec: number): number {
  return segmentAt(lesson, timeSec)?.startSec ?? 0;
}

/**
 * Step boundaries for Back / Next. Consecutive segments that share a step
 * number are one teaching step, so Next from mid-cycle goes to the exit rather
 * than to the next breath.
 */
export function stepBoundaries(lesson: PoseLesson): number[] {
  const out: number[] = [];
  let lastKey = "";
  for (const seg of lesson.segments) {
    const key = `${seg.stepNumber ?? "x"}-${seg.side}-${seg.phase === "cycle" ? "cycle" : seg.phase}`;
    if (key !== lastKey) {
      out.push(seg.startSec);
      lastKey = key;
    }
  }
  return out;
}

export function nextStepStart(lesson: PoseLesson, timeSec: number): number {
  const bounds = stepBoundaries(lesson);
  for (const b of bounds) if (b > timeSec + 0.01) return b;
  return lesson.totalSec;
}

export function previousStepStart(lesson: PoseLesson, timeSec: number): number {
  const bounds = stepBoundaries(lesson);
  const current = bounds.filter((b) => b <= timeSec + 0.01).pop() ?? 0;
  const before = bounds.filter((b) => b < current - 0.01).pop();
  return before ?? 0;
}

export function phaseLabelFor(phase: LessonPhase): string {
  switch (phase) {
    case "preparation":
      return "Set up";
    case "entry":
      return "Move in";
    case "hold":
      return "Hold";
    case "cycle":
      return "Flow";
    case "exit":
      return "Come out";
    case "side_change":
      return "Switch sides";
  }
}
