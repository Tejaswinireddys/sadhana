/**
 * Screen-reader copy for the guided player.
 *
 * Sighted captions include a breath label that ticks every second. That must
 * never go through aria-live — VoiceOver / TalkBack would narrate "Inhale…"
 * on every clock tick. Pose name + cue, a one-shot 10-second warning, and
 * session lifecycle (start / pause / resume / complete) are the only live
 * updates.
 */

export const GUIDED_SR = {
  sessionStarted: "Session started",
  paused: "Paused",
  resumed: "Resumed",
  sessionComplete: "Session complete",
  holdEnding: "10 seconds remaining",
} as const;

export type GuidedAnnouncePhase =
  | "transitionIn"
  | "instruction"
  | "sideSwitch"
  | "hold"
  | "complete";

/** Cue line for the current player phase — never includes the breath label. */
export function cueTextForGuidedPhase(opts: {
  phase: GuidedAnnouncePhase;
  poseName: string;
  instructionCue?: string;
  holdCue?: string;
}): string {
  const name = opts.poseName.trim();
  switch (opts.phase) {
    case "transitionIn":
      return name ? `Get ready for ${name}` : "Get ready for the next pose";
    case "sideSwitch":
      return "Switch sides";
    case "hold":
      return (opts.holdCue ?? "").trim();
    case "instruction":
      return (opts.instructionCue ?? "").trim();
    case "complete":
      return "";
  }
}

/** "Mountain Pose. Bend your knees." — pose name + cue, without duplication. */
export function poseAndCueAnnouncement(poseName: string, cue: string): string {
  const name = poseName.trim();
  const text = cue.trim();
  if (!name && !text) return "";
  if (!text) return name;
  if (!name) return text;
  if (text.toLowerCase().includes(name.toLowerCase())) return text;
  return `${name}. ${text}`;
}

export function withSessionStarted(poseAnnouncement: string, alreadyStarted: boolean): string {
  const pose = poseAnnouncement.trim();
  if (alreadyStarted) return pose;
  return pose ? `${GUIDED_SR.sessionStarted}. ${pose}` : GUIDED_SR.sessionStarted;
}

/**
 * Last 10 seconds of a hold — once per hold, not per remaining second.
 * Short holds (starting at ≤10s) still announce once. Remaining 0 does not.
 */
export function shouldAnnounceHoldEndingOnce(opts: {
  phase: string;
  remainingSeconds: number;
  alreadyAnnounced: boolean;
}): boolean {
  if (opts.phase !== "hold") return false;
  if (opts.alreadyAnnounced) return false;
  return opts.remainingSeconds <= 10 && opts.remainingSeconds > 0;
}
