// Resolve a lucide icon by name (string) for data-driven components such as
// profile presets. Falls back to a neutral Sparkles icon when unknown.
import {
  Baby,
  HeartHandshake,
  Moon,
  Brain,
  Lightbulb,
  Flame,
  StretchHorizontal,
  Briefcase,
  Sparkles,
  Smile,
  Star,
  Dumbbell,
  Flower2,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Baby,
  HeartHandshake,
  Moon,
  Brain,
  Lightbulb,
  Flame,
  StretchHorizontal,
  Briefcase,
  Sparkles,
  Smile,
  Star,
  Dumbbell,
  Flower2,
};

export function resolveIcon(name: string): LucideIcon {
  return MAP[name] ?? Sparkles;
}
