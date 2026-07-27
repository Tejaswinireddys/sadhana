/**
 * narrationTiming — map audio playback time to the narration step being spoken.
 *
 * Why this exists
 * ---------------
 * The previous implementation used `floor(currentTime / duration * stepCount)`,
 * which assumes every step takes an equal slice of the narration. Step texts
 * range from 3 words ("Breathe.") to 20+ words, so the step index — and every
 * visual cue driven by it (focus halo, camera, limb animation) — drifted badly.
 *
 * Two sources of truth, in priority order:
 *  1. A generated `{slug}.timing.json` with real per-step boundaries taken from
 *     edge-tts WordBoundary events (see `script/gen-voice-timings.py`).
 *  2. A weighted estimate from the step text itself. Speech duration tracks
 *     syllable count far better than character count, plus a fixed pause cost
 *     per sentence-ending punctuation mark.
 *
 * Both produce the same shape so callers never branch.
 */

export type StepTiming = {
  /** Seconds from the start of the narration where this step begins. */
  start: number;
  /** Seconds where this step ends (== next step's start; last == duration). */
  end: number;
};

/** Shape of a generated `public/voice/timings/{slug}.timing.json`. */
export type NarrationTimingFile = {
  slug: string;
  duration: number;
  /** One entry per narration step, in order. */
  steps: { start: number; end: number }[];
};

/** Extra seconds attributed to the pause after terminal punctuation. */
const PAUSE_COST: Record<string, number> = {
  ".": 0.32,
  "!": 0.32,
  "?": 0.32,
  ";": 0.22,
  ":": 0.22,
  ",": 0.14,
  "—": 0.18,
  "–": 0.18,
};

/**
 * Rough syllable count for English. Deliberately simple: we only need relative
 * weights between steps, not linguistic accuracy.
 */
export function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Relative speaking cost of a step. Units are arbitrary (syllable-equivalents);
 * only ratios between steps matter.
 */
export function stepWeight(text: string): number {
  if (!text) return 1;
  let weight = 0;
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    weight += syllableCount(word);
  }
  // Punctuation pauses, converted to syllable-equivalents (~4.2 syll/sec).
  let pause = 0;
  for (const ch of text) pause += PAUSE_COST[ch] ?? 0;
  weight += pause * 4.2;
  // A step is never weightless — guards against empty/symbol-only text.
  return Math.max(1, weight);
}

/**
 * Build per-step [start, end) windows spanning `duration`, proportional to the
 * estimated speaking cost of each step's text.
 */
export function estimateStepTimings(texts: string[], duration: number): StepTiming[] {
  const n = texts.length;
  if (n === 0) return [];
  if (!isFinite(duration) || duration <= 0) {
    return texts.map(() => ({ start: 0, end: 0 }));
  }
  const weights = texts.map(stepWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  const timings: StepTiming[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i += 1) {
    const start = cursor;
    // Last step always closes exactly on duration — no rounding gap at the end.
    const end = i === n - 1 ? duration : start + (weights[i] / total) * duration;
    timings.push({ start, end });
    cursor = end;
  }
  return timings;
}

/**
 * Rescale generated timings to the actual decoded audio duration. Generated
 * boundaries come from the TTS engine; the encoded mp3 can differ by a few
 * hundred ms, and playbackRate changes nothing here because `currentTime` is
 * already in media-time.
 */
export function scaleTimings(
  steps: { start: number; end: number }[],
  fileDuration: number,
  actualDuration: number,
): StepTiming[] {
  if (!isFinite(actualDuration) || actualDuration <= 0) {
    return steps.map((s) => ({ start: s.start, end: s.end }));
  }
  if (!isFinite(fileDuration) || fileDuration <= 0) return steps.map((s) => ({ ...s }));
  const k = actualDuration / fileDuration;
  return steps.map((s, i, arr) => ({
    start: s.start * k,
    end: i === arr.length - 1 ? actualDuration : s.end * k,
  }));
}

/**
 * Resolve the step index for a playback position. Binary-free linear scan is
 * fine — step counts are ~4–6.
 */
export function stepIndexAt(timings: StepTiming[], time: number): number {
  if (timings.length === 0) return 0;
  for (let i = 0; i < timings.length; i += 1) {
    if (time < timings[i].end) return i;
  }
  return timings.length - 1;
}

/**
 * Progress within the active step, 0–1. This is what drives limb interpolation:
 * the figure should be mid-transition while the sentence is still being spoken,
 * and settled by the time it ends.
 */
export function stepProgressAt(timings: StepTiming[], time: number): number {
  const i = stepIndexAt(timings, time);
  const t = timings[i];
  if (!t) return 0;
  const span = t.end - t.start;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (time - t.start) / span));
}

/** Combined lookup used by the players. */
export function resolveStepAt(
  timings: StepTiming[],
  time: number,
): { index: number; progress: number } {
  const index = stepIndexAt(timings, time);
  const t = timings[index];
  const span = t ? t.end - t.start : 0;
  const progress = span > 0 ? Math.max(0, Math.min(1, (time - t.start) / span)) : 1;
  return { index, progress };
}
