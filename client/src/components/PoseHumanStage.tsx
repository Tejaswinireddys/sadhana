/**
 * PoseHumanStage — clear HUMAN teaching figure (not a bobbing Ken Burns clip).
 *
 * Idle: still, full-body illustration so the shape is obvious.
 * Training: crossfade entry → peak when the pose has a shape journey; otherwise
 * keep the figure steady and move a focus halo to the body region being cued.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { humanStepSlug } from "@/data/poseKeyImages";
import type { FocusZone } from "@/lib/poseMoments";

export type PoseHumanStageProps = {
  slug: string;
  english: string;
  poseKey: string;
  /** Pose key of the step currently being narrated; selects the illustration. */
  stepPoseKey?: string | null;
  /** Whole-body momentum className — omit/empty for a still training figure. */
  momentum?: string;
  stepIndex?: number;
  /** Drives motion only when momentum is set (idle preview stays still). */
  playing?: boolean;
  /** Laterality for "each side" poses — mirrors the figure on side 2. */
  side?: 1 | 2;
  /** Body region for the current cue — halo + label on the figure. */
  focusZone?: FocusZone | null;
  /** Spoken cue shown as a caption under the figure (training clarity). */
  caption?: string | null;
  variant?: "detail" | "practice";
  className?: string;
  "data-testid"?: string;
};

const BASE = import.meta.env.BASE_URL;
const imgUrl = (slug: string) => `${BASE}poses/${slug}.png`;

export function PoseHumanStage({
  slug,
  english,
  poseKey,
  stepPoseKey,
  momentum = "",
  stepIndex = 0,
  playing = false,
  side = 1,
  focusZone = null,
  caption = null,
  variant = "detail",
  className,
  "data-testid": testId,
}: PoseHumanStageProps) {
  const targetSlug = humanStepSlug(slug, poseKey, stepPoseKey);

  const [layers, setLayers] = useState<{ slug: string; id: number }[]>([
    { slug: targetSlug, id: 0 },
  ]);
  const idRef = useRef(0);
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.slug === targetSlug) return prev;
      idRef.current += 1;
      return [...prev, { slug: targetSlug, id: idRef.current }].slice(-2);
    });
  }, [targetSlug]);

  const moveFigure = playing && !!momentum;

  return (
    <div
      className={cn(
        "relative w-full max-w-full overflow-hidden bg-accent/20",
        variant === "detail" && "pose-stage-frame rounded-2xl",
        variant === "practice" && "flex h-full w-full items-center justify-center",
        className,
      )}
      data-testid={testId ?? `pose-human-stage-${slug}`}
      data-human-slug={targetSlug}
      data-step={stepIndex}
      data-momentum={momentum || "still"}
      data-media="illustrated"
      aria-label={`Trainer demonstration of ${english}`}
    >
      <div className={cn("absolute inset-0", moveFigure && momentum)}>
        {layers.map((layer, i) => {
          const isTop = i === layers.length - 1;
          return (
            <img
              key={layer.id}
              src={imgUrl(layer.slug)}
              alt=""
              aria-hidden
              draggable={false}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (layer.slug !== slug) el.src = imgUrl(slug);
              }}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-out",
                isTop ? "opacity-100" : "opacity-0",
              )}
              style={{ transform: side === 2 ? "scaleX(-1)" : undefined }}
            />
          );
        })}
      </div>

      {focusZone && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
          data-testid={`pose-human-focus-${slug}`}
        >
          <circle
            className="focus-halo-breath"
            cx={focusZone.cx * 100}
            cy={Math.min(80, Math.max(12, focusZone.cy * 100))}
            r={focusZone.r * 55}
            fill="hsl(var(--primary))"
            fillOpacity={0.16}
            style={{ transition: "cx 350ms ease, cy 350ms ease, r 350ms ease" }}
          />
          <circle
            cx={focusZone.cx * 100}
            cy={Math.min(80, Math.max(12, focusZone.cy * 100))}
            r={focusZone.r * 55}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={1.2}
            strokeOpacity={0.9}
            style={{ transition: "cx 350ms ease, cy 350ms ease, r 350ms ease" }}
          />
        </svg>
      )}

      {focusZone?.label && (
        <span
          className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary shadow-soft backdrop-blur-sm"
          data-testid={`pose-human-focus-label-${slug}`}
        >
          {focusZone.label}
        </span>
      )}

      {caption ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pb-3 pt-10"
          data-testid={`pose-human-caption-${slug}`}
        >
          <p className="text-center text-xs font-medium leading-snug text-white sm:text-sm">
            {caption}
          </p>
        </div>
      ) : (
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-background/75 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
          How to hold it
        </span>
      )}
    </div>
  );
}
