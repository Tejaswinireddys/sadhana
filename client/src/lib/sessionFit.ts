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
  resolveInstructionSeconds,
  type GuidedTimedPose,
} from "@/lib/guidedDuration";

/** Seconds a pose costs before a single second of hold is counted. */
export function poseOverheadSeconds(pose: GuidedTimedPose): number {
  const instruction = resolveInstructionSeconds(pose);
  const each = pose.sides === "each";
  return TRANSITION_SECONDS + instruction * (each ? 2 : 1) + (each ? SIDE_SWITCH_SECONDS : 0);
}

/** Narration + transitions for the whole queue — the part holds cannot shrink. */
export function sessionOverheadSeconds(poses: GuidedTimedPose[]): number {
  return poses.reduce((sum, p) => sum + poseOverheadSeconds(p), 0);
}

/** How many seconds of hold are left for a target wall-clock. Never negative. */
export function holdBudgetSeconds(targetSeconds: number, poses: GuidedTimedPose[]): number {
  return Math.max(0, targetSeconds - sessionOverheadSeconds(poses));
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

export function evaluateSessionFit(opts: {
  requestedMinutes: number;
  poses: GuidedTimedPose[];
  /** Per-pose minimum hold, index-aligned with `poses`. Defaults to the pose hold. */
  minHoldSeconds?: number[];
}): SessionFit {
  const requestedSeconds = Math.max(0, Math.round(opts.requestedMinutes * 60));
  const plannedSeconds = Math.round(guidedSessionSeconds(opts.poses));
  const floorPoses = opts.poses.map((p, i) => ({
    ...p,
    holdSeconds: Math.max(0, opts.minHoldSeconds?.[i] ?? p.holdSeconds),
  }));
  const floorSeconds = Math.round(guidedSessionSeconds(floorPoses));
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
  const explanation = belowFloor
    ? `A guided ${opts.poses.length}-pose practice runs about ${plannedMinutes} min because each pose is talked through before you hold it. Even at the shortest safe holds it is ${floorMinutes} min — ${Math.round(requestedSeconds / 60)} min is not enough time for this sequence.`
    : `This runs about ${plannedMinutes} min, not ${Math.round(requestedSeconds / 60)} min — spoken instruction and transitions are counted, not just the holds.`;

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
