/**
 * Weekly habit plan — compassionate schedule without streak punishment.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

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

export function inQuietHours(plan: HabitPlan, date = new Date()): boolean {
  const h = date.getHours();
  const { quietHoursStart: s, quietHoursEnd: e } = plan;
  if (s === e) return false;
  if (s < e) return h >= s && h < e;
  return h >= s || h < e;
}
