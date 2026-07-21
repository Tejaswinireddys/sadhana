import { CloudMoon, HeartPulse, Moon, Smile, Sunrise, Wind } from "lucide-react";
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
      { slug: "simhasana", holdSeconds: 30 },
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
    time: "10 min",
    intent: "Energize",
    poses: [
      { slug: "urdhva-hastasana", holdSeconds: 20 },
      { slug: "chakravakasana", holdSeconds: 30 },
      { slug: "tadasana", holdSeconds: 30 },
      { slug: "parivrtta-utkatasana", holdSeconds: 25 },
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
    time: "10 min",
    intent: "Calm",
    poses: [
      { slug: "vajrasana", holdSeconds: 60 },
      { slug: "salamba-balasana", holdSeconds: 90 },
      { slug: "shashankasana", holdSeconds: 60 },
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
    time: "12 min",
    intent: "Feel good",
    poses: [
      { slug: "urdhva-hastasana", holdSeconds: 20 },
      { slug: "simhasana", holdSeconds: 30 },
      { slug: "parivrtta-utkatasana", holdSeconds: 25 },
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
    time: "12 min",
    intent: "Sleep",
    poses: [
      { slug: "salamba-balasana", holdSeconds: 90 },
      { slug: "pawanmuktasana", holdSeconds: 60 },
      { slug: "supta-garudasana", holdSeconds: 45 },
      { slug: "supta-gomukhasana", holdSeconds: 60 },
      { slug: "salamba-matsyasana", holdSeconds: 90 },
      { slug: "chair-viparita-karani", holdSeconds: 150 },
      { slug: "constructive-rest", holdSeconds: 150 },
      { slug: "parsva-savasana", holdSeconds: 120 },
    ],
    breathSlug: "four-seven-eight",
  },
];
