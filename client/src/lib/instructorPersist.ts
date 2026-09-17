/**
 * Persist Virtual Instructor sessions across reload (sessionStorage).
 */
const KEY = "sadhana.instructor.v1";

export type PersistedInstructorSession = {
  version: 1;
  uiPhase: "setup" | "safety" | "practice" | "complete";
  mode: "learn" | "flow";
  level: "beginner" | "intermediate" | "advanced";
  selected: string[];
  answers: Array<{ ruleId: string; applies: boolean | null }>;
  plan: unknown;
  prepExtraByPoseIndex: Record<number, number>;
  clock: { timeSec: number; playing: boolean; rate: number };
  practicedSec: number;
  startedAt: number | null;
};

export function loadInstructorSession(): PersistedInstructorSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedInstructorSession;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveInstructorSession(data: PersistedInstructorSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearInstructorSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
