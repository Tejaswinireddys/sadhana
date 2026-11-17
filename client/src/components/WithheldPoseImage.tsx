/**
 * Stands in for a pose illustration that contradicts its own instructions
 * (see `data/poseImageAccuracy.ts`). Describes the shape as the steps teach
 * it rather than showing a picture of a different one — and never invents a
 * replacement photo.
 */
import { asanaBySlug } from "@/data/content";
import { poseImageMismatch, withheldImageLabel } from "@/data/poseImageAccuracy";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

export function WithheldPoseImage({
  slug,
  compact = false,
  className,
}: {
  slug: string;
  /** Thumbnail size: icon only, the description lives in the accessible label. */
  compact?: boolean;
  className?: string;
}) {
  const english = asanaBySlug(slug)?.english ?? slug;
  const m = poseImageMismatch(slug);
  const label = withheldImageLabel(slug, english);
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden text-center",
        "bg-gradient-to-br from-secondary/25 via-accent/35 to-muted/50 text-muted-foreground",
        compact ? "gap-0 p-1" : "gap-1.5 p-3 sm:p-4",
        className,
      )}
      data-testid={`pose-image-withheld-${slug}`}
    >
      <ImageOff className={cn("shrink-0 opacity-80", compact ? "h-4 w-4" : "h-6 w-6")} aria-hidden />
      {!compact && (
        <div className="min-w-0 max-w-full space-y-1 overflow-hidden px-1">
          <span className="block truncate text-xs font-medium text-foreground">
            No illustration yet
          </span>
          <span className="block truncate text-[0.7rem] font-medium text-foreground/75">
            {english}
          </span>
          {m && (
            <span className="block text-xs leading-snug text-muted-foreground line-clamp-3">
              Steps ask for: {m.instructed}.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
