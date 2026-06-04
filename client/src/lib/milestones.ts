// Milestone definitions + messages (v3.4). A milestone is celebrated exactly
// once — celebrated kinds are persisted in the `milestones` backend table.

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;
export const TOTAL_MILESTONES = [10, 25, 50, 100] as const;

export type MilestoneHit = {
  kind: string; // e.g. "streak_7", "total_50"
  title: string;
  message: string;
};

const STREAK_MESSAGES: Record<number, string> = {
  3: "Three days in a row. The habit is taking root.",
  7: "Seven days. A real practice is forming.",
  14: "Two full weeks. Your body is remembering.",
  30: "Thirty days. This is who you are now.",
  50: "Fifty days. Steady and devoted.",
  100: "One hundred days. You are dedicated.",
  365: "A full year of practice. Extraordinary devotion.",
};

const TOTAL_MESSAGES: Record<number, string> = {
  10: "Ten sessions complete. You've truly begun.",
  25: "Twenty-five sessions. The path is yours.",
  50: "Fifty sessions. A practice you can lean on.",
  100: "One hundred sessions. A lifetime habit.",
};

// Given the new stats after a session and the set of already-celebrated kinds,
// return any newly-reached milestones (usually 0 or 1).
export function detectMilestones(
  currentStreak: number,
  totalSessions: number,
  celebrated: Set<string>,
): MilestoneHit[] {
  const hits: MilestoneHit[] = [];

  for (const n of STREAK_MILESTONES) {
    const kind = `streak_${n}`;
    if (currentStreak >= n && !celebrated.has(kind)) {
      hits.push({
        kind,
        title: `${n}-day streak`,
        message: STREAK_MESSAGES[n],
      });
    }
  }
  for (const n of TOTAL_MILESTONES) {
    const kind = `total_${n}`;
    if (totalSessions >= n && !celebrated.has(kind)) {
      hits.push({
        kind,
        title: `${n} sessions`,
        message: TOTAL_MESSAGES[n],
      });
    }
  }
  // Celebrate the highest single milestone if multiple cross at once.
  return hits;
}
