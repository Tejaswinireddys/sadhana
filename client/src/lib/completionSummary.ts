/**
 * The three numbers on the completion screen.
 *
 * Pulled out of the player because two of them were wrong in ways only a
 * reader would notice: a one-pose practice read "1 POSES", and a session with
 * no hold time read "0 BREATHS" — a measurement of nothing, presented as a
 * result. Breaths are an estimate from hold time, never a count of breaths
 * taken, so the tile says so and disappears when there is nothing to estimate.
 */
export type CompletionTile = {
  id: "minutes" | "poses" | "breaths";
  value: string;
  label: string;
  testId: string;
};

export function completionTiles(opts: {
  minutes: number;
  posesCompleted: number;
  posesTotal: number;
  posesSkipped: number;
  /** Estimated from hold time. 0 means "nothing to estimate from". */
  breaths: number;
}): CompletionTile[] {
  const tiles: CompletionTile[] = [
    {
      id: "minutes",
      value: String(opts.minutes),
      label: opts.minutes === 1 ? "minute" : "minutes",
      testId: "text-complete-minutes",
    },
    {
      id: "poses",
      value:
        opts.posesSkipped > 0
          ? `${opts.posesCompleted}/${opts.posesTotal}`
          : String(opts.posesCompleted),
      label:
        opts.posesSkipped > 0
          ? `${poseWord(opts.posesCompleted)} · ${opts.posesSkipped} skipped`
          : poseWord(opts.posesCompleted),
      testId: "text-complete-poses",
    },
  ];
  if (opts.breaths > 0) {
    tiles.push({
      id: "breaths",
      value: String(opts.breaths),
      label: `${opts.breaths === 1 ? "breath" : "breaths"} (est.)`,
      testId: "text-complete-breaths",
    });
  }
  return tiles;
}

function poseWord(n: number): string {
  return n === 1 ? "pose" : "poses";
}
