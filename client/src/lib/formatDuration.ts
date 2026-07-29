/**
 * One duration format for the whole app.
 *
 * The same list could show "2 min" next to "3m 10s" because Builder and Trainer
 * each had their own formatter with different conventions. A single function
 * means a duration reads the same everywhere it appears.
 *
 * Convention: `2 min`, `3 min 10 sec`, `45 sec`. Words, not initials — this is
 * body copy in a calm app, not a stopwatch readout. `mm:ss` stays reserved for
 * the live countdown, where a ticking clock is exactly the right metaphor.
 */

export function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

/** A hold, with the "each side" qualifier when a pose is practised bilaterally. */
export function formatHold(seconds: number, sides?: "once" | "each"): string {
  const base = formatDuration(seconds);
  return sides === "each" ? `${base} each side` : base;
}

/** Live countdown only. */
export function formatClock(totalSeconds: number): string {
  const v = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}
