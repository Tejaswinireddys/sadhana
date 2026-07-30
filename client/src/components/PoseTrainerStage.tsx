/**
 * PoseTrainerStage — correct pose demonstration for teaching surfaces.
 *
 * Idle / single-shape: looping demo video for THIS pose slug when registered
 * (Ken Burns of the correct illustration), so users see the pose they opened.
 *
 * Multi-shape narration: PoseHumanStage crossfades entry → peak with body
 * momentum. Idle always pins to this pose's own artwork (never another asana).
 *
 * Filmed CDN overrides in POSE_MEDIA_OVERRIDES always prefer real video.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
import { asanaBySlug } from "@/data/content";
import { poseHasShapeJourney } from "@/data/poseKeyImages";
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
  /**
   * True while the user is in an active step walkthrough (narration / guided
   * instruction). When false, the stage always shows THIS pose (video or art).
   */
  guideActive?: boolean;
  side?: 1 | 2;
  variant?: "detail" | "practice";
  className?: string;
  "data-testid"?: string;
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
  guideActive = false,
  side = 1,
  variant = "detail",
  className,
  "data-testid": testId,
  onModeChange,
}: PoseTrainerStageProps) {
  const media = useMemo(() => poseMediaFor(slug), [slug]);
  const hasVideo = poseHasVideo(slug);
  const filmedOverride = slug in POSE_MEDIA_OVERRIDES;
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
  const [forceIllustrated, setForceIllustrated] = useState(false);

  useEffect(() => {
    setForceIllustrated(false);
  }, [slug]);

  // Video of THIS pose when available — except mid multi-shape walkthrough,
  // where the human stage must crossfade entry → peak. Filmed overrides always win.
  const useVideo =
    hasVideo &&
    !forceIllustrated &&
    (filmedOverride || !guideActive || !shapeJourney);

  useEffect(() => {
    onModeChange?.(useVideo ? "video" : "illustrated");
  }, [useVideo, onModeChange]);

  const handleVideoUnavailable = useCallback(() => {
    setForceIllustrated(true);
  }, []);

  // Idle / non-guide: pin to this pose's shape so Tree never opens as Mountain.
  const effectiveStepPose = guideActive ? stepPoseKey : poseKey;

  if (!useVideo) {
    return (
      <PoseHumanStage
        slug={slug}
        english={english}
        poseKey={poseKey}
        stepPoseKey={effectiveStepPose}
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
      stepPoseKey={effectiveStepPose ?? undefined}
      side={side}
      variant={variant}
      className={className}
      onVideoUnavailable={handleVideoUnavailable}
      data-testid={testId}
    />
  );
}
