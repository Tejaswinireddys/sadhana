/**
 * Instructor demo stage.
 *
 * Shows a reviewed demonstration when one exists, a labelled placeholder when
 * one does not, and an explicit unavailable panel when there is nothing honest
 * to show. It never zooms, pans or cross-fades a still to imply movement, and
 * it never plays base-pose media labelled as an adaptation.
 *
 * Playback state is reported upward: while the video is buffering the session
 * clock has to stall too, or the narration and the hold timer run ahead of the
 * body on screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import type { InstructorMediaRef } from "@/data/instructorPilot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StageMediaState = "idle" | "loading" | "ready" | "buffering" | "error";

type Props = {
  media: InstructorMediaRef;
  playing: boolean;
  /** 0–1 progress through the current media window (entry/exit). */
  mediaProgress?: number;
  mediaWindow?: { start: number; end: number } | null;
  /** When true, keep status text out of the image (shown by the parent). */
  compactLabel?: boolean;
  /** Lets the session stall its clock while this is buffering. */
  onMediaStateChange?: (state: StageMediaState) => void;
  className?: string;
  "data-testid"?: string;
};

export function InstructorStage({
  media,
  playing,
  mediaProgress = 0,
  mediaWindow = null,
  compactLabel = false,
  onMediaStateChange,
  className,
  "data-testid": testId = "instructor-stage",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<StageMediaState>("idle");
  // Bumped by Retry to force the element to re-request its sources.
  const [attempt, setAttempt] = useState(0);

  const canPlayAnim =
    (media.kind === "presentation_animation" ||
      media.kind === "filmed_instructor" ||
      media.kind === "reviewed_3d") &&
    Boolean(media.videoMp4 || media.videoWebm);
  const showUnavailable = media.kind === "missing" || (!canPlayAnim && !media.poster);

  const report = useCallback(
    (next: StageMediaState) => {
      setState(next);
      onMediaStateChange?.(next);
    },
    [onMediaStateChange],
  );

  // A new clip starts from scratch; a still or an unavailable panel is never
  // "loading", so the session must not stall waiting for one.
  useEffect(() => {
    report(canPlayAnim ? "loading" : "idle");
  }, [canPlayAnim, media.videoMp4, media.videoWebm, attempt, report]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !canPlayAnim) return;

    // Scrub to the point in the clip that matches the phase we are teaching.
    // The element stays paused: the shared session clock drives position, so
    // there is nothing for the video's own playback rate to drift against.
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
    v.pause();
  }, [canPlayAnim, mediaProgress, mediaWindow, playing]);

  const retry = () => {
    report("loading");
    setAttempt((a) => a + 1);
    const v = videoRef.current;
    if (v) {
      try {
        v.load();
      } catch {
        /* the effect above will re-report on the next error */
      }
    }
  };

  const busy = state === "loading" || state === "buffering";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border",
        className,
      )}
      data-testid={testId}
      data-media-state={state}
    >
      {canPlayAnim && state !== "error" ? (
        <video
          key={`${media.videoMp4 ?? media.videoWebm ?? "clip"}-${attempt}`}
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted
          preload="auto"
          poster={media.poster ?? undefined}
          aria-label={
            media.showsMovement
              ? "Instructor demonstration of this pose"
              : "Pose reference animation — not a filmed instructor demonstration"
          }
          onLoadedData={() => report("ready")}
          onCanPlay={() => report("ready")}
          onWaiting={() => report("buffering")}
          onStalled={() => report("buffering")}
          onError={() => report("error")}
        >
          {media.videoWebm ? <source src={media.videoWebm} type="video/webm" /> : null}
          {media.videoMp4 ? <source src={media.videoMp4} type="video/mp4" /> : null}
        </video>
      ) : showUnavailable || state === "error" ? (
        <div
          className="flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 bg-muted/60 p-4 text-center"
          data-testid="instructor-media-unavailable"
        >
          {state === "error" ? (
            <>
              <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">Demonstration didn&apos;t load</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Your practice is still running — follow the cues below while we try again.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 min-h-11"
                onClick={retry}
                data-testid="instructor-media-retry"
              >
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden /> Retry
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Demonstration unavailable</p>
              <p
                className="max-w-sm text-xs text-muted-foreground"
                data-testid="instructor-media-unavailable-detail"
              >
                {media.label ||
                  "Follow the text cues for this variation. Matching filmed or reviewed media is not available yet."}
              </p>
            </>
          )}
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

      {busy ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
          data-testid="instructor-media-loading"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
          <span className="ml-2 text-xs font-medium">
            {state === "buffering" ? "Buffering — holding the timer" : "Loading demonstration"}
          </span>
        </div>
      ) : null}

      {!compactLabel && !showUnavailable && state !== "error" ? (
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

/**
 * Warms the next pose's clip so a transition does not land on a spinner.
 * Renders nothing; the browser keeps the fetched bytes in its media cache.
 */
export function InstructorMediaPreload({ media }: { media: InstructorMediaRef | null }) {
  const src = media?.videoWebm ?? media?.videoMp4 ?? null;
  if (!src) return null;
  return (
    <video
      key={src}
      src={src}
      preload="auto"
      muted
      playsInline
      aria-hidden
      tabIndex={-1}
      className="pointer-events-none absolute h-px w-px opacity-0"
      data-testid="instructor-media-preload"
    />
  );
}
