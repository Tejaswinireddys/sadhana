/**
 * The picture shown during a pose lesson.
 *
 * Rules this component exists to enforce:
 *  - It never plays the generated crossfade clips. Those dissolve a *different*
 *    pose's illustration into this one (Mountain into Warrior II, Easy Seat
 *    into Cat–Cow), so scrubbing a cue into them shows the wrong body.
 *  - Pausing does not change the image. The old stage swapped to the pose
 *    poster on pause, so pausing mid-lesson jumped to the final shape.
 *  - When there is no reviewed movement demonstration it shows this pose's own
 *    still, labelled "Static reference — movement demonstration unavailable",
 *    and says so out loud rather than implying motion.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageOff, Loader2 } from "lucide-react";
import type { PoseDemoAvailability } from "@/data/poseDemoAvailability";
import { STATIC_REFERENCE_LABEL } from "@/data/poseDemoAvailability";
import type { FocusZone } from "@/lib/poseMoments";
import { cn } from "@/lib/utils";

export type LessonStageMediaState = "idle" | "loading" | "ready" | "buffering" | "error";

type Props = {
  demo: PoseDemoAvailability;
  english: string;
  /** Drives the movement clip when one exists. Ignored for a static reference. */
  playing: boolean;
  /** Seconds into the current lesson segment's clip window. */
  clipTimeSec?: number;
  /** Bumped to restart the current segment's demonstration. */
  restartToken?: number;
  /**
   * Authored highlight for the current step, or null. Never inferred — a
   * guessed coordinate put "arms extended" on the figure's head.
   */
  focus?: FocusZone | null;
  caption?: string | null;
  onMediaStateChange?: (state: LessonStageMediaState) => void;
  className?: string;
  "data-testid"?: string;
};

export function PoseLessonStage({
  demo,
  english,
  playing,
  clipTimeSec = 0,
  restartToken = 0,
  focus = null,
  caption = null,
  onMediaStateChange,
  className,
  "data-testid": testId = "pose-lesson-stage",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<LessonStageMediaState>("idle");
  const hasMovement = demo.kind === "movement";

  useEffect(() => {
    const next: LessonStageMediaState = hasMovement ? "loading" : "idle";
    setState(next);
    onMediaStateChange?.(next);
  }, [hasMovement, demo.slug, restartToken, onMediaStateChange]);

  // Only a real movement clip is driven by play/pause. A still has no frame to
  // advance, and must not be swapped for anything else when the lesson pauses.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasMovement) return;
    if (Math.abs(v.currentTime - clipTimeSec) > 0.15) {
      try {
        v.currentTime = clipTimeSec;
      } catch {
        /* seek aborted */
      }
    }
    if (playing) void v.play().catch(() => undefined);
    else v.pause();
  }, [hasMovement, playing, clipTimeSec, restartToken]);

  const report = (next: LessonStageMediaState) => {
    setState(next);
    onMediaStateChange?.(next);
  };

  const busy = hasMovement && (state === "loading" || state === "buffering");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border",
        className,
      )}
      data-testid={testId}
      data-demo-kind={demo.kind}
      data-media-state={state}
    >
      {hasMovement ? (
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted
          preload="auto"
          poster={demo.poster ?? undefined}
          aria-label={`Demonstration of ${english}`}
          onCanPlay={() => report("ready")}
          onWaiting={() => report("buffering")}
          onError={() => report("error")}
        />
      ) : demo.poster ? (
        <img
          src={demo.poster}
          alt={`${english} — still reference`}
          className="h-full w-full object-contain"
          width={600}
          height={1200}
          data-testid="pose-lesson-static-reference"
        />
      ) : (
        <div
          className="flex h-full min-h-[10rem] w-full flex-col items-center justify-center gap-2 p-4 text-center"
          data-testid="pose-lesson-no-media"
        >
          <ImageOff className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Demonstration unavailable</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Follow the written cue below for this pose.
          </p>
        </div>
      )}

      {/*
        Authored highlights only, and only over a picture we are actually
        showing. A halo over an unrelated body is worse than no halo.
      */}
      {focus && demo.poster ? (
        <div
          className="pointer-events-none absolute rounded-full ring-2 ring-primary/70"
          style={{
            left: `${(focus.cx - focus.r) * 100}%`,
            top: `${(focus.cy - focus.r) * 100}%`,
            width: `${focus.r * 200}%`,
            height: `${focus.r * 200}%`,
          }}
          aria-hidden
          data-testid="pose-lesson-focus"
        />
      ) : null}

      {busy ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/55"
          role="status"
          aria-live="polite"
          data-testid="pose-lesson-loading"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
          <span className="ml-2 text-xs font-medium">
            {state === "buffering" ? "Buffering — holding the lesson" : "Loading"}
          </span>
        </div>
      ) : null}

      {caption ? (
        <div
          className="absolute inset-x-0 bottom-0 bg-foreground/90 px-3 py-2 text-xs text-background"
          data-testid="pose-lesson-caption"
          aria-live="polite"
        >
          {caption}
        </div>
      ) : null}

      {/* Honest media label — always visible, never a raw asset path. */}
      {!hasMovement ? (
        <p
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground"
          data-testid="pose-lesson-media-label"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {STATIC_REFERENCE_LABEL}
        </p>
      ) : null}
    </div>
  );
}
