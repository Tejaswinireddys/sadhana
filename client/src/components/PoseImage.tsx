// PoseImage — renders an illustrated pose photo (/poses/<slug>.png) as the
// primary hero on the asana detail page. Features:
//   - soft css fade-in once loaded
//   - a very subtle 4s "breath" scale animation (respects prefers-reduced-motion
//     and the html.motion-off toggle via the .photo-breath class)
//   - soft drop shadow, rounded-2xl corners, full-width responsive
//   - skeleton placeholder while loading
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PoseImage({
  slug,
  alt,
  className,
  breath = true,
  testId,
}: {
  slug: string;
  alt: string;
  className?: string;
  breath?: boolean;
  testId?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl bg-accent/30", className)}
      data-testid={testId ?? `pose-image-${slug}`}
    >
      {!loaded && !errored && <Skeleton className="aspect-square w-full rounded-2xl" />}
      {!errored && (
        <img
          src={`${import.meta.env.BASE_URL}poses/${slug}.png`}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "block w-full select-none rounded-2xl object-cover shadow-soft-lg transition-opacity",
            loaded ? "photo-fade-in" : "absolute inset-0 opacity-0",
            loaded && breath ? "photo-breath" : "",
          )}
          draggable={false}
        />
      )}
      {errored && (
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-accent/40 text-sm text-muted-foreground">
          Illustration unavailable
        </div>
      )}
    </div>
  );
}
