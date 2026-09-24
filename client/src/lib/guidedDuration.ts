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
 * - `guided` — **Learn.** Full recorded setup the first time a pose appears,
 *              with captions. The far side of a bilateral pose and any later
 *              repeat of the same pose get the short Flow cue instead — a
 *              Sun Salutation that replayed a minute of setup for every
 *              Downward Dog advertised 28 minutes for a 4-minute sequence.
 * - `brief`  — **Flow.** A short on-screen transition and breath cue per pose,
 *              no recorded setup (also what voice-off gets).
 * - `timer`  — **Timer only.** Holds and transitions, no instruction phase.
 */
export type InstructionMode = "guided" | "brief" | "timer";

export const INSTRUCTION_MODE_LABEL: Record<InstructionMode, string> = {
  guided: "Learn",
  brief: "Flow",
  timer: "Timer only",
};

/** One-line description of what the practitioner will hear and read. */
export function instructionModeDescription(mode: InstructionMode): string {
  switch (mode) {
    case "guided":
      return "Full voice setup the first time each pose appears, with captions. Repeats and second sides get a short cue.";
    case "brief":
      return "Short on-screen transition and breath cues — no full setup. For poses you already know.";
    case "timer":
      return "Minimal guidance — the pose name, the hold timer and a chime between poses.";
  }
}

/** The mode in a few words, for cards. */
export function instructionModeShort(mode: InstructionMode): string {
  switch (mode) {
    case "guided":
      return "Learn — voice guidance with captions";
    case "brief":
      return "Flow — short on-screen cues";
    case "timer":
      return "Timer only — minimal guidance";
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

/**
 * Whether this occurrence gets the full Learn setup. Only the first side of
 * the first appearance of a pose does; everything after it is a short cue.
 * `brief` and `timer` never teach fully.
 */
export function teachesFully(
  mode: InstructionMode,
  opts: { repeat: boolean; side: 1 | 2 },
): boolean {
  return mode === "guided" && !opts.repeat && opts.side === 1;
}

/** Instruction seconds for one side of one occurrence of a pose. */
export function occurrenceInstructionSeconds(
  pose: GuidedTimedPose,
  mode: InstructionMode,
  opts: { repeat: boolean; side: 1 | 2 },
): number {
  if (mode === "guided" && !teachesFully(mode, opts)) return BRIEF_INSTRUCTION_SECONDS;
  return resolveInstructionSeconds(pose, mode);
}

/** `true` at index i when the same pose already appeared earlier in the queue. */
export function repeatFlags(poses: Array<{ slug?: string }>): boolean[] {
  const seen = new Set<string>();
  return poses.map((p) => {
    if (!p.slug) return false;
    const repeat = seen.has(p.slug);
    seen.add(p.slug);
    return repeat;
  });
}

export function guidedPoseSeconds(opts: {
  holdSeconds: number;
  sides?: "each" | "once" | "single";
  instructionSeconds: number;
  /** Instruction on the far side; defaults to the first side's. */
  secondSideInstructionSeconds?: number;
}): number {
  const instruction = Math.max(0, opts.instructionSeconds);
  const second = Math.max(0, opts.secondSideInstructionSeconds ?? instruction);
  const hold = Math.max(0, opts.holdSeconds);
  const oneSide = TRANSITION_SECONDS + instruction + hold;
  if (opts.sides === "each") return oneSide + SIDE_SWITCH_SECONDS + second + hold;
  return oneSide;
}

function occurrenceSeconds(pose: GuidedTimedPose, mode: InstructionMode, repeat: boolean): number {
  return guidedPoseSeconds({
    holdSeconds: pose.holdSeconds,
    sides: pose.sides,
    instructionSeconds: occurrenceInstructionSeconds(pose, mode, { repeat, side: 1 }),
    secondSideInstructionSeconds: occurrenceInstructionSeconds(pose, mode, { repeat, side: 2 }),
  });
}

/**
 * Seconds for poses[from..] — repeats are judged against the whole queue, so
 * the tail of a Sun Salutation is not re-taught just because the count
 * started mid-way.
 */
export function guidedSessionSecondsFrom(
  poses: GuidedTimedPose[],
  from: number,
  mode: InstructionMode = "guided",
): number {
  const repeats = repeatFlags(poses);
  let sum = 0;
  for (let i = Math.max(0, from); i < poses.length; i++) {
    sum += occurrenceSeconds(poses[i]!, mode, repeats[i]!);
  }
  return sum;
}

export function guidedSessionSeconds(
  poses: GuidedTimedPose[],
  mode: InstructionMode = "guided",
): number {
  return guidedSessionSecondsFrom(poses, 0, mode);
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
  const repeat = repeatFlags(opts.poses)[opts.index] ?? false;
  const bilateral = current.sides === "each";
  const onFirstSide = bilateral && (opts.side ?? 1) === 1;
  const instruction = occurrenceInstructionSeconds(current, mode, {
    repeat,
    side: onFirstSide || !bilateral ? 1 : 2,
  });
  const farInstruction = occurrenceInstructionSeconds(current, mode, { repeat, side: 2 });
  const extension = Math.max(0, opts.pendingHoldExtension ?? 0);
  /** Narration + switch + hold still owed for the far side of a bilateral pose. */
  const secondSide = onFirstSide ? SIDE_SWITCH_SECONDS + farInstruction + hold : 0;

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
      currentLeft = Math.max(0, opts.phaseRemaining) + farInstruction + hold + extension;
      break;
    case "hold":
      currentLeft = Math.max(0, opts.phaseRemaining) + secondSide;
      break;
    default:
      currentLeft = 0;
  }
  const later = guidedSessionSecondsFrom(opts.poses, opts.index + 1, mode);
  const pace = opts.pace && opts.pace > 0 ? opts.pace : 1;
  return Math.max(0, Math.round((currentLeft + later) / pace));
}
