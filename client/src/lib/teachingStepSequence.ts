/**
 * Teaching still → step sequence (not a fake video).
 *
 * When there is no reviewed movement demo and no AI trainer preview, the player
 * advances through this pose's own written steps and cues. Illustrations always
 * stay on *this* pose's image — foreign step keys are never remapped into
 * another body's PNG (same rule as PoseTrainerStage).
 *
 * prefers-reduced-motion / html.motion-off finish immediately (last step, no
 * timed advance, no crossfade).
 */
import type { StepMotionKey } from "@/components/StepMotion";
import type { FocusZone } from "@/lib/poseMoments";

export type TeachingStepInput = {
  text: string;
  pose?: string;
  stepMotion?: StepMotionKey;
  focusZone?: FocusZone;
};

export type TeachingStepFrame = {
  index: number;
  text: string;
  /** Always the catalog pose being taught — never a foreign illustration. */
  imageSlug: string;
  focusZone: FocusZone | null;
  stepMotion: StepMotionKey | null;
};

export function teachingStepFrames(
  slug: string,
  /** Catalog pose key — reserved so callers stay aligned with humanStepSlug. */
  _poseKey: string,
  steps: TeachingStepInput[],
): TeachingStepFrame[] {
  if (!steps.length) {
    return [
      {
        index: 0,
        text: "",
        imageSlug: slug,
        focusZone: null,
        stepMotion: null,
      },
    ];
  }
  return steps.map((step, index) => ({
    index,
    text: step.text,
    // Keep the teaching figure on this pose even when a step names an entry
    // shape (e.g. Down Dog's "from all fours" → cat). Sequencing the cue is
    // enough; swapping bodies is the bug this path exists to avoid.
    imageSlug: slug,
    focusZone: step.focusZone ?? null,
    stepMotion: step.stepMotion ?? null,
  }));
}

/**
 * Which frame to show. Reduced motion finishes immediately on the last step
 * so the stage never animates through a sequence the practitioner cannot
 * follow visually.
 */
export function resolveTeachingStepIndex(opts: {
  frameCount: number;
  stepIndex: number;
  reduceMotion: boolean;
}): number {
  const count = Math.max(1, opts.frameCount);
  if (opts.reduceMotion) return count - 1;
  return Math.min(Math.max(0, opts.stepIndex), count - 1);
}

/** Milliseconds between auto-advanced steps when the parent does not drive index. */
export const TEACHING_STEP_DWELL_MS = 3200;

export function prefersTeachingMotionOff(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return document.documentElement.classList.contains("motion-off");
}
