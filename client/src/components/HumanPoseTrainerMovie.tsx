import { PoseReferenceImage } from "./PoseReferenceImage";
/** Static fallback shared by all training surfaces. Never fabricate body movement. */
import { useState } from "react";
import { poseImageAlt } from "@/data/poseImageAlts";
import { accurateImageAlt, poseImageWithheld } from "@/data/poseImageAccuracy";
import { STATIC_REFERENCE_LABEL } from "@/data/poseDemoAvailability";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import type { LessonPhase, VariationLevel } from "@/lib/poseLesson";
import { cn } from "@/lib/utils";

export type TrainerCameraShot = "auto" | "front" | "side";
export type BreathMode = "inhale" | "exhale" | "steady";

export type CalloutPoint = {
  /** Normalized 0..1 coordinates within the cropped figure bounding box */
  x: number;
  y: number;
  label: string;
  detail: string;
};

export type FigureCropBox = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  bgColor: string;
};

export type HumanPoseTrainerMovieProps = {
  slug: string;
  english: string;
  sanskrit?: string;
  posterSrc: string;
  playing: boolean;
  training?: boolean;
  level?: VariationLevel;
  phase?: LessonPhase | "side_switch" | "transition";
  stepIndex?: number;
  stepCount?: number;
  stepProgress?: number;
  side?: 1 | 2;
  breathMode?: BreathMode;
  breathCue?: string | null;
  cueText?: string | null;
  coachBadge?: string | null;
  cameraView?: TrainerCameraShot;
  className?: string;
  "data-testid"?: string;
};

/** Legacy name retained for callers; this is explicitly a still, never a movie. */
export function HumanPoseTrainerMovie({
  slug, english, posterSrc, className, "data-testid": testId,
}: HumanPoseTrainerMovieProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (poseImageWithheld(slug)) {
    return <WithheldPoseImage slug={slug} className={className} />;
  }
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-muted/40", className)}
      data-testid={testId ?? `human-trainer-movie-${slug}`} data-media="static_reference">
      {failedSource === posterSrc ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Pose reference unavailable. Follow the written instructions.
        </div>
      ) : (
        <PoseReferenceImage src={posterSrc} alt={accurateImageAlt(slug, poseImageAlt(slug) || english)}
          width={600} height={1200} loading="lazy" draggable={false}
          onError={() => setFailedSource(posterSrc)}
          className="h-full w-full object-contain" />
      )}
      <p className="absolute inset-x-0 bottom-0 bg-background/90 p-2 text-center text-xs text-muted-foreground">
        {STATIC_REFERENCE_LABEL}
      </p>
    </div>
  );
}
