import { HeartPulse, Moon, Sunrise, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Mood-based one-tap sessions used on Home and the Practice hub. */
export type QuickSession = {
  id: string;
  icon: LucideIcon;
  label: string;
  time: string;
  intent: string;
  poses: Array<{ slug: string; holdSeconds: number }>;
  breathSlug?: string;
};

export const QUICK_SESSIONS: QuickSession[] = [
  {
    id: "tense",
    icon: HeartPulse,
    label: "I'm tense",
    time: "5 min",
    intent: "Release",
    poses: [
      { slug: "apanasana", holdSeconds: 60 },
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
    time: "5 min",
    intent: "Restore",
    poses: [
      { slug: "salamba-bhujangasana", holdSeconds: 45 },
      { slug: "setu-bandhasana", holdSeconds: 45 },
      { slug: "makarasana", holdSeconds: 90 },
      { slug: "savasana", holdSeconds: 75 },
    ],
  },
  {
    id: "low-energy",
    icon: Sunrise,
    label: "I'm low energy",
    time: "10 min",
    intent: "Energize",
    poses: [
      { slug: "chakravakasana", holdSeconds: 30 },
      { slug: "tadasana", holdSeconds: 30 },
      { slug: "virabhadrasana-ii", holdSeconds: 45 },
      { slug: "virabhadrasana-i", holdSeconds: 45 },
      { slug: "ardha-uttanasana", holdSeconds: 20 },
      { slug: "utkatasana", holdSeconds: 45 },
      { slug: "anjaneyasana", holdSeconds: 60 },
      { slug: "balasana", holdSeconds: 60 },
      { slug: "adho-mukha-svanasana", holdSeconds: 60 },
      { slug: "savasana", holdSeconds: 75 },
    ],
  },
  {
    id: "anxious",
    icon: Wind,
    label: "I'm anxious",
    time: "10 min",
    intent: "Calm",
    poses: [
      { slug: "vajrasana", holdSeconds: 60 },
      { slug: "shashankasana", holdSeconds: 60 },
      { slug: "balasana", holdSeconds: 90 },
      { slug: "sukhasana", holdSeconds: 120 },
      { slug: "viparita-karani", holdSeconds: 240 },
      { slug: "savasana", holdSeconds: 150 },
    ],
    breathSlug: "nadi-shodhana",
  },
];
