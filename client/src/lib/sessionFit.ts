/**
 * Does the practice we composed actually fit the duration the user asked for?
 *
 * Every generator used to budget *holds* against the requested minutes and
 * then hand the queue to a player that also speaks 55–70s of narration per
 * pose plus a 5s transition. That is how a 5-minute Trainer recommendation
 * opened as a 14-minute Practice, a 15-minute Better Sleep card ran ~22, and a
 * 10-minute Adaptive selection ran 21.
 *
 * The rule here: the wall-clock the player will run is the only number worth
 * showing. Budget holds against *what is left* after narration and
 * transitions, and when the request genuinely cannot be honored, say so and
 * name a length that can.
 */
import {
  SIDE_SWITCH_SECONDS,
  TRANSITION_SECONDS,
  guidedSessionSeconds,
  occurrenceInstructionSeconds,
  type GuidedTimedPose,
  type InstructionMode,
} from "@/lib/guidedDuration";

/** Seconds a pose costs before a single second of hold is counted. */
export function poseOverheadSeconds(
  pose: GuidedTimedPose,
  mode: InstructionMode = "guided",
): number {
  const first = occurrenceInstructionSeconds(pose, mode, { repeat: false, side: 1 });
  const each = pose.sides === "each";
  if (!each) return TRANSITION_SECONDS + first;
  const second = occurrenceInstructionSeconds(pose, mode, { repeat: false, side: 2 });
  return TRANSITION_SECONDS + first + SIDE_SWITCH_SECONDS + second;
}

/**
 * Narration + transitions for the whole queue — the part holds cannot shrink.
 * Same repeat rule as the player: a pose taught once is not re-taught.
 */
export function sessionOverheadSeconds(
  poses: GuidedTimedPose[],
  mode: InstructionMode = "guided",
): number {
  return guidedSessionSeconds(
    poses.map((p) => ({ ...p, holdSeconds: 0 })),
    mode,
  );
}

/** How many seconds of hold are left for a target wall-clock. Never negative. */
export function holdBudgetSeconds(
  targetSeconds: number,
  poses: GuidedTimedPose[],
  mode: InstructionMode = "guided",
): number {
  return Math.max(0, targetSeconds - sessionOverheadSeconds(poses, mode));
}

export type SessionFit = {
  requestedSeconds: number;
  /** What the player will actually run. */
  plannedSeconds: number;
  plannedMinutes: number;
  /** Planned is within tolerance of the request. */
  fits: boolean;
  /** Positive when the practice runs longer than asked. */
  overshootSeconds: number;
  /**
   * Shortest honest wall-clock for this exact queue — every hold at its floor.
   * A request below this cannot be satisfied by trimming holds.
   */
  floorSeconds: number;
  floorMinutes: number;
  /** Consumer sentence. Null when the request was honored. */
  explanation: string | null;
  /**
   * Shortest length that can actually hold this sequence, when no amount of
   * hold-trimming will fit the request. Null when the request is satisfiable
   * by shortening holds — there is no duration to offer in that case.
   */
  suggestedMinutes: number | null;
};

/**
 * Tolerance before we bother the user. Rounding a 5:20 practice to "5 min" is
 * honest; calling a 14-minute practice "5 min" is not.
 */
function toleranceSeconds(requestedSeconds: number): number {
  return Math.max(45, Math.round(requestedSeconds * 0.15));
}

/** What a length includes beyond the holds, for each teaching mode. */
export const DURATION_INCLUDES: Record<InstructionMode, string> = {
  guided: "including guidance",
  brief: "including on-screen cues",
  timer: "including transitions",
};

/** True for a sentence `evaluateSessionFit` wrote, wherever it ended up. */
export function isDurationFitSentence(text: string): boolean {
  return /min, including (guidance|on-screen cues|transitions) — /.test(text);
}

export function evaluateSessionFit(opts: {
  requestedMinutes: number;
  poses: GuidedTimedPose[];
  /** Per-pose minimum hold, index-aligned with `poses`. Defaults to the pose hold. */
  minHoldSeconds?: number[];
  /** How the queue will be taught. Changes the answer, so it changes the fit. */
  mode?: InstructionMode;
}): SessionFit {
  const mode = opts.mode ?? "guided";
  const requestedSeconds = Math.max(0, Math.round(opts.requestedMinutes * 60));
  const plannedSeconds = Math.round(guidedSessionSeconds(opts.poses, mode));
  const floorPoses = opts.poses.map((p, i) => ({
    ...p,
    holdSeconds: Math.max(0, opts.minHoldSeconds?.[i] ?? p.holdSeconds),
  }));
  const floorSeconds = Math.round(guidedSessionSeconds(floorPoses, mode));
  const overshootSeconds = Math.max(0, plannedSeconds - requestedSeconds);
  const fits = overshootSeconds <= toleranceSeconds(requestedSeconds);

  const plannedMinutes = Math.max(1, Math.round(plannedSeconds / 60));
  const floorMinutes = Math.max(1, Math.round(floorSeconds / 60));

  if (fits) {
    return {
      requestedSeconds,
      plannedSeconds,
      plannedMinutes,
      fits: true,
      overshootSeconds,
      floorSeconds,
      floorMinutes,
      explanation: null,
      suggestedMinutes: null,
    };
  }

  // Below the floor, trimming holds cannot help — the spoken instruction for
  // this many poses is already longer than the request.
  const belowFloor = requestedSeconds < floorSeconds;
  const including = DURATION_INCLUDES[mode];
  const asked = Math.round(requestedSeconds / 60);
  const explanation = belowFloor
    ? `These ${opts.poses.length} poses need at least ${floorMinutes} min, ${including} — ${asked} min is too short for this sequence.`
    : `This runs about ${plannedMinutes} min, ${including} — not ${asked} min.`;

  return {
    requestedSeconds,
    plannedSeconds,
    plannedMinutes,
    fits: false,
    overshootSeconds,
    floorSeconds,
    floorMinutes,
    explanation,
    suggestedMinutes: belowFloor ? floorMinutes : null,
  };
}

/**
 * Snap an achievable length onto the durations a screen actually offers, so
 * "offer a shorter option" is a chip the user can tap rather than a number
 * they have to translate. Prefers the first option that can hold the practice.
 */
/**
 * Would this queue fit the request if it were taught with captions instead of
 * a voice?
 *
 * Recorded narration is 55–70s a pose and cannot be shortened; on-screen steps
 * take twelve. That difference is often the whole overrun, so it is worth
 * offering — but as an explicit choice, never as a silent substitution. The
 * practitioner asked for a guided practice; swapping the guidance for captions
 * without telling them is not honouring the request, it is redefining it.
 */
export function briefModeFit(opts: {
  requestedMinutes: number;
  poses: GuidedTimedPose[];
  minHoldSeconds?: number[];
}): { fits: boolean; minutes: number; savedMinutes: number } {
  const guided = evaluateSessionFit({ ...opts, mode: "guided" });
  const brief = evaluateSessionFit({ ...opts, mode: "brief" });
  return {
    fits: brief.fits,
    minutes: brief.plannedMinutes,
    savedMinutes: Math.max(0, guided.plannedMinutes - brief.plannedMinutes),
  };
}

export function nearestOfferedMinutes(minutes: number, options: number[]): number | null {
  const sorted = [...options].sort((a, b) => a - b);
  return sorted.find((o) => o >= minutes) ?? sorted[sorted.length - 1] ?? null;
}

/**
 * Largest pose count whose narration + transitions still leave room for a real
 * hold on every pose. Prevents composing a 16-pose "5 minute" session that can
 * only be delivered by giving every shape a 0-second hold.
 */
export function maxPosesForBudget(opts: {
  targetSeconds: number;
  /** Typical per-pose overhead (transition + narration). */
  perPoseOverheadSeconds: number;
  /** Hold we refuse to go below. */
  minHoldSeconds: number;
  floor?: number;
  cap?: number;
}): number {
  const per = Math.max(1, opts.perPoseOverheadSeconds + Math.max(0, opts.minHoldSeconds));
  const raw = Math.floor(opts.targetSeconds / per);
  return Math.max(opts.floor ?? 1, Math.min(opts.cap ?? 16, raw));
}
