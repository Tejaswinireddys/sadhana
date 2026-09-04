import { CloudMoon, HeartPulse, Moon, Smile, Sunrise, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asanaBySlug, type Mood } from "@/data/content";
import {
  guidedSessionSeconds,
  guidedTimeLabel,
  SIDE_SWITCH_SECONDS,
  TRANSITION_SECONDS,
} from "@/lib/guidedDuration";

export { SIDE_SWITCH_SECONDS, TRANSITION_SECONDS };

/** Mood-based one-tap sessions used on Home and the Practice hub. */
export type QuickSession = {
  id: string;
  icon: LucideIcon;
  label: string;
  intent: string;
  /**
   * Canonical journal / adaptive-plan mood. Home copy stays conversational
   * ("I'm tired"); persisted data uses the same Mood enum as MoodCheckIn.
   */
  mood: Mood;
  poses: Array<{ slug: string; holdSeconds: number }>;
  breathSlug?: string;
  /** First pose slug used as a short illustrated intro clip on the guided start screen. */
  introPoseSlug?: string;
};

/**
 * Session length is DERIVED, never hand-authored.
 *
 * These constants must stay in step with GuidedSession's player timings —
 * previously the deck carried a literal `time: "5 min"` string while the player
 * computed ~9 min from the same pose list, so the header and footer of one
 * screen disagreed. Anything user-facing now comes from `sessionMinutes()`.
 */
type TimedPose = {
  holdSeconds: number;
  sides?: "each" | "single" | "once";
  slug?: string;
  stepCount?: number;
  instructionSeconds?: number;
  steps?: { length: number };
};

function withCatalogTiming(poses: TimedPose[]): Parameters<typeof guidedSessionSeconds>[0] {
  return poses.map((p) => ({
    holdSeconds: p.holdSeconds,
    sides: p.sides,
    slug: p.slug,
    stepCount: p.stepCount ?? p.steps?.length ?? (p.slug ? asanaBySlug(p.slug)?.steps.length ?? 0 : 0),
    instructionSeconds: p.instructionSeconds,
  }));
}

/** Total wall-clock seconds: get-ready, recorded instruction, hold, transitions. */
export function sessionSeconds(poses: TimedPose[]): number {
  return guidedSessionSeconds(withCatalogTiming(poses));
}

/** Rounded minutes for display, e.g. 9 . Never returns 0. */
export function sessionMinutes(poses: TimedPose[]): number {
  return Math.max(1, Math.round(sessionSeconds(poses) / 60));
}

/** Display label for a session's length — same rounding as the guided player. */
export function sessionTimeLabel(poses: TimedPose[]): string {
  return guidedTimeLabel(sessionSeconds(poses));
}

/**
 * Confirm-screen line: pose count plus the same duration the launch card showed.
 * Duration stays out of `label` so the journal title is not a baked-in time.
 */
export function preSessionSummary(opts: {
  label?: string | null;
  poseCount: number;
  minutes?: number;
  timeLabel?: string;
}): string {
  const poseWord = opts.poseCount === 1 ? "pose" : "poses";
  const time = opts.timeLabel ?? (opts.minutes != null ? guidedTimeLabel(opts.minutes * 60) : "");
  const core = `${opts.poseCount} ${poseWord} · ${time} · a continuous voice-narrated flow.`;
  const label = opts.label?.trim();
  return label ? `${label} · ${core}` : core;
}

export const QUICK_SESSIONS: QuickSession[] = [
  {
    id: "tense",
    icon: HeartPulse,
    label: "I'm tense",
    mood: "Stressed",
    intent: "Release",
    introPoseSlug: "simhasana",
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
    mood: "Tired",
    intent: "Restore",
    introPoseSlug: "salamba-balasana",
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
    mood: "Tired",
    intent: "Energize",
    introPoseSlug: "urdhva-hastasana",
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
    mood: "Stressed",
    intent: "Calm",
    introPoseSlug: "vajrasana",
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
    mood: "Grounded",
    intent: "Feel good",
    introPoseSlug: "urdhva-hastasana",
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
    mood: "Calm",
    intent: "Sleep",
    introPoseSlug: "salamba-balasana",
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

/** Session meta for loadSession — includes the mapped mood so GuidedSession skips premood. */
export function quickSessionMeta(q: QuickSession) {
  return {
    label: q.label,
    plannedMinutes: sessionMinutes(q.poses),
    breathSlug: q.breathSlug ?? null,
    introPoseSlug: q.introPoseSlug ?? q.poses[0]?.slug ?? null,
    preMood: q.mood,
  };
}
