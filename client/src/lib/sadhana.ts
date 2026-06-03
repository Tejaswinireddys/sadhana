export type Stats = {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  totalMinutes: number;
  daysPracticed: number;
  heatmap: { date: string; minutes: number }[];
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Days elapsed since a start date (inclusive of today)
export function daysSince(startISO: string): number {
  const start = new Date(startISO.slice(0, 10) + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
}
