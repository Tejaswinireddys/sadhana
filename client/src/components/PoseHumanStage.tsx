/**
 * PoseHumanStage — narration-synced HUMAN teaching figure.
 *
 * Shows the hand-composed human illustration for the step currently being
 * spoken and crossfades to the next step's illustration as the narration
 * advances, so the same character visibly moves through the shape. A gentle
 * breathing zoom keeps it alive, and a focus halo highlights the cued body
 * region. Uses only the local pose illustrations — no 3D, no external assets.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotionEnabled } from "@/components/motion";
import type { FocusZone } from "@/lib/poseMoments";
import { humanStepSlug } from "@/data/poseKeyImages";

export type PoseHumanStageProps = {
  slug: string;
  english: string;
  poseKey: string;
  /** Pose key of the step currently being narrated; selects the illustration. */
  stepPoseKey?: string | null;
  focusZone?: FocusZone | null;
  stepIndex?: number;
  /** Drives the breathing zoom (pass narration play/pause; true for idle preview). */
  playing?: boolean;
  /** Laterality for "each side" poses — mirrors the figure on side 2. */
  side?: 1 | 2;
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
  focusZone = null,
  stepIndex = 0,
  playing = false,
  side = 1,
  variant = "detail",
  className,
  "data-testid": testId,
}: PoseHumanStageProps) {
  const motionOn = useMotionEnabled();
  const targetSlug = humanStepSlug(slug, poseKey, stepPoseKey);

  // Keep at most two layers so a slug change can crossfade old → new.
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

  const fx = focusZone?.cx ?? 0.5;
  const fy = Math.min(0.85, Math.max(0.15, focusZone?.cy ?? 0.5));
  const fr = focusZone?.r ?? 0.22;

  // Ease toward the cued region while playing — a soft "look here" push-in.
  const kbStyle =
    motionOn && playing
      ? {
          transform: "scale(1.08)",
          transformOrigin: `${fx * 100}% ${fy * 100}%`,
          transition: "transform 1200ms ease, transform-origin 700ms ease",
        }
      : { transform: "scale(1)", transition: "transform 1200ms ease" };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-accent/20",
        variant === "detail" && "aspect-[4/5] rounded-2xl",
        variant === "practice" && "flex h-full w-full items-center justify-center",
        className,
      )}
      data-testid={testId ?? `pose-human-stage-${slug}`}
      data-human-slug={targetSlug}
      data-step={stepIndex}
      aria-label={`Illustrated demonstration of ${english}`}
    >
      <div className="absolute inset-0" style={kbStyle}>
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
                // A mapped transition image is missing — fall back to the pose's
                // own illustration rather than showing a broken frame.
                const el = e.currentTarget as HTMLImageElement;
                if (layer.slug !== slug) el.src = imgUrl(slug);
              }}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-out",
                isTop ? "opacity-100" : "opacity-0",
                motionOn && playing && "photo-breath-demo",
              )}
              style={{ transform: side === 2 ? "scaleX(-1)" : undefined }}
            />
          );
        })}
      </div>

      {focusZone && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <span
            className={cn(
              "absolute rounded-full bg-primary/15 ring-2 ring-primary/70",
              motionOn && "pose-3d-halo-breath",
            )}
            style={{
              left: `${fx * 100}%`,
              top: `${fy * 100}%`,
              width: `${fr * 170}%`,
              height: `${fr * 140}%`,
              transform: "translate(-50%, -50%)",
              transition:
                "left 400ms ease, top 400ms ease, width 400ms ease, height 400ms ease",
            }}
          />
        </div>
      )}

      {focusZone?.label && (
        <span
          className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-primary shadow-soft backdrop-blur-sm"
          data-testid={`human-focus-label-${slug}`}
        >
          {focusZone.label}
        </span>
      )}

      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-background/75 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
        Illustrated guide
      </span>
    </div>
  );
}
