/**
 * Instructor demo stage — plays presentation animation when available,
 * otherwise an honest static reference. Never zooms/pans a still to fake motion.
 * Never plays base-pose media labeled as an unmatched adaptation.
 */
import { useEffect, useRef } from "react";
import type { InstructorMediaRef } from "@/data/instructorPilot";
import { cn } from "@/lib/utils";

type Props = {
  media: InstructorMediaRef;
  playing: boolean;
  /** 0–1 progress through the current media window (entry/exit). */
  mediaProgress?: number;
  mediaWindow?: { start: number; end: number } | null;
  /** When true, keep status text out of the image (shown by the parent). */
  compactLabel?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function InstructorStage({
  media,
  playing,
  mediaProgress = 0,
  mediaWindow = null,
  compactLabel = false,
  className,
  "data-testid": testId = "instructor-stage",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canPlayAnim =
    media.kind === "presentation_animation" && Boolean(media.videoMp4 || media.videoWebm);
  const showUnavailable = media.kind === "missing" || (!canPlayAnim && !media.poster);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !canPlayAnim) return;
    if (mediaWindow && v.duration && Number.isFinite(v.duration)) {
      const start = mediaWindow.start * v.duration;
      const end = mediaWindow.end * v.duration;
      const target = start + Math.max(0, Math.min(1, mediaProgress)) * Math.max(0.01, end - start);
      if (Math.abs(v.currentTime - target) > 0.12) {
        try {
          v.currentTime = target;
        } catch {
          /* seek abort */
        }
      }
    }
    if (playing && mediaWindow) {
      void v.pause();
    } else if (playing && !mediaWindow) {
      void v.pause();
    } else {
      v.pause();
    }
  }, [canPlayAnim, mediaProgress, mediaWindow, playing]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border",
        className,
      )}
      data-testid={testId}
    >
      {canPlayAnim ? (
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted
          preload="metadata"
          poster={media.poster ?? undefined}
          aria-label="Pose demonstration animation"
        >
          {media.videoWebm ? <source src={media.videoWebm} type="video/webm" /> : null}
          {media.videoMp4 ? <source src={media.videoMp4} type="video/mp4" /> : null}
        </video>
      ) : showUnavailable ? (
        <div
          className="flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 bg-muted/60 p-4 text-center"
          data-testid="instructor-media-unavailable"
        >
          <p className="text-sm font-medium text-foreground">Demonstration unavailable</p>
          <p className="max-w-sm text-xs text-muted-foreground" data-testid="instructor-media-unavailable-detail">
            {media.label ||
              "Follow the text cues for this variation. Matching filmed or reviewed media is not available yet."}
          </p>
        </div>
      ) : (
        <img
          src={media.poster!}
          alt="Static pose reference"
          className="h-full w-full object-contain"
          width={600}
          height={1200}
        />
      )}

      {!compactLabel && !showUnavailable ? (
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/55 to-transparent p-3 pt-10"
          data-testid="instructor-media-label"
        >
          <p className="text-xs font-medium text-foreground/90">{media.label}</p>
          {media.reviewStatus !== "instructor_reviewed" ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Not instructor-reviewed video
              {media.reviewStatus === "editor_catalog_note" ? " · catalog note only" : ""}.
            </p>
          ) : null}
        </div>
      ) : (
        <span className="sr-only" data-testid="instructor-media-label">
          {media.label}
        </span>
      )}
    </div>
  );
}
