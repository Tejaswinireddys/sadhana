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
import { useCallback, useState } from "react";
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
  thumb = false,
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
  /**
   * Small list/row rendering. Loads the pre-scaled asset when one exists and
   * skips the blur-up layer, which is pure cost at this size. Always eager:
   * a 48px thumbnail is never worth a lazy-load round trip, and `loading="lazy"`
   * was a major cause of thumbnails never painting at all.
   */
  thumb?: boolean;
  testId?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  // Pre-scaled thumbs are optional (see script/gen-pose-thumbs.ts). If one is
  // missing we fall back to the full-size asset rather than showing nothing.
  const [useFullSize, setUseFullSize] = useState(false);
  const asana = asanaBySlug(slug);
  const poseKey = asana?.pose ?? "mountain";
  const full = `${import.meta.env.BASE_URL}poses/${slug}.png`;
  const src = thumb && !useFullSize ? `${import.meta.env.BASE_URL}poses/thumbs/${slug}.png` : full;
  const eager = priority || thumb;

  /**
   * A cached image can finish decoding before React attaches `onLoad`, so the
   * event never fires and the node stays at `opacity: 0` — visible pixels,
   * invisible element — until an unrelated re-render (toggling the theme,
   * typing in a field) happens to repaint it. Checking `complete` on the ref
   * closes that race.
   */
  const attachImg = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const handleError = () => {
    if (thumb && !useFullSize) {
      setUseFullSize(true);
      return;
    }
    setErrored(true);
  };

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-accent/30", rounded, aspect, className)}
      data-testid={testId ?? `pose-image-${slug}`}
    >
      {!loaded && !errored && (
        <>
          <Skeleton className={cn("absolute inset-0 h-full w-full", rounded)} />
          {/* LQIP-style blur layer from the same asset at tiny intrinsic size.
              Skipped for thumbs — a blur pass costs more than it buys at 64px. */}
          {!thumb && (
            <img
              src={src}
              alt=""
              aria-hidden
              width={600}
              height={1200}
              className={cn(
                "pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl",
                rounded,
              )}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
            />
          )}
        </>
      )}
      {!errored && (
        <img
          ref={attachImg}
          key={src}
          src={src}
          alt={alt}
          width={thumb ? 96 : 600}
          height={thumb ? 192 : 1200}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          decoding={eager ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={cn(
            "relative z-[1] block select-none transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain",
            // A full-body figure shrunk to a row thumbnail is a few faint
            // pixels. Scaling up inside the clip keeps it legible.
            thumb ? "scale-[1.35]" : "",
            rounded,
            aspect ? "h-full w-full" : "w-full",
            shadow ? "shadow-soft-lg" : "",
            loaded ? "opacity-100" : "opacity-0",
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
