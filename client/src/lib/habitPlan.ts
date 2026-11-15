/**
 * Weekly habit plan — compassionate schedule without streak punishment.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";
import { countOf } from "./plural";

export type HabitPlan = {
  /** Days of week 0=Sun … 6=Sat */
  days: number[];
  /** Local hour for preferred practice window */
  hour: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  /** Missed-day recovery: suggest a 5-min reset instead of breaking the chain */
  compassionateRecovery: boolean;
};

export const DEFAULT_HABIT_PLAN: HabitPlan = {
  days: [1, 3, 5],
  hour: 19,
  quietHoursStart: 21,
  quietHoursEnd: 7,
  compassionateRecovery: true,
};

export function readHabitPlan(): HabitPlan {
  return { ...DEFAULT_HABIT_PLAN, ...readJson<Partial<HabitPlan>>(KEYS.habitPlan, {}) };
}

export function writeHabitPlan(plan: HabitPlan) {
  writeJson(KEYS.habitPlan, plan);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function habitDayLabel(d: number): string {
  return DAY_LABELS[d] ?? String(d);
}

export function isHabitDay(plan: HabitPlan, date = new Date()): boolean {
  return plan.days.includes(date.getDay());
}

function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + days * 86400000).toISOString().slice(0, 10);
}

/**
 * Consecutive practiced days, walking through planned rest days without
 * resetting. A planned day with no practice ends the run. Today is not a
 * miss until it is over, so an unpracticed today starts the count yesterday.
 */
export function restFriendlyStreak(
  practicedDates: ReadonlySet<string>,
  plannedDays: readonly number[],
  today: string,
): number {
  let cursor = practicedDates.has(today) ? today : shiftIso(today, -1);
  let count = 0;
  for (let i = 0; i < 366; i++) {
    if (practicedDates.has(cursor)) count += 1;
    else if (!plannedDays.includes(isoWeekday(cursor))) {
      /* rest day — the run continues */
    } else break;
    cursor = shiftIso(cursor, -1);
  }
  return count;
}

export function weeklySummary(args: {
  days: number;
  sessions: number;
  minutes: number;
  restDayToday: boolean;
}): string {
  const rest = args.restDayToday
    ? " Today is a rest day on your plan. Nothing is due."
    : " Rest days on your plan are not missed days.";
  return `This week: ${countOf(args.days, "day")}, ${countOf(args.sessions, "session")}, ${countOf(args.minutes, "minute")}.${rest}`;
}

/** A sentence for an open app, or null when no reminder is due. */
export function inAppReminder(args: {
  plan: HabitPlan;
  now: Date;
  practicedToday: boolean;
  remindersEnabled: boolean;
}): string | null {
  if (!args.remindersEnabled || args.practicedToday) return null;
  if (!isHabitDay(args.plan, args.now)) return null;
  if (inQuietHours(args.plan, args.now)) return null;
  if (args.now.getHours() < args.plan.hour) return null;
  return "It's a practice day. A short one counts. Missing a rest day would not reset anything.";
}

export function inQuietHours(plan: HabitPlan, date = new Date()): boolean {
  const h = date.getHours();
  const { quietHoursStart: s, quietHoursEnd: e } = plan;
  if (s === e) return false;
  if (s < e) return h >= s && h < e;
  return h >= s || h < e;
}
