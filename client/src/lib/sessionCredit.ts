/**
 * When a practice session is real enough to count toward a streak.
 *
 * Skipping every pose in four seconds used to log a session. Leaving after
 * fifteen honest minutes used to discard it. The floor is the opposite of that:
 * hold time or completed poses, not button presses.
 */

export const STREAK_HOLD_FLOOR_SECONDS = 60;
export const STREAK_POSE_FLOOR = 0.5;

export type SessionCredit = {
  counts: boolean;
  minutes: number;
  posesCompleted: number;
  posesSkipped: number;
};

export function sessionCredit(args: {
  holdSeconds: number;
  elapsedSeconds: number;
  posesCompleted: number;
  posesSkipped: number;
  posesTotal: number;
}): SessionCredit {
  const minutes = Math.max(0, Math.round(args.elapsedSeconds / 60));
  const poseShare = args.posesTotal > 0 ? args.posesCompleted / args.posesTotal : 0;
  const counts =
    args.holdSeconds >= STREAK_HOLD_FLOOR_SECONDS || poseShare >= STREAK_POSE_FLOOR;
  return {
    counts,
    // A credited session is at least a minute on the stats line — never round
    // four seconds of skipping up to one, which is what Math.max(1, …) did.
    minutes: counts ? Math.max(1, minutes) : minutes,
    posesCompleted: args.posesCompleted,
    posesSkipped: args.posesSkipped,
  };
}

export function sessionHeadline(args: {
  counts: boolean;
  minutes: number;
  endedEarly: boolean;
}): string {
  if (!args.counts) return "Too brief to save";
  if (args.endedEarly) {
    const n = Math.max(1, args.minutes);
    return `${n} ${n === 1 ? "minute" : "minutes"} in. That counts.`;
  }
  return "Beautiful practice";
}

export function sessionExitCopy(credit: SessionCredit): {
  description: string;
  leaveLabel: string;
} {
  if (credit.counts) {
    const n = Math.max(1, credit.minutes);
    return {
      description: `${n} ${n === 1 ? "minute" : "minutes"} in. That counts — we'll save it.`,
      leaveLabel: "Save and leave",
    };
  }
  return {
    description: "This is too brief to count toward your streak.",
    leaveLabel: "Leave",
  };
}
