// PoseImage — renders an illustrated pose photo (/poses/<slug>.png).
// Used as the asana detail hero AND, since v3.4, as the consistent illustrated
// thumbnail/hero everywhere (library cards, pathway cards/heroes, warm-up).
// Features:
//   - soft css fade-in once loaded
//   - a very subtle 4s "breath" scale animation (respects prefers-reduced-motion
//     and the html.motion-off toggle via the .photo-breath class)
//   - soft drop shadow, rounded corners, full-width responsive
//   - skeleton placeholder while loading
//   - PoseSvg fallback when the PNG is missing (no more "Illustration unavailable")
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
  testId,
}: {
  slug: string;
  alt: string;
  className?: string;
  breath?: boolean;
  /** Tailwind rounding class applied to the wrapper + image. */
  rounded?: string;
  /** Tailwind aspect class (e.g. "aspect-square", "aspect-[4/3]"). When set,
   *  the image fills the box with object-cover. */
  aspect?: string;
  shadow?: boolean;
  testId?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const asana = asanaBySlug(slug);
  const poseKey = asana?.pose ?? "mountain";

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-accent/30", rounded, aspect, className)}
      data-testid={testId ?? `pose-image-${slug}`}
    >
      {!loaded && !errored && <Skeleton className={cn("h-full w-full", aspect ?? "aspect-square", rounded)} />}
      {!errored && (
        <img
          src={`${import.meta.env.BASE_URL}poses/${slug}.png`}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "block select-none object-cover transition-opacity",
            rounded,
            aspect ? "h-full w-full" : "w-full",
            shadow ? "shadow-soft-lg" : "",
            loaded ? "photo-fade-in" : "absolute inset-0 h-full w-full opacity-0",
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
