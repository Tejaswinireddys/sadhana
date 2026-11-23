import { poseImageMismatch, accurateImageAlt } from "@/data/poseImageAccuracy";
import { resolvePoseImageSources } from "@/lib/poseImageSources";
import { fetchPriority } from "@/lib/fetchPriority";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import { cn } from "@/lib/utils";

type MarketingPoseImageProps = {
  slug: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  thumb?: boolean;
  aspect?: string;
  sizes?: string;
  rounded?: string;
  /** Accepted for PoseImage call-site compatibility; marketing stills are static. */
  breath?: boolean;
  shadow?: boolean;
};

/**
 * Lightweight pose still for public marketing pages (`/welcome`).
 *
 * Avoids the catalog / SVG stack that `PoseImage` pulls in. Withheld poses
 * (wrong illustration vs steps) render the shared placeholder — never the
 * long `instructed` string as visible body text inside a 40×40 thumb, which
 * used to spill across the featured-session preview rows.
 */
export function MarketingPoseImage({
  slug,
  alt,
  className,
  priority,
  thumb,
  aspect,
  sizes,
  rounded,
}: MarketingPoseImageProps) {
  const mismatch = poseImageMismatch(slug);
  const aspectClass = aspect ?? "aspect-[1/2]";
  const radius = rounded ?? (thumb ? "rounded-lg" : "rounded-2xl");
  const shell = cn(
    "relative block w-full overflow-hidden bg-background",
    aspectClass,
    radius,
    className,
  );

  if (mismatch) {
    return (
      <div className={shell} data-testid={`marketing-pose-withheld-${slug}`}>
        <WithheldPoseImage slug={slug} compact={Boolean(thumb)} className={cn("h-full w-full", radius)} />
      </div>
    );
  }

  const sources = resolvePoseImageSources(slug, {
    thumb,
    baseUrl: import.meta.env.BASE_URL,
  });
  const w = sources.usesThumb ? 160 : 600;
  const h = sources.usesThumb ? 160 : 1200;

  return (
    <picture className={shell} data-testid={`marketing-pose-${slug}`}>
      <source srcSet={sources.webpSrc} type="image/webp" />
      <img
        src={sources.src}
        alt={accurateImageAlt(slug, alt || "Pose illustration")}
        width={w}
        height={h}
        loading={priority || thumb ? "eager" : "lazy"}
        decoding={priority || thumb ? "sync" : "async"}
        {...fetchPriority(priority ? "high" : "auto")}
        sizes={sizes}
        className="photo-fade-in h-full w-full object-contain motion-reduce:animate-none"
        draggable={false}
      />
    </picture>
  );
}
