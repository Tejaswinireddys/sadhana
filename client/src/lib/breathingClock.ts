/**
 * Breathing visualizer clock helpers. Pause must freeze the in-progress round
 * and phase countdown (not snap back to idle Round 0). Resume must not skip
 * the paused wall-clock time.
 */

export function breathDisplayRound(opts: {
  started: boolean;
  done: boolean;
  completedRounds: number;
  totalRounds: number;
}): number {
  const { started, done, completedRounds, totalRounds } = opts;
  if (done) return totalRounds;
  if (!started) return 0;
  return Math.min(completedRounds + 1, totalRounds);
}

/** First frame after pause/start contributes 0s so a long pause does not jump. */
export function breathTickDelta(lastTs: number | null, now: number): { dt: number; nextLast: number } {
  if (lastTs == null) return { dt: 0, nextLast: now };
  return { dt: Math.max(0, (now - lastTs) / 1000), nextLast: now };
}
