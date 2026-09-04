/**
 * Honest guided-session timing: phases, instruction remaining, and wall-clock
 * estimates that include narration instead of hold-only countdowns.
 */
import { SIDE_SWITCH_SECONDS, TRANSITION_SECONDS } from "@/data/quickSessions";

export type GuidedPhase = "transitionIn" | "instruction" | "hold" | "sideSwitch";

export function estimateInstructionSeconds(stepCount: number, voiceDuration = 0): number {
  if (voiceDuration > 0 && Number.isFinite(voiceDuration)) {
    return Math.max(1, Math.round(voiceDuration));
  }
  if (stepCount <= 0) return 20;
  return Math.min(90, Math.max(15, stepCount * 8));
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
  poses: Array<{
    holdSeconds: number;
    sides?: "each" | "once" | "single";
    stepCount?: number;
    instructionSeconds?: number;
  }>,
): number {
  return poses.reduce((sum, p) => {
    const instruction =
      p.instructionSeconds ?? estimateInstructionSeconds(p.stepCount ?? 0);
    return sum + guidedPoseSeconds({
      holdSeconds: p.holdSeconds,
      sides: p.sides,
      instructionSeconds: instruction,
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

/** Footer remaining-time copy. Never invent a leftover minute at 0:00. */
export function remainingFooterLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s === 0) return "wrapping up";
  if (s < 60) return `${s} sec left`;
  return `~${Math.round(s / 60)} min left`;
}

/** Remaining wall-clock from the live phase, not elapsed subtracted from a stale total. */
export function remainingFromPhases(opts: {
  poses: Array<{
    holdSeconds: number;
    sides?: "each" | "once" | "single";
    stepCount?: number;
    instructionSeconds?: number;
  }>;
  index: number;
  phase: GuidedPhase | string;
  instructionLeft: number;
  phaseRemaining: number;
}): number {
  const current = opts.poses[opts.index];
  if (!current) return 0;
  const hold = Math.max(0, current.holdSeconds);
  const instruction = current.instructionSeconds ?? estimateInstructionSeconds(current.stepCount ?? 0);
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
