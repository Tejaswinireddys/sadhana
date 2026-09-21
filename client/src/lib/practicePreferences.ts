/**
 * The four things every generator needs to know, kept in one place.
 *
 * Onboarding asked for a goal and an experience level. The quiz asked again.
 * The Trainer asked for a length and a focus and then forgot them. The Adaptive
 * Plan asked for a length of its own. Home guessed. Five screens, four stores,
 * and a practitioner who had answered "ten minutes, better sleep" three times
 * and still got a fifteen-minute standing sequence on the front page.
 *
 * So: goal, ability, time and focus live here, every screen reads them as
 * defaults, and every screen writes back what the practitioner chose. Nothing
 * here is a new concept — `PracticeIntent` and `ExperienceLevel` are the
 * existing onboarding types, and the focus ids are the Trainer's `NEED_OPTIONS`.
 */
import {
  KEYS,
  readString,
  writeString,
  type ExperienceLevel,
  type PracticeIntent,
} from "@/lib/localPrefs";

const MINUTES_KEY = "sadhana.practice.minutes";
const NEED_KEY = "sadhana.practice.need";

export type PracticePreferences = {
  /** Why they are here, from onboarding or the quiz. */
  intent: PracticeIntent | null;
  /** How much yoga they have done. Caps difficulty, not just hold length. */
  experience: ExperienceLevel | null;
  /** The length they last asked any screen for. */
  minutes: number | null;
  /** The focus they last asked any screen for — a NEED_OPTIONS id. */
  need: string | null;
};

const INTENTS: PracticeIntent[] = ["calm", "strength", "flexibility", "sleep", "explore"];
const LEVELS: ExperienceLevel[] = ["new", "some", "regular"];

export function readPracticePreferences(): PracticePreferences {
  const intent = readString(KEYS.practiceIntent);
  const experience = readString(KEYS.experienceLevel);
  const minutes = Number(readString(MINUTES_KEY) ?? "");
  const need = readString(NEED_KEY);
  return {
    intent: INTENTS.includes(intent as PracticeIntent) ? (intent as PracticeIntent) : null,
    experience: LEVELS.includes(experience as ExperienceLevel)
      ? (experience as ExperienceLevel)
      : null,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    need: need && need.trim() ? need : null,
  };
}

/** Record a choice a practitioner just made, so the next screen starts there. */
export function writePracticePreferences(next: Partial<PracticePreferences>): void {
  if (next.intent) writeString(KEYS.practiceIntent, next.intent);
  if (next.experience) writeString(KEYS.experienceLevel, next.experience);
  if (next.minutes != null && next.minutes > 0) writeString(MINUTES_KEY, String(next.minutes));
  if (next.need) writeString(NEED_KEY, next.need);
}

/** The Trainer's focus id that corresponds to an onboarding goal. */
export const INTENT_TO_NEED: Record<PracticeIntent, string> = {
  calm: "calm",
  strength: "strength",
  flexibility: "flexibility",
  sleep: "sleep",
  explore: "movement",
};

/**
 * The focus to compose for, in preference order: what they last chose, then
 * the goal they gave onboarding, then the time of day, then "just move".
 */
export function preferredNeed(prefs: PracticePreferences, hour = new Date().getHours()): string {
  if (prefs.need) return prefs.need;
  if (prefs.intent) return INTENT_TO_NEED[prefs.intent];
  return hour >= 20 || hour < 4 ? "sleep" : "movement";
}
