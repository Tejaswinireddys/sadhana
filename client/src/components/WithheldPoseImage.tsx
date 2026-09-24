/**
 * Stands in for a pose illustration that contradicts its own instructions
 * (see `data/poseImageAccuracy.ts`). Describes the shape as the steps teach
 * it rather than showing a picture of a different one.
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
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-accent/40 text-center text-muted-foreground",
        compact ? "p-1" : "p-4",
        className,
      )}
      data-testid={`pose-image-withheld-${slug}`}
    >
      <ImageOff className={compact ? "h-4 w-4" : "h-6 w-6"} aria-hidden />
      {!compact && (
        <>
          <span className="text-xs font-medium text-foreground">No illustration yet</span>
          {m && <span className="max-w-[16rem] text-xs leading-snug">{m.instructed}.</span>}
        </>
      )}
    </div>
  );
}
