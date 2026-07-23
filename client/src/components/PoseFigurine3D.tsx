/**
 * PoseFigurine3D — procedural CSS-perspective teaching stage.
 *
 * Shows the correct pose silhouette (PoseSvg) on a 3D mat with camera angles
 * and focus highlights driven by narration steps — not a flat Ken Burns zoom.
 * No Three.js / external 3D CDNs; respects reduced-motion.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PoseSvg } from "@/components/PoseSvg";
import { StepMotion, type StepMotionKey } from "@/components/StepMotion";
import { buildPoseMoment, type FocusZone } from "@/lib/poseMoments";
import { useMotionEnabled } from "@/components/motion";

export type PoseFigurine3DProps = {
  slug: string;
  english: string;
  poseKey: string;
  /** Active step pose key when the narration advances through shapes. */
  stepPoseKey?: string;
  focusZone?: FocusZone | null;
  stepMotion?: StepMotionKey | null;
  stepIndex?: number;
  stepCount?: number;
  side?: 1 | 2;
  playing?: boolean;
  className?: string;
  variant?: "detail" | "practice";
  /** Soft reference PNG behind the figurine (recognition, not the primary motion). */
  posterSrc?: string;
  "data-testid"?: string;
};

const PHASE_LABEL: Record<string, string> = {
  enter: "Enter",
  align: "Align",
  hold: "Hold",
  cue: "Cue",
};

export function PoseFigurine3D({
  slug,
  english,
  poseKey,
  stepPoseKey,
  focusZone = null,
  stepMotion = null,
  stepIndex = 0,
  stepCount = 1,
  side = 1,
  playing = false,
  className,
  variant = "detail",
  posterSrc,
  "data-testid": testId,
}: PoseFigurine3DProps) {
  const motionOn = useMotionEnabled();
  const activePose = stepPoseKey || poseKey;

  const moment = useMemo(
    () =>
      buildPoseMoment({
        poseKey: activePose,
        focusZone,
        stepMotion,
        stepIndex,
        stepCount,
        side,
      }),
    [activePose, focusZone, stepMotion, stepIndex, stepCount, side],
  );

  const { camera, phase } = moment;
  const mirror = side === 2;
  const fx = focusZone?.cx ?? 0.5;
  const fy = Math.min(0.82, Math.max(0.14, focusZone?.cy ?? 0.45));
  const fr = focusZone?.r ?? 0.22;

  const camStyle = motionOn
    ? {
        transform: `translateY(${camera.translateY}%) scale(${camera.scale}) rotateX(${camera.rotateX}deg) rotateY(${camera.rotateY}deg) rotateZ(${camera.rotateZ}deg)`,
      }
    : { transform: "translateY(0) scale(1) rotateX(4deg) rotateY(-6deg)" };

  return (
    <div
      className={cn(
        "pose-3d-stage relative w-full overflow-hidden",
        variant === "detail" && "aspect-[4/5] rounded-2xl",
        variant === "practice" && "h-full min-h-[12rem]",
        className,
      )}
      data-testid={testId ?? `pose-figurine-3d-${slug}`}
      data-phase={phase}
      data-pose={activePose}
      aria-label={`3D demonstration of ${english}, ${PHASE_LABEL[phase] ?? phase} moment`}
    >
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_45%_28%,hsl(var(--primary)/0.16),transparent_55%),linear-gradient(165deg,hsl(var(--accent)/0.55)_0%,hsl(var(--background)/0.2)_48%,hsl(var(--primary)/0.08)_100%)]"
        aria-hidden
      />

      {/* Soft PNG reference — recognition only */}
      {posterSrc ? (
        <img
          src={posterSrc}
          alt=""
          aria-hidden
          draggable={false}
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-contain opacity-[0.14] blur-[0.5px]",
            variant === "detail" && "object-cover opacity-[0.1]",
          )}
        />
      ) : null}

      {/* Perspective stage */}
      <div className="pose-3d-perspective absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "pose-3d-camera relative flex h-[88%] w-[78%] max-w-[22rem] flex-col items-center justify-end",
            motionOn && playing && "pose-3d-camera-live",
          )}
          style={camStyle}
        >
          {/* Mat plane */}
          <div className="pose-3d-mat absolute bottom-[6%] left-[4%] right-[4%] h-[18%]" aria-hidden>
            <div className="pose-3d-mat-disc absolute inset-0 rounded-[50%] bg-primary/25 blur-[1px]" />
            <div className="absolute inset-[12%_10%] rounded-[50%] border border-primary/30 bg-card/40 shadow-[0_8px_28px_hsl(var(--primary)/0.18)]" />
          </div>

          {/* Figure + depth ghost */}
          <div
            className={cn(
              "pose-3d-figure relative z-[2] mb-[14%] text-foreground",
              motionOn && (playing ? "pose-3d-figure-breath" : "pose-3d-figure-idle"),
            )}
            key={`${activePose}-${side}`}
          >
            <div className={cn("relative", mirror && "pose-3d-mirror")}>
              {/* Depth shadow layer */}
              <div
                className="pointer-events-none absolute inset-0 translate-x-[3px] translate-y-[4px] text-primary/25 blur-[1.5px]"
                aria-hidden
              >
                <PoseSvg pose={activePose} size={variant === "practice" ? 220 : 200} />
              </div>
              <div className="relative text-foreground drop-shadow-[0_10px_18px_hsl(var(--primary)/0.22)]">
                <PoseSvg pose={activePose} size={variant === "practice" ? 220 : 200} />
              </div>

              {/* Focus halo in figure space (normalized 0–1 → % of figure box) */}
              {focusZone && (
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden
                  data-testid={`pose-3d-focus-${slug}`}
                >
                  <span
                    className={cn(
                      "absolute rounded-full bg-primary/25 ring-2 ring-primary/70",
                      motionOn && "pose-3d-halo-breath",
                    )}
                    style={{
                      left: `${fx * 100}%`,
                      top: `${fy * 100}%`,
                      width: `${fr * 200}%`,
                      height: `${fr * 160}%`,
                      transform: "translate(-50%, -50%)",
                      transition: "left 320ms ease, top 320ms ease, width 320ms ease, height 320ms ease",
                    }}
                  />
                  <span
                    className={cn(
                      "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-soft",
                      motionOn && "focus-dot-pulse",
                    )}
                    style={{
                      left: `${fx * 100}%`,
                      top: `${fy * 100}%`,
                      transition: "left 320ms ease, top 320ms ease",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Teaching chrome */}
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
