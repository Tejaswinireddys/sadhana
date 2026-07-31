/**
 * PoseHumanStage — the illustrated HUMAN teaching figure.
 *
 * Shows the hand-composed illustration for the step being narrated and
 * crossfades to the next step's shape as the narration advances. Between shape
 * changes the whole figure carries a narration-driven "momentum" (ground, lift,
 * sway, rise …) so it reads like a live trainer moving through the pose rather
 * than a static picture. Uses only local illustrations — no 3D, no highlight.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { humanStepSlug } from "@/data/poseKeyImages";

export type PoseHumanStageProps = {
  slug: string;
  english: string;
  poseKey: string;
  /** Pose key of the step currently being narrated; selects the illustration. */
  stepPoseKey?: string | null;
  /** Whole-body momentum className for this step (see momentumClass). */
  momentum?: string;
  stepIndex?: number;
  /** Drives the motion (pass narration play/pause; true for idle preview). */
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
  momentum = "figure-momentum figure-momentum-breath",
  stepIndex = 0,
  playing = false,
  side = 1,
  variant = "detail",
  className,
  "data-testid": testId,
}: PoseHumanStageProps) {
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
      data-momentum={momentum}
      aria-label={`Trainer demonstration of ${english}`}
    >
      {/* The momentum wrapper carries the live-trainer body motion; the layers
          inside it only crossfade when the shape changes. */}
      <div className={cn("absolute inset-0", playing && momentum)}>
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

      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-background/75 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
        Trainer demo
      </span>
    </div>
  );
}
