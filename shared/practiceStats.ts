/**
 * Practice totals derived from saved sessions (the same rows the journal lists).
 *
 * "Days practiced" is the count of distinct calendar dates with at least one
 * saved session — never the current streak. A streak can be shorter than the
 * longest stretch; a lifetime day-count cannot.
 */

export type PracticeSessionInput = {
  date: string;
  durationMinutes: number;
  kind?: string;
};

export type PracticeStats = {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  totalMinutes: number;
  asanaSessions: number;
  breathingSessions: number;
  daysPracticed: number;
  heatmap: { date: string; minutes: number }[];
};

export type HomeProgressTiles = {
  daysPracticed: { label: string; value: number; testId: string };
  longestStretch: { label: string; value: number; testId: string };
  totalSessions: { label: string; value: number; testId: string };
  minutesPracticed: { label: string; value: number; testId: string };
};

/** Distinct practice days cannot be fewer than the longest consecutive run. */
export function assertDaysPracticedInvariant(
  daysPracticed: number,
  longestStretch: number,
): void {
  if (daysPracticed < longestStretch) {
    throw new Error(
      `daysPracticed (${daysPracticed}) must be >= longestStretch (${longestStretch})`,
    );
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

export function computeStats(
  sessions: PracticeSessionInput[],
  todayOverride?: string,
): PracticeStats {
  const minutesByDay = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.date);
    minutesByDay.set(k, (minutesByDay.get(k) || 0) + s.durationMinutes);
  }

  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((a, s) => a + s.durationMinutes, 0);
  const asanaSessions = sessions.filter((s) => (s.kind ?? "asana") === "asana").length;
  const breathingSessions = sessions.filter((s) => s.kind === "breathing").length;

  const todayKey =
    todayOverride && /^\d{4}-\d{2}-\d{2}$/.test(todayOverride)
      ? todayOverride
      : new Date().toISOString().slice(0, 10);
  const heatmap: { date: string; minutes: number }[] = [];
  const practicedDays = new Set(minutesByDay.keys());
  for (let i = 83; i >= 0; i--) {
    const k = addDays(todayKey, -i);
    heatmap.push({ date: k, minutes: minutesByDay.get(k) || 0 });
  }

  function isoDaysAgo(n: number): string {
    return addDays(todayKey, -n);
  }
  let currentStreak = 0;
  const startOffset = practicedDays.has(isoDaysAgo(0))
    ? 0
    : practicedDays.has(isoDaysAgo(1))
      ? 1
      : -1;
  if (startOffset >= 0) {
    let n = startOffset;
    while (practicedDays.has(isoDaysAgo(n))) {
      currentStreak++;
      n++;
    }
  }

  const sortedDays = Array.from(practicedDays).sort();
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sortedDays) {
    const d = new Date(k + "T00:00:00Z");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = d;
  }

  const daysPracticed = practicedDays.size;
  assertDaysPracticedInvariant(daysPracticed, longestStreak);

  return {
    currentStreak,
    longestStreak,
    totalSessions,
    totalMinutes,
    asanaSessions,
    breathingSessions,
    daysPracticed,
    heatmap,
  };
}

/**
 * The four Home "Your progress" tiles. Always binds "Days practiced" to
 * distinct dates — never the current streak — so the numbers cannot contradict
 * "Longest stretch".
 */
export function homeProgressTiles(
  stats: Pick<PracticeStats, "daysPracticed" | "longestStreak" | "totalSessions" | "totalMinutes">,
  opts: { compassionateRecovery: boolean },
): HomeProgressTiles {
  assertDaysPracticedInvariant(stats.daysPracticed, stats.longestStreak);
  return {
    daysPracticed: {
      label: opts.compassionateRecovery ? "Days practiced (no shame)" : "Days practiced",
      value: stats.daysPracticed,
      testId: "stat-days-practiced",
    },
    longestStretch: {
      label: "Longest stretch (days)",
      value: stats.longestStreak,
      testId: "stat-longest-streak",
    },
    totalSessions: {
      label: "Total sessions",
      value: stats.totalSessions,
      testId: "stat-total-sessions",
    },
    minutesPracticed: {
      label: "Minutes practiced",
      value: stats.totalMinutes,
      testId: "stat-total-minutes",
    },
  };
}

/**
 * Seeded journal fixture matching the Home repro: entries on Jul 28, Jul 29,
 * and Aug 28 — four saved sessions, five minutes, longest consecutive run of 2.
 */
export const JOURNAL_PROGRESS_FIXTURE: PracticeSessionInput[] = [
  { date: "2026-07-28", durationMinutes: 1, kind: "asana" },
  { date: "2026-07-29", durationMinutes: 1, kind: "asana" },
  { date: "2026-07-29", durationMinutes: 1, kind: "asana" },
  { date: "2026-08-28", durationMinutes: 2, kind: "asana" },
];
