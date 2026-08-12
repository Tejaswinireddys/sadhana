/**
 * Shared inhale / exhale clock for hold-phase captions + figure breath.
 * One continuous cycle so voice cues, on-screen breath text, and motion
 * advance together without a separate user action.
 */

export type BreathPhaseName = "inhale" | "exhale";

export type BreathCycleState = {
  /** 0–1 through the full inhale+exhale cycle. */
  phase: number;
  /** 0–1 within the current half (inhale or exhale). */
  halfProgress: number;
  name: BreathPhaseName;
  label: string;
};

/** Default calm breath: 4s in / 4s out. */
export const BREATH_IN_SECONDS = 4;
export const BREATH_OUT_SECONDS = 4;
export const BREATH_CYCLE_SECONDS = BREATH_IN_SECONDS + BREATH_OUT_SECONDS;

/**
 * Map hold elapsed seconds → breath cycle state.
 * `pace` slows/fastens the cycle the same way as the session countdown.
 */
export function breathAt(
  elapsedSeconds: number,
  pace = 1,
  inSec = BREATH_IN_SECONDS,
  outSec = BREATH_OUT_SECONDS,
): BreathCycleState {
  const cycle = Math.max(0.5, inSec + outSec);
  const scaled = Math.max(0, elapsedSeconds) * Math.max(0.25, pace);
  const t = scaled % cycle;
  const phase = t / cycle;
  if (t < inSec) {
    return {
      phase,
      halfProgress: inSec > 0 ? t / inSec : 1,
      name: "inhale",
      label: "Inhale…",
    };
  }
  const outT = t - inSec;
  return {
    phase,
    halfProgress: outSec > 0 ? outT / outSec : 1,
    name: "exhale",
    label: "Exhale…",
  };
}
