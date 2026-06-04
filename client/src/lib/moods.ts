// Shared mood chip metadata (v3.4) — used by the Journal editor and the
// pre/post-practice mood check-in modal so they stay perfectly in sync.
import { Smile, Mountain, Zap, Moon, CloudRain } from "lucide-react";
import { type Mood } from "@/data/content";

export const MOOD_ICONS: Record<Mood, any> = {
  Calm: Smile,
  Grounded: Mountain,
  Energized: Zap,
  Tired: Moon,
  Stressed: CloudRain,
};
