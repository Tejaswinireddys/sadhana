/**
 * PoseStageGL — chrome + lazy loader around the WebGL figurine.
 *
 * Keeps three.js out of the main bundle (dynamic import), and degrades to the
 * existing CSS PoseFigurine3D stage whenever WebGL is unavailable, the device
 * asks for reduced data, or the pose has no authored rig sequence.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PoseFigurine3D } from "@/components/PoseFigurine3D";
import { StepMotion, type StepMotionKey } from "@/components/StepMotion";
import { useMotionEnabled } from "@/components/motion";
import { POSE_KEYFRAMES } from "@/data/poseKeyframes";
import { resolvePosePhase, type FocusZone } from "@/lib/poseMoments";

const Figurine = lazy(() =>
  import("@/components/PoseFigurineGL").then((m) => ({ default: m.PoseFigurineGL })),
);

const PHASE_LABEL: Record<string, string> = {
  enter: "Enter",
  align: "Align",
  hold: "Hold",
  cue: "Cue",
};

export type PoseStageGLProps = {
  slug: string;
  english: string;
  poseKey: string;
  stepPoseKey?: string;
  focusZone?: FocusZone | null;
  stepMotion?: StepMotionKey | null;
  stepIndex?: number;
  /** 0–1 through the current narration step — drives limb interpolation. */
  stepProgress?: number;
  stepCount?: number;
  side?: 1 | 2;
  playing?: boolean;
  variant?: "detail" | "practice";
  posterSrc?: string;
  className?: string;
  "data-testid"?: string;
};

function webglAvailable(): boolean {
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

function saveDataOn(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conn?.saveData;
}

export function PoseStageGL(props: PoseStageGLProps) {
  const {
    slug,
    english,
    focusZone = null,
    stepMotion = null,
    stepIndex = 0,
    stepProgress = 1,
    stepCount = 1,
    side = 1,
    playing = false,
    variant = "detail",
    posterSrc,
    className,
    "data-testid": testId,
  } = props;

  const motionOn = useMotionEnabled();
  const sequence = POSE_KEYFRAMES[slug];
  const [canGL, setCanGL] = useState<boolean | null>(null);

  useEffect(() => {
    setCanGL(webglAvailable() && !saveDataOn());
  }, []);

  const phase = useMemo(
    () => resolvePosePhase(stepMotion, stepIndex, stepCount),
    [stepMotion, stepIndex, stepCount],
  );

  // No rig for this pose, or no WebGL — the CSS stage is still a good teacher.
  if (!sequence || canGL === false) {
    return <PoseFigurine3D {...props} />;
  }

  return (
    <div
      className={cn(
        "pose-3d-stage relative w-full max-w-full overflow-hidden",
        variant === "detail" && "pose-stage-frame rounded-2xl",
        variant === "practice" && "h-full min-h-[12rem]",
        className,
      )}
      data-testid={testId ?? `pose-stage-gl-${slug}`}
      data-phase={phase}
      data-step={stepIndex}
      data-render="webgl"
      aria-label={`3D demonstration of ${english}, ${PHASE_LABEL[phase] ?? phase} moment`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_45%_28%,hsl(var(--primary)/0.16),transparent_55%),linear-gradient(165deg,hsl(var(--accent)/0.55)_0%,hsl(var(--background)/0.2)_48%,hsl(var(--primary)/0.08)_100%)]"
        aria-hidden
      />

      {posterSrc ? (
        <img loading="lazy" width={1280} height={720}
          src={posterSrc}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.07] blur-[1px]"
        />
      ) : null}

      <div className="absolute inset-0">
        <Suspense fallback={null}>
          {canGL ? (
            <Figurine
              sequence={sequence}
              stepIndex={stepIndex}
              stepProgress={stepProgress}
              playing={playing}
              side={side}
              motionEnabled={motionOn}
              data-testid={`pose-gl-canvas-${slug}`}
            />
          ) : null}
        </Suspense>
      </div>

      {/* Teaching chrome — same language as the CSS stage. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-2.5 sm:p-3">
        <div className="min-w-0">
          {focusZone?.label ? (
            <span
              className="inline-block max-w-full truncate rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-primary shadow-soft backdrop-blur-sm"
              data-testid={`pose-3d-focus-label-${slug}`}
            >
              {focusZone.label}
            </span>
          ) : (
            <span className="inline-block rounded-full bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
              3D · {PHASE_LABEL[phase] ?? phase}
            </span>
          )}
        </div>
        {stepMotion ? (
          <span
            className="shrink-0 rounded-lg bg-background/80 p-1 text-foreground/80 shadow-soft backdrop-blur-sm"
            data-testid={`pose-3d-motion-${slug}`}
          >
            <StepMotion motion={stepMotion} size={variant === "practice" ? 52 : 44} />
          </span>
        ) : null}
      </div>

      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-background/75 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
        3D guide
      </span>
    </div>
  );
}
