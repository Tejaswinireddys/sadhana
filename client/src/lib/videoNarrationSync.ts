/**
 * Map spoken narration onto a how-to video timeline.
 *
 * Each cue owns an equal slice of the clip. Progress within the cue (0–1)
 * scrubs that slice so the demonstrated action lands with the sentence, not
 * on an independent looping clock.
 */
export type VideoNarrationSyncInput = {
  videoDuration: number;
  stepIndex?: number;
  stepProgress?: number;
  stepCount?: number;
  /** Fallback when step windows are unavailable: whole-clip proportional. */
  narrationTime?: number;
  narrationDuration?: number;
};

/** Leave a tiny tail so `ended` / loop-edge events do not fire while scrubbing. */
const TAIL = 0.04;
/** Ignore seeks smaller than this to avoid fighting the decoder. */
export const SEEK_EPSILON = 0.08;

export function clampVideoTime(time: number, duration: number): number {
  if (!isFinite(duration) || duration <= 0) return 0;
  if (!isFinite(time)) return 0;
  const max = Math.max(0, duration - TAIL);
  return Math.max(0, Math.min(max, time));
}

/**
 * Video timestamp (seconds) that should be showing for the current spoken cue.
 */
export function videoTimeForNarration(input: VideoNarrationSyncInput): number {
  const duration = input.videoDuration;
  if (!isFinite(duration) || duration <= 0) return 0;

  const n = Math.max(1, Math.floor(input.stepCount ?? 0) || 1);
  const hasSteps = (input.stepCount ?? 0) >= 1 || input.stepIndex != null;

  if (hasSteps) {
    const i = Math.max(0, Math.min(n - 1, Math.floor(input.stepIndex ?? 0)));
    const p = Math.max(0, Math.min(1, input.stepProgress ?? 0));
    const start = (i / n) * duration;
    const end = ((i + 1) / n) * duration;
    return clampVideoTime(start + p * (end - start), duration);
  }

  const nd = input.narrationDuration ?? 0;
  const nt = input.narrationTime ?? 0;
  if (isFinite(nd) && nd > 0 && isFinite(nt)) {
    return clampVideoTime((Math.max(0, nt) / nd) * duration, duration);
  }
  return 0;
}

export function shouldSeekVideo(currentTime: number, target: number): boolean {
  if (!isFinite(currentTime) || !isFinite(target)) return false;
  return Math.abs(currentTime - target) > SEEK_EPSILON;
}
