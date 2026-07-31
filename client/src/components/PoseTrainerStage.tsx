/**
 * PoseTrainerStage — large step video for teaching surfaces.
 *
 * While training, plays the demo clip for the current step’s shape (this pose,
 * or the entry shape on a multi-shape journey). Restarts on each step so the
 * clip reads as a fresh cue. Falls back to the illustrated figure when no
 * clip is registered.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
import { asanaBySlug } from "@/data/content";
import { humanStepSlug, poseHasShapeJourney } from "@/data/poseKeyImages";
import { poseHasVideo, poseMediaFor } from "@/data/poseMedia";
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

  // Idle: this pose. Training: the step’s shape (e.g. Mountain → Tree).
  const displaySlug = useMemo(
    () => humanStepSlug(slug, poseKey, guideActive ? stepPoseKey : poseKey),
    [slug, poseKey, guideActive, stepPoseKey],
  );

  const media = useMemo(() => poseMediaFor(displaySlug), [displaySlug]);
  const hasVideo = poseHasVideo(displaySlug);
  const [forceIllustrated, setForceIllustrated] = useState(false);

  useEffect(() => {
    setForceIllustrated(false);
  }, [displaySlug]);

  // Prefer registered demo clips so each step plays a video, not a tiny still.
  const useVideo = hasVideo && !forceIllustrated;

  useEffect(() => {
    onModeChange?.(useVideo ? "video" : "illustrated");
  }, [useVideo, onModeChange]);

  const handleVideoUnavailable = useCallback(() => {
    setForceIllustrated(true);
  }, []);

  const effectiveStepPose = guideActive ? stepPoseKey : poseKey;
  const effectiveMomentum = shapeJourney && guideActive && !useVideo ? momentum : "";

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
      key={displaySlug}
      slug={displaySlug}
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
      caption={guideActive ? caption : null}
      side={side}
      variant={variant}
      className={className}
      onVideoUnavailable={handleVideoUnavailable}
      data-testid={testId}
    />
  );
}
