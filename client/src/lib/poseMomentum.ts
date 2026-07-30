/**
 * Choose a whole-body "momentum" for a narration step so the illustrated figure
 * moves with the cue like a live trainer demonstrating — grounding on the feet,
 * lifting through the legs, swaying open the shoulders, rising through the crown.
 *
 * A flat illustration can't articulate individual joints, so this drives a
 * tasteful whole-figure motion (see .figure-momentum-* in index.css) picked
 * from the step's stepMotion, or inferred from its text.
 */
import type { StepMotionKey } from "@/components/StepMotion";

export type MomentumKind =
  | "breath"
  | "ground"
  | "rise"
  | "lift"
  | "sway"
  | "extend"
  | "fold"
  | "rock";

const BY_MOTION: Partial<Record<StepMotionKey, MomentumKind>> = {
  ground: "ground",
  settle: "ground",
  inhale: "breath",
  exhale: "breath",
  balance: "breath",
  lift: "lift",
  "arm-extend": "extend",
  "leg-extend": "extend",
  "hip-shift": "rock",
  "limb-rotate": "sway",
  "torso-fold": "fold",
  twist: "sway",
};

// Scanned by earliest match in the sentence, so order only breaks ties.
const TEXT_RULES: [RegExp, MomentumKind][] = [
  [/\b(fold|forward|hinge|bow|drape)\b/i, "fold"],
  [/\b(crown|reach(es)? up(ward)?|lengthen|grow tall|rise|lift the chest|tall)\b/i, "rise"],
  [/\b(ground|root|plant|foundation|weight (even|into)|press (down|into)|feet|stand)\b/i, "ground"],
  [/\b(extend|straighten|reach the arms|arms? (out|wide|parallel)|widen|open the arms)\b/i, "extend"],
  [/\b(twist|rotate|revolve|wring)\b/i, "sway"],
  [/\b(roll the shoulders|open (the )?(chest|heart)|shoulders)\b/i, "sway"],
  [/\b(engage|kneecaps?|squeeze|hug (in|the)|draw up|thighs|lift the knee)\b/i, "lift"],
  [/\b(breathe|inhale|exhale|soften|relax|settle|steady|calm|still)\b/i, "breath"],
];

export function momentumFromText(text?: string | null): MomentumKind | null {
  if (!text) return null;
  let best: { index: number; kind: MomentumKind } | null = null;
  for (const [re, kind] of TEXT_RULES) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, kind };
  }
  return best?.kind ?? null;
}

export function stepMomentum(
  step?: { text?: string; stepMotion?: StepMotionKey } | null,
): MomentumKind {
  if (!step) return "breath";
  if (step.stepMotion && BY_MOTION[step.stepMotion]) return BY_MOTION[step.stepMotion]!;
  return momentumFromText(step.text) ?? "breath";
}

/** Ready-to-apply className for the figure's momentum animation. */
export function momentumClass(
  step?: { text?: string; stepMotion?: StepMotionKey } | null,
): string {
  return `figure-momentum figure-momentum-${stepMomentum(step)}`;
}
