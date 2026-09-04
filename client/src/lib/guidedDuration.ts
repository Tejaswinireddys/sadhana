/**
 * Honest guided-session timing: phases, instruction remaining, and wall-clock
 * estimates that include recorded narration — the same numbers preview cards,
 * the preparation screen, and the live player should all show.
 */
import { formatDuration } from "@/lib/formatDuration";
import { narrationSecondsFor } from "@/data/narrationDurations";

export const TRANSITION_SECONDS = 5;
export const SIDE_SWITCH_SECONDS = 2;

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

/** Prefer recorded MP3 length, then an explicit override, then step-count estimate. */
export function resolveInstructionSeconds(pose: GuidedTimedPose): number {
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

export function guidedSessionSeconds(poses: GuidedTimedPose[]): number {
  return poses.reduce((sum, p) => {
    return sum + guidedPoseSeconds({
      holdSeconds: p.holdSeconds,
      sides: p.sides,
      instructionSeconds: resolveInstructionSeconds(p),
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

/** Remaining wall-clock from the live phase, not elapsed subtracted from a stale total. */
export function remainingFromPhases(opts: {
  poses: GuidedTimedPose[];
  index: number;
  phase: GuidedPhase | string;
  instructionLeft: number;
  phaseRemaining: number;
}): number {
  const current = opts.poses[opts.index];
  if (!current) return 0;
  const hold = Math.max(0, current.holdSeconds);
  const instruction = resolveInstructionSeconds(current);
  let currentLeft = 0;
  switch (opts.phase) {
    case "transitionIn":
      currentLeft = Math.max(0, opts.phaseRemaining) + instruction + hold;
      break;
    case "instruction":
      currentLeft = Math.max(0, opts.instructionLeft) + hold;
      break;
    case "sideSwitch":
      currentLeft = Math.max(0, opts.phaseRemaining) + instruction + hold;
      break;
    case "hold":
      currentLeft = Math.max(0, opts.phaseRemaining);
      break;
    default:
      currentLeft = 0;
  }
  const later = guidedSessionSeconds(opts.poses.slice(opts.index + 1));
  return Math.max(0, Math.round(currentLeft + later));
}
