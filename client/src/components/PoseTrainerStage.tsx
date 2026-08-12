/**
 * PoseTrainerStage — BetterMe-style presentation + teaching figure.
 *
 * Idle / watch: looping step-journey demo video for every pose that ships a clip
 * (library + detail + guided intro moments).
 *
 * Active cue teaching: the same how-to clip, scrubbed to the spoken narration
 * step. Illustration / 3D remain the fallback when video is unavailable.
 */
import { useEffect, useMemo, useState } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
import { asanaBySlug } from "@/data/content";
import { hasRigSequence } from "@/data/poseKeyframes";
import { poseHasShapeJourney } from "@/data/poseKeyImages";
import { poseMediaFor } from "@/data/poseMedia";
import { manifestToVideoSources, usePoseMedia } from "@/lib/poseMediaApi";
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
  /**
   * When true (guided instruction / pose training), keep the how-to video
   * visible and scrub it to the spoken cue instead of switching to illustration.
   */
  syncVideoToVoice?: boolean;
  narrationTime?: number;
  narrationDuration?: number;
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
  syncVideoToVoice = true,
  narrationTime = 0,
  narrationDuration = 0,
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
  const [videoBlocked, setVideoBlocked] = useState(false);

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
  const { data: manifest } = usePoseMedia(slug);
  const media = useMemo(() => manifestToVideoSources(slug, manifest), [slug, manifest]);
  const hasClip = Boolean(media);

  /** Looping presentation video whenever we are not mid-cue teaching. */
  const wantPresentation = hasClip && !guideActive && !videoBlocked;
  /** How-to clip scrubbed to the spoken cue during instruction / training. */
  const wantSyncedHowTo = hasClip && guideActive && !videoBlocked && syncVideoToVoice;

  useEffect(() => {
    setVideoBlocked(false);
  }, [slug]);

  useEffect(() => {
    if (wantSyncedHowTo || wantPresentation) onModeChange?.("video");
    else onModeChange?.(useRig ? "3d" : "illustrated");
  }, [wantPresentation, wantSyncedHowTo, useRig, onModeChange]);

  const effectiveStepPose = guideActive ? stepPoseKey : poseKey;
  const effectiveMomentum = !useRig && shapeJourney && guideActive ? momentum ?? "" : "";

  if ((wantSyncedHowTo || wantPresentation) && media) {
    return (
      <PoseDemoStage
        key={`video-${slug}`}
        slug={slug}
        english={english}
        sanskrit={sanskrit}
        poseKey={poseKey}
        media={media}
        prefer3D={false}
        preferVideo
        playing={wantSyncedHowTo ? playing : true}
        restartToken={restartToken}
        syncToVoice={wantSyncedHowTo}
        narrationTime={narrationTime}
        narrationDuration={narrationDuration}
        stepIndex={stepIndex}
        stepProgress={stepProgress}
        stepCount={asana?.steps.length ?? 1}
        stepPoseKey={effectiveStepPose ?? undefined}
        focusZone={wantSyncedHowTo ? focusZone : null}
        caption={wantSyncedHowTo ? caption : null}
        side={side}
        variant={variant}
        className={className}
        onMediaModeChange={(mode) =>
          onModeChange?.(mode === "video" ? "video" : "illustrated")
        }
        onVideoUnavailable={() => setVideoBlocked(true)}
        data-testid={testId}
      />
    );
  }

  if (useRig) {
    return (
      <PoseDemoStage
        key={`rig-${slug}`}
        slug={slug}
        english={english}
        sanskrit={sanskrit}
        poseKey={poseKey}
        media={media ?? poseMediaFor(slug)}
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
