/**
 * PoseImage — illustrated pose photo (/poses/<slug>.png).
 * Lazy decode, soft fade-in, optional breath scale, skeleton + SVG fallback.
 * Blur-up uses a tiny same-asset preview (no separate WebP set required).
 *
 * Fit: every pose source is authored at 600x1200 (1:2, full standing figure).
 * `object-cover` in any wider container clips the top and bottom of the frame —
 * which on a pose illustration is the head and the feet, i.e. the part that
 * teaches the pose. Default to `contain` so the figure is never cut; the
 * container's background wash fills the remaining side space.
 */
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PoseSvg } from "@/components/PoseSvg";
import { asanaBySlug } from "@/data/content";
import { cn } from "@/lib/utils";

export function PoseImage({
  slug,
  alt,
  className,
  breath = true,
  rounded = "rounded-2xl",
  aspect,
  shadow = true,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
  fit = "contain",
  testId,
}: {
  slug: string;
  alt: string;
  className?: string;
  breath?: boolean;
  rounded?: string;
  aspect?: string;
  shadow?: boolean;
  /** Hint for responsive layout; single PNG source until WebP variants exist. */
  sizes?: string;
  /** Eager load for LCP heroes */
  priority?: boolean;
  /** `contain` (default) never clips the figure; `cover` only for decorative crops. */
  fit?: "contain" | "cover";
  testId?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const asana = asanaBySlug(slug);
  const poseKey = asana?.pose ?? "mountain";
  const src = `${import.meta.env.BASE_URL}poses/${slug}.png`;

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-accent/30", rounded, aspect, className)}
      data-testid={testId ?? `pose-image-${slug}`}
    >
      {!loaded && !errored && (
        <>
          <Skeleton className={cn("absolute inset-0 h-full w-full", rounded)} />
          {/* LQIP-style blur layer from the same asset at tiny intrinsic size */}
          <img
            src={src}
            alt=""
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl",
              rounded,
            )}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        </>
      )}
      {!errored && (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "relative z-[1] block select-none transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain",
            rounded,
            aspect ? "h-full w-full" : "w-full",
            shadow ? "shadow-soft-lg" : "",
            loaded ? "photo-fade-in opacity-100" : "opacity-0",
            loaded && breath ? "photo-breath" : "",
          )}
          draggable={false}
        />
      )}
      {errored && (
        <div
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 bg-accent/40 text-primary",
            rounded,
            aspect ?? "aspect-square",
          )}
          data-testid={`pose-image-fallback-${slug}`}
          role="img"
          aria-label={alt}
        >
          <PoseSvg pose={poseKey} size={96} className="opacity-80" />
          <span className="px-3 text-center text-xs text-muted-foreground">Line illustration</span>
        </div>
      )}
    </div>
  );
}
