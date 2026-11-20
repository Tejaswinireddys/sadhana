/**
 * PoseTrainerStage — presentation surface and teaching figure.
 *
 * Idle / watch (library, detail, search): the looping step-journey clip, which
 * is a montage of stills and is presented as decoration, not instruction.
 *
 * Teaching (`teaching`, or any practice-variant stage): the generated clips are
 * **not allowed**. `script/gen-pose-videos.ts` crossfades 2–3 stills and, for
 * 205 of the catalog's poses, opens on a *different* pose chosen by category —
 * Restorative opens on sukhasana, which is why the first instruction of
 * Supported Child's Pose showed someone sitting cross-legged. Teaching falls
 * back to this pose's own illustration, labelled as a static reference, until
 * a reviewed movement demo exists (`poseDemoAvailability`).
 *
 * The same rule applies to the per-step illustration: a step whose pose key
 * maps to another catalog slug is ignored while teaching, so Warrior I's cues
 * cannot swap in Anjaneyasana's body.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseHumanStage } from "@/components/PoseHumanStage";
import { TeachingStepSequence } from "@/components/TeachingStepSequence";
import { asanaBySlug } from "@/data/content";
import { hasRigSequence } from "@/data/poseKeyframes";
import { humanStepSlug, poseHasShapeJourney } from "@/data/poseKeyImages";
import { poseDemoAvailability, STATIC_REFERENCE_LABEL } from "@/data/poseDemoAvailability";
import {
  AI_TRAINER_PRACTICE_VIDEO,
  aiTrainerLessonFor,
  teachingVisual,
  type AiTrainerLesson,
} from "@/data/aiTrainerLessons";
import { poseImageCaveat, poseImageShortCaveat } from "@/data/poseImageAccuracy";
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
  /**
   * This stage is teaching the pose right now. Only a reviewed movement
   * demonstration may be shown; generated clips and foreign step
   * illustrations are refused. `variant="practice"` implies it.
   */
  teaching?: boolean;
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
  teaching = false,
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

  /** Is this stage claiming to show how the pose is performed? */
  const isTeaching = teaching || variant === "practice";
  /** Only a reviewed clip may be presented as instruction. */
  const demoIsReviewedMovement = poseDemoAvailability(slug).kind === "movement";
  const clipAllowed = Boolean(media) && (!isTeaching || demoIsReviewedMovement);

  /** Looping presentation video whenever we are not mid-cue teaching. */
  const wantPresentation = clipAllowed && !guideActive && !videoBlocked;
  /** How-to clip scrubbed to the spoken cue during instruction / training. */
  const wantSyncedHowTo = clipAllowed && guideActive && !videoBlocked && syncVideoToVoice;

  useEffect(() => {
    setVideoBlocked(false);
  }, [slug]);

  useEffect(() => {
    if (wantSyncedHowTo || wantPresentation) onModeChange?.("video");
    else onModeChange?.(useRig ? "3d" : "illustrated");
  }, [wantPresentation, wantSyncedHowTo, useRig, onModeChange]);

  // A step illustration that resolves to another catalog pose is a different
  // body, not a stage of this one. While teaching, stay on this pose.
  const stepPoseIsForeign =
    !!stepPoseKey && humanStepSlug(slug, poseKey, stepPoseKey) !== slug;
  const safeStepPoseKey = isTeaching && stepPoseIsForeign ? poseKey : stepPoseKey;
  const effectiveStepPose = guideActive ? safeStepPoseKey : poseKey;
  const effectiveMomentum =
    !useRig && shapeJourney && guideActive && !isTeaching ? momentum ?? "" : "";

  const visual = teachingVisual(slug, demoIsReviewedMovement);
  if (isTeaching && visual === "ai-preview") {
    const lesson = aiTrainerLessonFor(slug);
    if (lesson) {
      return (
        <AiTrainerPracticeClip
          lesson={lesson}
          playing={playing}
          className={className}
          testId={testId}
        />
      );
    }
  }

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

  if (useRig && !isTeaching) {
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

  // Teaching without a reviewed clip or AI preview: sequence this pose's own
  // steps/cues. Idle surfaces still use PoseHumanStage (presentation still).
  if (isTeaching && visual === "still") {
    return (
      <TeachingStepSequence
        slug={slug}
        english={english}
        poseKey={poseKey}
        stepIndex={stepIndex}
        playing={playing}
        guideActive={guideActive}
        caption={guideActive ? caption : null}
        side={side}
        variant={variant}
        className={className}
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
      // A reviewed mismatch is more specific and more useful than the generic
      // "no movement demo" line, so it wins the one slot available.
      referenceNote={
        isTeaching
          ? (poseImageShortCaveat(slug) ??
            (demoIsReviewedMovement ? null : STATIC_REFERENCE_LABEL))
          : null
      }
      referenceNoteTitle={isTeaching ? poseImageCaveat(slug) : null}
      variant={variant}
      className={className}
      data-testid={testId}
    />
  );
}

/**
 * Pilot clip for teaching. Labeled as AI-generated. It is not a reviewed
 * movement demonstration and must not be treated as one.
 */
function AiTrainerPracticeClip({
  lesson,
  playing,
  className,
  testId,
}: {
  lesson: AiTrainerLesson;
  playing: boolean;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [painted, setPainted] = useState(false);
  // A new pose must not keep the previous frame. Changing `src` while paused
  // often does not repaint until play(), which is why skipping while paused
  // left the last trainer on screen.
  useEffect(() => {
    setPainted(false);
    const video = ref.current;
    if (!video) return;
    video.load();
  }, [lesson.slug]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing, lesson.slug]);
  return (
    <figure
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-card [container-type:size] ${className ?? ""}`}
      data-testid={testId ?? "ai-trainer-practice"}
      data-fit="cover-band"
      data-aspect="16/9"
    >
      {/*
        The file is 9:16 with the trainer in the middle band. A 16:9 box that
        fits the stage, with object-cover, drops the empty beige. The video
        must fill that box — absolute inset-0 on the tall stage painted the
        whole slide again, letterbox and all.
      */}
      <div
        className="relative aspect-video max-h-full max-w-full"
        style={{ width: "min(100cqw, calc(100cqh * 16 / 9))" }}
      >
        <img
          src={lesson.poster}
          alt=""
          width={lesson.width}
          height={lesson.height}
          className={`${AI_TRAINER_PRACTICE_VIDEO} h-full`}
          data-testid="ai-trainer-practice-poster"
        />
        <video
          key={lesson.slug}
          ref={ref}
          src={lesson.mp4}
          poster={lesson.poster}
          playsInline
          crossOrigin="anonymous"
          preload="auto"
          className={`${AI_TRAINER_PRACTICE_VIDEO} absolute inset-0 h-full ${painted ? "" : "opacity-0"}`}
          data-testid="ai-trainer-practice-video"
          onLoadedData={() => setPainted(true)}
        >
          <track kind="captions" src={lesson.captionsVtt} srcLang="en" label="English" default />
        </video>
        <figcaption
          className="absolute inset-x-2 top-2 z-10 truncate rounded-full bg-background/90 px-2.5 py-1 text-center text-[11px] font-medium text-foreground shadow-sm"
          title="Photorealistic AI-generated trainer, not a filmed demonstration."
          data-testid="ai-trainer-practice-label"
        >
          {lesson.label}
          <span className="sr-only">
            . Photorealistic AI-generated trainer, not a filmed demonstration.
          </span>
        </figcaption>
      </div>
    </figure>
  );
}
