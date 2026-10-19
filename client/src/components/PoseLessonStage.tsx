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
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Eye, ImageOff, Loader2, UserCheck } from "lucide-react";
import type { PoseDemoAvailability } from "@/data/poseDemoAvailability";
import { STATIC_REFERENCE_LABEL } from "@/data/poseDemoAvailability";
import { resolveTrainerStageState } from "@/data/poseKeyframes";
import { useMotionEnabled } from "@/components/motion";
import type { LessonPhase } from "@/lib/poseLesson";
import type { FocusZone } from "@/lib/poseMoments";
import { cn } from "@/lib/utils";

const HumanTrainerFigurine = lazy(() =>
  import("@/components/PoseFigurineGL").then((m) => ({ default: m.PoseFigurineGL })),
);

function webglSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

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
  /** Live lesson timeline state for the 3D human yoga trainer. */
  phase?: LessonPhase;
  stepNumber?: number | null;
  stepProgress?: number;
  side?: "left" | "right" | "both";
  firstSide?: "left" | "right";
  breathMovement?: "inhale" | "exhale" | "neutral" | null;
  breathCue?: string | null;
  training?: boolean;
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
  phase,
  stepNumber = null,
  stepProgress = 1,
  side = "both",
  firstSide = "right",
  breathMovement = null,
  breathCue = null,
  training = false,
  onMediaStateChange,
  className,
  "data-testid": testId = "pose-lesson-stage",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<LessonStageMediaState>("idle");
  const [canGL, setCanGL] = useState(false);
  const [cameraView, setCameraView] = useState<"auto" | "front" | "side">("auto");
  const motionOn = useMotionEnabled();
  const hasMovement = demo.kind === "movement";

  useEffect(() => {
    setCanGL(webglSupported());
  }, []);

  const trainerState = useMemo(
    () =>
      resolveTrainerStageState({
        slug: demo.slug,
        phase: training ? phase : undefined,
        stepNumber: training ? stepNumber : null,
        stepProgress: training ? stepProgress : 1,
        side: training ? side : "both",
        firstSide,
        breathMovement: training ? breathMovement : null,
        breathCue: training ? breathCue : null,
        training,
      }),
    [
      demo.slug,
      training,
      phase,
      stepNumber,
      stepProgress,
      side,
      firstSide,
      breathMovement,
      breathCue,
    ],
  );

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
        <>
          {canGL && trainerState ? (
            <div
              className="absolute inset-0"
              data-testid="pose-lesson-human-trainer"
              data-trainer-phase={phase ?? "preview"}
              data-trainer-step={trainerState.stepIndex}
              data-trainer-breath={trainerState.breathMode}
            >
              <Suspense fallback={null}>
                <HumanTrainerFigurine
                  sequence={trainerState.sequence}
                  stepIndex={trainerState.stepIndex}
                  stepProgress={trainerState.stepProgress}
                  playing={playing || !training}
                  side={trainerState.side}
                  motionEnabled={motionOn}
                  overridePose={trainerState.overridePose}
                  breathMode={trainerState.breathMode}
                  cameraView={cameraView}
                  data-testid={`pose-lesson-gl-${demo.slug}`}
                />
              </Suspense>
            </div>
          ) : null}
          <img
            src={demo.poster}
            alt={`${english} — still reference`}
            className={cn(
              "object-contain transition-all duration-300",
              canGL && trainerState
                ? cn(
                    " absolute right-2 z-10 h-16 w-12 rounded-lg border border-border/80 bg-background/95 p-0.5 shadow-sm",
                    caption ? "bottom-10" : "bottom-2",
                  )
                : "h-full w-full",
            )}
            width={600}
            height={1200}
            data-testid="pose-lesson-static-reference"
          />
        </>
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
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
          data-testid="pose-lesson-media-label"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{STATIC_REFERENCE_LABEL}</span>
        </p>
      ) : null}

      {/* Human trainer angle selector & live coaching badge */}
      {!hasMovement && canGL && trainerState ? (
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-background/90 p-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
          data-testid="pose-trainer-view-toggle"
          role="group"
          aria-label="Trainer camera angle"
        >
          <Eye className="ml-1.5 h-3 w-3 text-primary" aria-hidden />
          {(["auto", "front", "side"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setCameraView(view)}
              aria-pressed={cameraView === view}
              className={cn(
                "rounded-full px-1.5 py-0.5 capitalize transition-colors",
                cameraView === view
                  ? "bg-primary text-primary-foreground"
                  : "hover:text-foreground",
              )}
              data-testid={`pose-trainer-view-${view}`}
            >
              {view}
            </button>
          ))}
        </div>
      ) : null}

      {!hasMovement && canGL && trainerState ? (
        <div
          className={cn(
            "pointer-events-none absolute left-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm",
            caption ? "bottom-10" : "bottom-2",
          )}
          data-testid="pose-trainer-coach-badge"
        >
          <UserCheck className="h-3 w-3 text-primary" aria-hidden />
          <span>{trainerState.coachBadge}</span>
        </div>
      ) : null}
    </div>
  );
}
