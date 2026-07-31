// Resolve a lucide icon by name (string) for data-driven components such as
// profile presets. Falls back to a neutral Sparkles icon when unknown.
import {
  Baby,
  Clock,
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
  Heart,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Baby,
  Clock,
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
  Heart,
};

export function resolveIcon(name: string): LucideIcon {
  return MAP[name] ?? Sparkles;
}
