/** Tiny typed localStorage helpers for client-only preferences. */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  onboardingDone: "sadhana.onboarding.done",
  welcomeSeen: "sadhana.welcome.seen",
  practitionerName: "sadhana.practitioner.name",
  practiceIntent: "sadhana.practice.intent",
  experienceLevel: "sadhana.experience.level",
  kidsGateDay: "sadhana.kidsGate.unlockedDay",
  recentSearches: "sadhana.recentSearches",
  reminder: "sadhana.reminder",
  reminderDismissedDay: "sadhana.reminder.dismissedDay",
} as const;

export type ReminderPrefs = {
  enabled: boolean;
  /** Local hour 0–23 when the in-app nudge should appear. */
  hour: number;
  notifications: boolean;
};

/** Why the practitioner is starting — set during registration. */
export type PracticeIntent =
  | "calm"
  | "strength"
  | "flexibility"
  | "sleep"
  | "explore";

/** Self-reported experience — set during registration. */
export type ExperienceLevel = "new" | "some" | "regular";
