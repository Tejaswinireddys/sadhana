/**
 * PoseTrainerStage — clear pose teaching for detail / guided surfaces.
 *
 * Default: illustrated human figure with step focus + captions (readable
 * training). Ken Burns looping clips are NOT used for teaching — they only
 * bob a still image. Real filmed CDN overrides in POSE_MEDIA_OVERRIDES still win.
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
import type { FocusZone } from "@/lib/poseMoments";

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
   * instruction). When false, the stage always shows THIS pose (still art).
   */
  guideActive?: boolean;
  focusZone?: FocusZone | null;
  caption?: string | null;
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
  focusZone = null,
  caption = null,
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

  // Only real filmed overrides use video. Generated Ken Burns clips look like
  // “moving up and down” — not a training explanation.
  const useVideo = filmedOverride && hasVideo && !forceIllustrated;

  useEffect(() => {
    onModeChange?.(useVideo ? "video" : "illustrated");
  }, [useVideo, onModeChange]);

  const handleVideoUnavailable = useCallback(() => {
    setForceIllustrated(true);
  }, []);

  const effectiveStepPose = guideActive ? stepPoseKey : poseKey;
  // Whole-body bounce only when the illustration actually changes shape.
  const effectiveMomentum = shapeJourney && guideActive ? momentum : "";

  if (!useVideo) {
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
      focusZone={guideActive ? focusZone : null}
      side={side}
      variant={variant}
      className={className}
      onVideoUnavailable={handleVideoUnavailable}
      data-testid={testId}
    />
  );
}
