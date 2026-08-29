/**
 * When a practice session is real enough to count toward a streak.
 *
 * Skipping every pose in four seconds used to log a session. Leaving after
 * fifteen honest minutes used to discard it. The floor is the opposite of that:
 * time actually spent practicing, or completed poses — not skip taps.
 *
 * Guided narration eats most of a pose's authored hold, so the minute bar
 * cannot be "seconds left on the hold clock" alone. Wall-clock time with at
 * least one completed pose is the same bar the exit dialog prints.
 */

export const STREAK_HOLD_FLOOR_SECONDS = 60;
export const STREAK_POSE_FLOOR = 0.5;

export type SessionCredit = {
  counts: boolean;
  minutes: number;
  posesCompleted: number;
  posesSkipped: number;
  posesTotal: number;
};

/** Half the class, rounding toward the practitioner (3 of 7 counts). */
export function posesNeededForCredit(posesTotal: number): number {
  if (posesTotal <= 0) return 1;
  return Math.max(1, Math.floor(posesTotal / 2));
}

export function sessionCredit(args: {
  holdSeconds: number;
  elapsedSeconds: number;
  posesCompleted: number;
  posesSkipped: number;
  posesTotal: number;
}): SessionCredit {
  const minutes = Math.max(0, Math.round(args.elapsedSeconds / 60));
  const needed = posesNeededForCredit(args.posesTotal);
  const heldLongEnough = args.holdSeconds >= STREAK_HOLD_FLOOR_SECONDS;
  const practicedAMinute =
    args.elapsedSeconds >= STREAK_HOLD_FLOOR_SECONDS &&
    (args.posesCompleted >= 1 || args.holdSeconds > 0);
  const finishedHalf = args.posesCompleted >= needed;
  const counts = heldLongEnough || practicedAMinute || finishedHalf;
  return {
    counts,
    // A credited session is at least a minute on the stats line — never round
    // four seconds of skipping up to one, which is what Math.max(1, …) did.
    minutes: counts ? Math.max(1, minutes) : minutes,
    posesCompleted: args.posesCompleted,
    posesSkipped: args.posesSkipped,
    posesTotal: args.posesTotal,
  };
}

export function sessionHeadline(args: {
  counts: boolean;
  minutes: number;
  endedEarly: boolean;
  posesCompleted?: number;
  posesTotal?: number;
}): string {
  if (!args.counts) return "Too brief to save";
  if (args.endedEarly) {
    return creditedLine(args.minutes, args.posesCompleted, args.posesTotal);
  }
  return "Beautiful practice";
}

export function sessionExitCopy(credit: SessionCredit): {
  description: string;
  leaveLabel: string;
} {
  if (credit.counts) {
    return {
      description: creditedLine(credit.minutes, credit.posesCompleted, credit.posesTotal),
      leaveLabel: "Save and leave",
    };
  }
  return {
    description: "This is too brief to count toward your streak.",
    leaveLabel: "Leave",
  };
}

function creditedLine(
  minutes: number,
  posesCompleted: number | undefined,
  posesTotal: number | undefined,
): string {
  const n = Math.max(1, minutes);
  const minuteWord = n === 1 ? "minute" : "minutes";
  if (posesTotal != null && posesTotal > 0 && posesCompleted != null) {
    return `${posesCompleted} of ${posesTotal} poses, ${n} ${minuteWord} — that counts.`;
  }
  return `${n} ${minuteWord} in. That counts.`;
}
