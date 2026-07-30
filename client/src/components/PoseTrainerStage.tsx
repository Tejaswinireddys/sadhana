/**
 * PoseTrainerStage — human trainer demonstration for teaching surfaces.
 *
 * Default: PoseHumanStage — the hand-composed human figure crossfades through
 * narration steps and carries body momentum, so it reads like a trainer showing
 * how to enter and hold the pose.
 *
 * Optional video: only when a real filmed clip is registered in
 * POSE_MEDIA_OVERRIDES (CDN / capture). Generated Ken Burns zooms stay available
 * on disk but do not replace the human guide — they are not step-by-step training.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
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
  // Real filmed trainer clips only — not the illustration Ken Burns inventory.
  const hasFilmedTrainer = slug in POSE_MEDIA_OVERRIDES && poseHasVideo(slug);
  const [forceIllustrated, setForceIllustrated] = useState(false);

  useEffect(() => {
    setForceIllustrated(false);
  }, [slug]);

  const useVideo = hasFilmedTrainer && !forceIllustrated;

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
