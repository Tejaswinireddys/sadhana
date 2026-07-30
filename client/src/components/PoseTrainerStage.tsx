/**
 * PoseTrainerStage — trainer-style pose demonstration for teaching surfaces.
 *
 * Video path: muted looping demo clip (Ken Burns or filmed override) when the
 * slug is registered and the pose is a single shape — reads as a trainer
 * holding the posture for the user to copy.
 *
 * Illustrated path: PoseHumanStage with narration-driven body momentum. Used
 * when the pose walks through multiple shapes (entry → peak), when video is
 * missing / blocked / fails, or when a CDN override is not present for a
 * multi-shape pose. Never leaves an empty hero.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
import { asanaBySlug } from "@/data/content";
import { humanStepSlug } from "@/data/poseKeyImages";
import {
  POSE_MEDIA_OVERRIDES,
  poseHasVideo,
  poseMediaFor,
} from "@/data/poseMedia";

export type PoseTrainerStageProps = {
  slug: string;
  english: string;
  sanskrit: string;
  poseKey: string;
  stepPoseKey?: string | null;
  momentum?: string;
  stepIndex?: number;
  playing?: boolean;
  restartToken?: number;
  side?: 1 | 2;
  variant?: "detail" | "practice";
  className?: string;
  "data-testid"?: string;
  /** Notifies parent which visual mode is active (for labels / analytics). */
  onModeChange?: (mode: "video" | "illustrated") => void;
};

/** True when narration steps crossfade across more than one illustration. */
function hasShapeJourney(slug: string, poseKey: string): boolean {
  const asana = asanaBySlug(slug);
  if (!asana?.steps?.length) return false;
  const shapes = new Set(
    asana.steps.map((s) => humanStepSlug(slug, poseKey, s.pose)),
  );
  return shapes.size > 1;
}

export function PoseTrainerStage({
  slug,
  english,
  sanskrit,
  poseKey,
  stepPoseKey,
  momentum,
  stepIndex = 0,
  playing = false,
  restartToken = 0,
  side = 1,
  variant = "detail",
  className,
  "data-testid": testId,
  onModeChange,
}: PoseTrainerStageProps) {
  const media = useMemo(() => poseMediaFor(slug), [slug]);
  const canTryVideo = poseHasVideo(slug);
  const filmedOverride = slug in POSE_MEDIA_OVERRIDES;
  // Multi-shape poses keep the illustrated guide (step crossfade). Filmed
  // CDN overrides still win — those are real trainer clips.
  const preferIllustratedGuide =
    !filmedOverride && hasShapeJourney(slug, poseKey);
  const [forceIllustrated, setForceIllustrated] = useState(false);

  useEffect(() => {
    setForceIllustrated(false);
  }, [slug]);

  const useVideo =
    canTryVideo && !forceIllustrated && !preferIllustratedGuide;

  useEffect(() => {
    onModeChange?.(useVideo ? "video" : "illustrated");
  }, [useVideo, onModeChange]);

  const handleVideoUnavailable = useCallback(() => {
    setForceIllustrated(true);
  }, []);

  if (!useVideo) {
    return (
      <PoseHumanStage
        slug={slug}
        english={english}
        poseKey={poseKey}
        stepPoseKey={stepPoseKey}
        momentum={momentum}
        stepIndex={stepIndex}
        playing={playing}
        side={side}
        variant={variant}
        className={className}
        data-testid={testId}
      />
    );
  }

  return (
    <PoseDemoStage
      slug={slug}
      english={english}
      sanskrit={sanskrit}
      poseKey={poseKey}
      media={media}
      prefer3D={false}
      preferVideo
      playing={playing}
      restartToken={restartToken}
      stepIndex={stepIndex}
      stepPoseKey={stepPoseKey ?? undefined}
      side={side}
      variant={variant}
      className={className}
      onVideoUnavailable={handleVideoUnavailable}
      data-testid={testId}
    />
  );
}
