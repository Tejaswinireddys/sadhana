/**
 * Ordered narration cue lists with absolute start times.
 *
 * Shape (product contract):
 *   [{ t: 0, text: "Come to standing…" }, { t: 4, text: "Inhale…" }, …]
 *
 * Timings come from a generated timing file when available, otherwise from
 * syllable-weighted estimates (see narrationTiming.ts).
 */
import {
  estimateStepTimings,
  type StepTiming,
} from "@/lib/narrationTiming";

export type NarrationCue = {
  /** Seconds from the start of the pose narration. */
  t: number;
  text: string;
};

/** Default silent / speech walkthrough window when no MP3 duration is known. */
export const DEFAULT_CUE_WINDOW_SECONDS = 12;

/**
 * Build an ordered cue list from step texts spanning `duration` seconds.
 */
export function buildCueList(
  texts: string[],
  duration = DEFAULT_CUE_WINDOW_SECONDS,
): NarrationCue[] {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const timings = estimateStepTimings(clean, duration);
  return timings.map((step, i) => ({
    t: roundTime(step.start),
    text: clean[i]!,
  }));
}

/** Convert cue starts into [start,end) step timings for resolveStepAt. */
export function cuesToStepTimings(
  cues: NarrationCue[],
  duration: number,
): StepTiming[] {
  if (cues.length === 0) return [];
  const end = Math.max(duration, cues[cues.length - 1]!.t + 0.5);
  return cues.map((c, i) => ({
    start: c.t,
    end: i + 1 < cues.length ? cues[i + 1]!.t : end,
  }));
}

/** Prefer server/manifest cues; fall back to estimated list from step texts. */
export function resolveCueList(opts: {
  stepTexts: string[];
  manifestCues?: NarrationCue[] | null;
  duration?: number;
}): NarrationCue[] {
  const duration = opts.duration ?? DEFAULT_CUE_WINDOW_SECONDS;
  const fromManifest = opts.manifestCues?.filter((c) => c.text?.trim());
  if (fromManifest && fromManifest.length > 0) {
    // If the server only sent timings without text, fill from steps.
    return fromManifest.map((c, i) => ({
      t: roundTime(c.t),
      text: (c.text || opts.stepTexts[i] || "").trim(),
    })).filter((c) => c.text);
  }
  return buildCueList(opts.stepTexts, duration);
}

/** Active cue index for a playback clock (media-time or silent elapsed). */
export function cueIndexAt(cues: NarrationCue[], time: number): number {
  if (cues.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < cues.length; i += 1) {
    if (time + 1e-6 >= cues[i]!.t) idx = i;
    else break;
  }
  return idx;
}

function roundTime(t: number): number {
  return Math.round(t * 1000) / 1000;
}
