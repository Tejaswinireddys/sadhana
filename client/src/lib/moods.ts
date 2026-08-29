// Shared mood chip metadata (v3.4) — used by the Journal editor and the
// pre/post-practice mood check-in modal so they stay perfectly in sync.
import { Smile, Mountain, Zap, Moon, CloudRain } from "lucide-react";
import { MOODS, type Mood } from "@/data/content";
import { QUICK_SESSIONS } from "@/data/quickSessions";

export const MOOD_ICONS: Record<Mood, any> = {
  Calm: Smile,
  Grounded: Mountain,
  Energized: Zap,
  Tired: Moon,
  Stressed: CloudRain,
};

const MOOD_SET = new Set<string>(MOODS);

/** Skip the pre-session mood modal when we already know how they feel. */
export function shouldAskPreMood(known: Mood | null | undefined): boolean {
  return known == null;
}

/**
 * Map a Home mood-session id or label onto the persisted Mood enum.
 *
 * Home copy is conversational ("I'm tired", "I need a reset"); journal,
 * MoodCheckIn, and the adaptive plan all persist Calm / Grounded / Energized /
 * Tired / Stressed. One taxonomy for data, even when the button text differs.
 */
export function moodFromHomeChoice(choice: string | null | undefined): Mood | null {
  if (!choice) return null;
  const t = choice.trim();
  if (!t) return null;
  if (MOOD_SET.has(t)) return t as Mood;

  const lower = t.toLowerCase();
  const match = QUICK_SESSIONS.find(
    (q) => q.id === t || q.id === lower || q.label === t || q.label.toLowerCase() === lower,
  );
  return match?.mood ?? null;
}

/** Prefer an explicit preMood; fall back to mapping a mood-session label. */
export function resolvePreMood(
  preMood?: Mood | null,
  label?: string | null,
): Mood | null {
  return preMood ?? moodFromHomeChoice(label);
}

/**
 * Moods that should ease the next adaptive session.
 *
 * Accepts the canonical enum and Home / Trainer aliases so a tap of "I'm tired"
 * still counts even if it was stored under the conversational label.
 */
export function isLowEnergyMood(mood: string | null | undefined): boolean {
  if (!mood) return false;
  const canonical = moodFromHomeChoice(mood);
  if (canonical === "Tired" || canonical === "Stressed") return true;
  const lower = mood.trim().toLowerCase();
  return lower === "exhausted" || lower === "restless" || lower === "low";
}
