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
  /** "light" | "dark" | "system" — read by the pre-paint script in index.html. */
  theme: "sadhana.theme",
  analytics: "sadhana.analytics",
  /** Class player speed: "0.75" | "1" | "1.25", per device. */
  classSpeed: "sadhana.class.speed",
  /** "personalized" | "non-personalized" — the ad cookie banner's answer. */
  adConsent: "sadhana.ads.consent",
  habitPlan: "sadhana.habitPlan",
  lastRpe: "sadhana.adaptive.lastRpe",
  household: "sadhana.household",
  voiceControl: "sadhana.voiceControl",
  poseCoachConsent: "sadhana.poseCoach.consent",
  webPush: "sadhana.webPush",
  practiceBuddy: "sadhana.practiceBuddy",
  quizPlan: "sadhana.quiz.plan",
  teachersWaitlist: "sadhana.teachersWaitlist.email",
  plusWaitlist: "sadhana.plusWaitlist.email",
} as const;

/** Map quiz/register experience to the pose-detail variation tab. */
export function poseLevelFromExperience(
  level: string | null | undefined,
): "beginner" | "intermediate" | "advanced" {
  if (level === "new") return "beginner";
  if (level === "regular") return "advanced";
  return "intermediate";
}

/**
 * Catalog `difficulty` ("Beginner" | "Intermediate" | "Advanced") → variation
 * path. Unknown values fall back to beginner so a bad row never invents a path.
 */
export function catalogDifficultyToLevel(
  difficulty: string | null | undefined,
): "beginner" | "intermediate" | "advanced" {
  const d = (difficulty || "").trim().toLowerCase();
  if (d === "intermediate") return "intermediate";
  if (d === "advanced") return "advanced";
  return "beginner";
}

/**
 * Default variation path for a pose detail page. An explicit onboarding
 * experience wins; otherwise the catalog difficulty is the single source of
 * truth — never the old "null → intermediate" default that labelled Beginner
 * poses Intermediate in the lesson badge.
 */
export function defaultPoseLevel(
  experience: string | null | undefined,
  catalogDifficulty: string | null | undefined,
): "beginner" | "intermediate" | "advanced" {
  if (experience === "new" || experience === "some" || experience === "regular") {
    return poseLevelFromExperience(experience);
  }
  return catalogDifficultyToLevel(catalogDifficulty);
}

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
