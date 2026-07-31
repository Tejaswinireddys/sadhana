/**
 * PoseTrainerStage — human teaching figure for pose explanation & guided practice.
 *
 * Prefer real motion over Ken Burns zooms on a still:
 *   1. Rigged WebGL figurine when keyframes exist (limbs travel with the cue)
 *   2. Illustrated PoseHumanStage that crossfades entry → peak per narration step
 *
 * Looping step-journey clips remain available for library cards via poseMedia.
 */
import { useEffect, useMemo } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
import { asanaBySlug } from "@/data/content";
import { hasRigSequence } from "@/data/poseKeyframes";
import { poseHasShapeJourney } from "@/data/poseKeyImages";
import { poseMediaFor } from "@/data/poseMedia";
import type { FocusZone } from "@/lib/poseMoments";

export type PoseTrainerStageProps = {
  slug: string;
  english: string;
  sanskrit: string;
  poseKey: string;
  stepPoseKey?: string | null;
  momentum?: string;
  stepIndex?: number;
  stepProgress?: number;
  playing?: boolean;
  restartToken?: number;
  guideActive?: boolean;
  focusZone?: FocusZone | null;
  caption?: string | null;
  side?: 1 | 2;
  variant?: "detail" | "practice";
  className?: string;
  "data-testid"?: string;
  onModeChange?: (mode: "video" | "illustrated" | "3d") => void;
};

export function PoseTrainerStage({
  slug,
  english,
  sanskrit,
  poseKey,
  stepPoseKey,
  momentum,
  stepIndex = 0,
  stepProgress = 1,
  playing = false,
  restartToken = 0,
  guideActive = false,
  focusZone = null,
  caption = null,
  side = 1,
  variant = "detail",
  className,
  "data-testid": testId,
  onModeChange,
}: PoseTrainerStageProps) {
  const asana = asanaBySlug(slug);
  const shapeJourney = useMemo(
    () =>
      !!asana &&
      poseHasShapeJourney(
        slug,
        poseKey,
        asana.steps.map((s) => s.pose),
      ),
    [asana, slug, poseKey],
  );

  const useRig = hasRigSequence(slug);
  const media = useMemo(() => poseMediaFor(slug), [slug]);

  const effectiveStepPose = guideActive ? stepPoseKey : poseKey;
  // Only apply whole-body momentum CSS when we are on the illustrated path and
  // the pose actually changes shape — otherwise keep the figure steady.
  const effectiveMomentum = !useRig && shapeJourney && guideActive ? momentum ?? "" : "";

  useEffect(() => {
    onModeChange?.(useRig ? "3d" : "illustrated");
  }, [useRig, onModeChange]);

  if (useRig) {
    return (
      <PoseDemoStage
        key={slug}
        slug={slug}
        english={english}
        sanskrit={sanskrit}
        poseKey={poseKey}
        media={media}
        prefer3D
        preferVideo={false}
        playing={playing}
        restartToken={restartToken}
        stepIndex={stepIndex}
        stepProgress={stepProgress}
        stepCount={asana?.steps.length ?? 1}
        stepPoseKey={effectiveStepPose ?? undefined}
        focusZone={guideActive ? focusZone : null}
        caption={guideActive ? caption : null}
        side={side}
        variant={variant}
        className={className}
        onMediaModeChange={(mode) => onModeChange?.(mode === "3d" ? "3d" : "illustrated")}
        data-testid={testId}
      />
    );
  }

  return (
    <PoseHumanStage
      slug={slug}
      english={english}
      poseKey={poseKey}
      stepPoseKey={effectiveStepPose}
      momentum={effectiveMomentum}
      stepIndex={stepIndex}
      playing={playing}
      side={side}
      focusZone={guideActive ? focusZone : null}
      caption={guideActive ? caption : null}
      variant={variant}
      className={className}
      data-testid={testId}
    />
  );
}
