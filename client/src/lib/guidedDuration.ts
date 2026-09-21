/**
 * Honest guided-session timing: phases, instruction remaining, and wall-clock
 * estimates that include recorded narration — the same numbers preview cards,
 * the preparation screen, and the live player should all show.
 *
 * One thing this module learned the hard way: a session has no single length
 * until you know *how it will be taught*. The player speaks 55–70s of recorded
 * narration per pose when voice is on, reads the steps in a 12s silent window
 * when voice is off, and speaks nothing at all in the timer-only mode on
 * /practice. Advertising the narrated number to someone practising in silence
 * overstates a four-pose wind-down by three and a half minutes. Every duration
 * here therefore takes an `InstructionMode`, and every screen passes the mode
 * the practitioner will actually get.
 */
import { formatDuration } from "@/lib/formatDuration";
import { narrationSecondsFor } from "@/data/narrationDurations";

export const TRANSITION_SECONDS = 5;
export const SIDE_SWITCH_SECONDS = 2;

/**
 * Seconds the player spends walking the steps on screen when there is no
 * recorded voice. Must stay equal to GuidedSession's SILENT_INSTRUCTION —
 * `guidedDuration.test.ts` pins that.
 */
export const BRIEF_INSTRUCTION_SECONDS = 12;

/**
 * How a queue will be taught.
 *
 * - `guided` — recorded narration per pose (Learn). The default everywhere.
 * - `brief`  — on-screen steps in a short window, no recorded voice (Flow /
 *              voice turned off in settings).
 * - `timer`  — holds and transitions only, no instruction phase at all.
 */
export type InstructionMode = "guided" | "brief" | "timer";

export const INSTRUCTION_MODE_LABEL: Record<InstructionMode, string> = {
  guided: "Voice-guided",
  brief: "Captions only",
  timer: "Timer only",
};

/** One-line description of what the practitioner will hear and read. */
export function instructionModeDescription(mode: InstructionMode): string {
  switch (mode) {
    case "guided":
      return "Recorded voice talks you into each pose, with captions on screen.";
    case "brief":
      return "No voice — each pose's steps appear on screen for a few seconds before the hold.";
    case "timer":
      return "No instruction — just the hold timer and a chime between poses.";
  }
}

export type GuidedPhase = "transitionIn" | "instruction" | "hold" | "sideSwitch";

export type GuidedTimedPose = {
  holdSeconds: number;
  sides?: "each" | "once" | "single";
  stepCount?: number;
  instructionSeconds?: number;
  slug?: string;
};

export function estimateInstructionSeconds(stepCount: number, voiceDuration = 0): number {
  if (voiceDuration > 0 && Number.isFinite(voiceDuration)) {
    return Math.max(1, Math.round(voiceDuration));
  }
  if (stepCount <= 0) return 20;
  return Math.min(90, Math.max(15, stepCount * 8));
}

/**
 * Prefer recorded MP3 length, then an explicit override, then step-count
 * estimate — but only in `guided`. In `brief` the player never plays the
 * recording, so its length is not part of this practice; in `timer` there is
 * no instruction phase to time.
 */
export function resolveInstructionSeconds(
  pose: GuidedTimedPose,
  mode: InstructionMode = "guided",
): number {
  if (mode === "timer") return 0;
  if (mode === "brief") return BRIEF_INSTRUCTION_SECONDS;
  if (pose.instructionSeconds != null && pose.instructionSeconds > 0) {
    return Math.max(1, Math.round(pose.instructionSeconds));
  }
  return estimateInstructionSeconds(pose.stepCount ?? 0, narrationSecondsFor(pose.slug));
}

export function guidedPoseSeconds(opts: {
  holdSeconds: number;
  sides?: "each" | "once" | "single";
  instructionSeconds: number;
}): number {
  const instruction = Math.max(0, opts.instructionSeconds);
  const hold = Math.max(0, opts.holdSeconds);
  const oneSide = TRANSITION_SECONDS + instruction + hold;
  if (opts.sides === "each") return oneSide + SIDE_SWITCH_SECONDS + instruction + hold;
  return oneSide;
}

export function guidedSessionSeconds(
  poses: GuidedTimedPose[],
  mode: InstructionMode = "guided",
): number {
  return poses.reduce((sum, p) => {
    return sum + guidedPoseSeconds({
      holdSeconds: p.holdSeconds,
      sides: p.sides,
      instructionSeconds: resolveInstructionSeconds(p, mode),
    });
  }, 0);
}

/** Hold is independent of narration — never shrink a chosen hold to hide leftover voice. */
export function holdRemainingAfterInstruction(holdSeconds: number, extension = 0): number {
  return Math.max(1, Math.round(holdSeconds)) + extension;
}

export function instructionCountdown(opts: {
  usingMp3: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  phaseRemaining: number;
}): number {
  if (opts.usingMp3 && opts.audioDuration > 0) {
    return Math.max(0, Math.round(opts.audioDuration - opts.audioCurrentTime));
  }
  return Math.max(0, Math.round(opts.phaseRemaining));
}

export function guidedPhaseLabel(phase: GuidedPhase | string): string {
  switch (phase) {
    case "transitionIn":
      return "Get ready";
    case "instruction":
      return "How to";
    case "hold":
      return "Hold";
    case "sideSwitch":
      return "Switch sides";
    default:
      return "";
  }
}

/**
 * Static preview label shared by Builder, Home, quiz, and the prep screen.
 * Under 90 seconds we keep exact words (`42 sec`, `1 min 12 sec`); longer
 * sessions round to minutes so a 9-minute ritual stays "9 min".
 */
export function guidedTimeLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s === 0) return "0 sec";
  if (s < 90) return formatDuration(s);
  return `${Math.max(1, Math.round(s / 60))} min`;
}

/** Footer remaining-time copy. Same rounding as guidedTimeLabel. */
export function remainingFooterLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s === 0) return "wrapping up";
  if (s < 90) return `${formatDuration(s)} left`;
  return `~${Math.round(s / 60)} min left`;
}

/**
 * Remaining wall-clock from the live phase, not elapsed subtracted from a stale
 * total.
 *
 * Three things this has to get right, because each one produced a footer that
 * counted down to the wrong finish:
 *
 * 1. A bilateral pose is not half done when side one is. Before the switch,
 *    the second narration, the switch itself and the second hold are all still
 *    ahead — 99 seconds unaccounted for on a single Warrior II.
 * 2. "+1 min" buys hold time that has not started yet (`pendingHoldExtension`)
 *    and hold time already granted (the live `phaseRemaining` covers that).
 * 3. Slow pace stretches the player's own clock: every countdown second takes
 *    `1 / pace` real seconds, so the wall-clock estimate must divide by pace.
 */
export function remainingFromPhases(opts: {
  poses: GuidedTimedPose[];
  index: number;
  phase: GuidedPhase | string;
  instructionLeft: number;
  phaseRemaining: number;
  mode?: InstructionMode;
  /** 1 = normal. 0.75 (Slow) makes every remaining second take longer. */
  pace?: number;
  /** Seconds of "+1 min" banked for a hold that has not begun yet. */
  pendingHoldExtension?: number;
  /** Which side of a bilateral pose the player is on right now. */
  side?: 1 | 2;
}): number {
  const mode = opts.mode ?? "guided";
  const current = opts.poses[opts.index];
  if (!current) return 0;
  const hold = Math.max(0, current.holdSeconds);
  const instruction = resolveInstructionSeconds(current, mode);
  const bilateral = current.sides === "each";
  const onFirstSide = bilateral && (opts.side ?? 1) === 1;
  const extension = Math.max(0, opts.pendingHoldExtension ?? 0);
  /** Narration + switch + hold still owed for the far side of a bilateral pose. */
  const secondSide = onFirstSide ? SIDE_SWITCH_SECONDS + instruction + hold : 0;

  let currentLeft = 0;
  switch (opts.phase) {
    case "transitionIn":
      currentLeft =
        Math.max(0, opts.phaseRemaining) + instruction + hold + extension + secondSide;
      break;
    case "instruction":
      currentLeft = Math.max(0, opts.instructionLeft) + hold + extension + secondSide;
      break;
    case "sideSwitch":
      // The switch countdown is running; side two's narration and hold follow.
      currentLeft = Math.max(0, opts.phaseRemaining) + instruction + hold + extension;
      break;
    case "hold":
      currentLeft = Math.max(0, opts.phaseRemaining) + secondSide;
      break;
    default:
      currentLeft = 0;
  }
  const later = guidedSessionSeconds(opts.poses.slice(opts.index + 1), mode);
  const pace = opts.pace && opts.pace > 0 ? opts.pace : 1;
  return Math.max(0, Math.round((currentLeft + later) / pace));
}
