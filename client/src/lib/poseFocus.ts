/**
 * Derive a "look here" focus region for a narration step from its text, so the
 * illustrated figure visibly responds to the cue even when the pose holds one
 * shape (e.g. Mountain: the view travels feet → thighs → shoulders → crown as
 * the voice names each part). Falls back to any explicit `focusZone` on the step.
 *
 * Coordinates are normalised for a portrait figure: cy 0 = crown, 1 = feet.
 */
import type { FocusZone } from "@/lib/poseMoments";

type Region = { test: RegExp; cx: number; cy: number; r: number; label: string };

// Ordered head→toe; selection is by earliest keyword in the sentence, so the
// list order only breaks ties. Keep specific parts before general ones.
const REGIONS: Region[] = [
  { test: /\b(toes?|feet|foot|heels?|ankles?|arches?)\b/i, cx: 0.5, cy: 0.92, r: 0.16, label: "Feet & toes" },
  { test: /\b(knees?|kneecaps?|shins?|calf|calves)\b/i, cx: 0.5, cy: 0.72, r: 0.18, label: "Knees & shins" },
  { test: /\b(thighs?|quads?|hamstrings?|legs?)\b/i, cx: 0.5, cy: 0.62, r: 0.2, label: "Legs & thighs" },
  { test: /\b(hips?|pelvis|tailbone|glutes?|seat|groin)\b/i, cx: 0.5, cy: 0.55, r: 0.2, label: "Hips & pelvis" },
  { test: /\b(belly|navel|core|abdomen|abs)\b/i, cx: 0.5, cy: 0.5, r: 0.18, label: "Core" },
  { test: /\b(hands?|palms?|wrists?|fingers?|fingertips?)\b/i, cx: 0.5, cy: 0.5, r: 0.22, label: "Hands" },
  { test: /\b(arms?|elbows?|biceps?|forearms?)\b/i, cx: 0.5, cy: 0.44, r: 0.24, label: "Arms" },
  { test: /\b(chest|ribs?|heart|sternum|collar\s?bones?)\b/i, cx: 0.5, cy: 0.38, r: 0.2, label: "Chest" },
  { test: /\b(shoulders?|scapula|shoulder\s?blades?)\b/i, cx: 0.5, cy: 0.33, r: 0.2, label: "Shoulders" },
  { test: /\b(necks?|throat|nape)\b/i, cx: 0.5, cy: 0.27, r: 0.16, label: "Neck" },
  { test: /\b(crown|heads?|skull|faces?|gaze|drishti|jaw|chin|forehead|ears?)\b/i, cx: 0.5, cy: 0.16, r: 0.16, label: "Crown & head" },
  { test: /\b(spine|back|torso|waist)\b/i, cx: 0.5, cy: 0.46, r: 0.22, label: "Spine & torso" },
];

export function focusFromText(text?: string | null): FocusZone | null {
  if (!text) return null;
  let best: { index: number; region: Region } | null = null;
  for (const region of REGIONS) {
    const m = region.test.exec(text);
    if (m && (best === null || m.index < best.index)) {
      best = { index: m.index, region };
    }
  }
  if (!best) return null;
  const { cx, cy, r, label } = best.region;
  return { cx, cy, r, label };
}

/** A step's own focusZone if authored, otherwise one inferred from its text. */
export function resolveStepFocus(
  step?: { text?: string; focusZone?: FocusZone | null } | null,
): FocusZone | null {
  if (!step) return null;
  return step.focusZone ?? focusFromText(step.text);
}
