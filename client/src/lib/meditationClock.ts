/** Pure timing for a sit: which line is on screen, and when a bell rings. */

export type MeditationCue = { t: number; text: string };

export function cueAt(cues: readonly MeditationCue[], elapsedSeconds: number): MeditationCue | null {
  let current: MeditationCue | null = null;
  for (const cue of cues) {
    if (cue.t <= elapsedSeconds) current = cue;
    else break;
  }
  return current;
}

/**
 * A bell at the start, at the end, and on each interval in between.
 * `everySeconds` of 0 rings only at the start and the end.
 */
export function shouldRingBell(args: {
  elapsed: number;
  previousElapsed: number;
  duration: number;
  everySeconds: number;
}): boolean {
  const { elapsed, previousElapsed, duration, everySeconds } = args;
  if (duration <= 0 || elapsed <= previousElapsed) return false;
  if (previousElapsed <= 0 && elapsed > 0) return true;
  if (previousElapsed < duration && elapsed >= duration) return true;
  if (everySeconds <= 0 || elapsed >= duration) return false;
  return Math.floor(elapsed / everySeconds) > Math.floor(previousElapsed / everySeconds);
}
