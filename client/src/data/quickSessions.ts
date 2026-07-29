import { CloudMoon, HeartPulse, Moon, Smile, Sunrise, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Mood-based one-tap sessions used on Home and the Practice hub. */
export type QuickSession = {
  id: string;
  icon: LucideIcon;
  label: string;
  intent: string;
  poses: Array<{ slug: string; holdSeconds: number }>;
  breathSlug?: string;
};

/**
 * Session length is DERIVED, never hand-authored.
 *
 * These constants must stay in step with GuidedSession's player timings —
 * previously the deck carried a literal `time: "5 min"` string while the player
 * computed ~9 min from the same pose list, so the header and footer of one
 * screen disagreed. Anything user-facing now comes from `sessionMinutes()`.
 */
export const TRANSITION_SECONDS = 5;
export const SIDE_SWITCH_SECONDS = 2;

/** Total wall-clock seconds for a pose list, including transitions. */
export function sessionSeconds(
  poses: Array<{ holdSeconds: number; sides?: "each" | "single" }>,
): number {
  return poses.reduce((sum, p) => {
    const base = p.holdSeconds + TRANSITION_SECONDS;
    return sum + (p.sides === "each" ? base + p.holdSeconds + SIDE_SWITCH_SECONDS : base);
  }, 0);
}

/** Rounded minutes for display, e.g. 9 . Never returns 0. */
export function sessionMinutes(
  poses: Array<{ holdSeconds: number; sides?: "each" | "single" }>,
): number {
  return Math.max(1, Math.round(sessionSeconds(poses) / 60));
}

/** Display label for a session's length, e.g. "9 min". */
export function sessionTimeLabel(
  poses: Array<{ holdSeconds: number; sides?: "each" | "single" }>,
): string {
  return `${sessionMinutes(poses)} min`;
}

export const QUICK_SESSIONS: QuickSession[] = [
  {
    id: "tense",
    icon: HeartPulse,
    label: "I'm tense",
    intent: "Release",
    poses: [
      { slug: "simhasana", holdSeconds: 30 },
      { slug: "apanasana", holdSeconds: 60 },
      { slug: "jathara-parivartanasana", holdSeconds: 60 },
      { slug: "balasana", holdSeconds: 60 },
      { slug: "paschimottanasana", holdSeconds: 60 },
      { slug: "viparita-karani", holdSeconds: 180 },
      { slug: "savasana", holdSeconds: 60 },
    ],
  },
  {
    id: "tired",
    icon: Moon,
    label: "I'm tired",
    intent: "Restore",
    poses: [
      { slug: "salamba-balasana", holdSeconds: 90 },
      { slug: "salamba-bhujangasana", holdSeconds: 45 },
      { slug: "chair-viparita-karani", holdSeconds: 120 },
      { slug: "constructive-rest", holdSeconds: 120 },
    ],
  },
  {
    id: "low-energy",
    icon: Sunrise,
    label: "I'm low energy",
    intent: "Energize",
    poses: [
      { slug: "urdhva-hastasana", holdSeconds: 20 },
      { slug: "chakravakasana", holdSeconds: 30 },
      { slug: "tadasana", holdSeconds: 30 },
      { slug: "parivrtta-utkatasana", holdSeconds: 25 },
      { slug: "baddha-virabhadrasana", holdSeconds: 30 },
      { slug: "virabhadrasana-ii", holdSeconds: 45 },
      { slug: "virabhadrasana-i", holdSeconds: 45 },
      { slug: "ardha-uttanasana", holdSeconds: 20 },
      { slug: "anjaneyasana", holdSeconds: 60 },
      { slug: "balasana", holdSeconds: 60 },
      { slug: "savasana", holdSeconds: 75 },
    ],
  },
  {
    id: "anxious",
    icon: Wind,
    label: "I'm anxious",
    intent: "Calm",
    poses: [
      { slug: "vajrasana", holdSeconds: 60 },
      { slug: "salamba-balasana", holdSeconds: 90 },
      { slug: "shashankasana", holdSeconds: 60 },
      { slug: "jathara-parivartanasana", holdSeconds: 75 },
      { slug: "constructive-rest", holdSeconds: 120 },
      { slug: "chair-viparita-karani", holdSeconds: 180 },
      { slug: "parsva-savasana", holdSeconds: 120 },
    ],
    breathSlug: "nadi-shodhana",
  },
  {
    id: "feel-good",
    icon: Smile,
    label: "I need a reset",
    intent: "Feel good",
    poses: [
      { slug: "urdhva-hastasana", holdSeconds: 20 },
      { slug: "simhasana", holdSeconds: 30 },
      { slug: "parivrtta-utkatasana", holdSeconds: 25 },
      { slug: "baddha-parsvakonasana", holdSeconds: 30 },
      { slug: "anantasana", holdSeconds: 30 },
      { slug: "supta-virasana", holdSeconds: 60 },
      { slug: "shashankasana", holdSeconds: 60 },
      { slug: "supta-baddha-konasana", holdSeconds: 90 },
      { slug: "savasana", holdSeconds: 90 },
    ],
    breathSlug: "bhramari",
  },
  {
    id: "before-bed",
    icon: CloudMoon,
    label: "Before bed",
    intent: "Sleep",
    poses: [
      { slug: "salamba-balasana", holdSeconds: 90 },
      { slug: "pawanmuktasana", holdSeconds: 60 },
      { slug: "supta-garudasana", holdSeconds: 45 },
      { slug: "supta-gomukhasana", holdSeconds: 60 },
      { slug: "jathara-parivartanasana", holdSeconds: 75 },
      { slug: "salamba-matsyasana", holdSeconds: 90 },
      { slug: "chair-viparita-karani", holdSeconds: 150 },
      { slug: "constructive-rest", holdSeconds: 150 },
      { slug: "parsva-savasana", holdSeconds: 120 },
    ],
    breathSlug: "four-seven-eight",
  },
];
