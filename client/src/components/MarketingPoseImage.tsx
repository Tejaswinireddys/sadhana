import type { ComponentProps } from "react";
import type { PoseImage } from "./PoseImage";
import { poseImageMismatch, accurateImageAlt } from "@/data/poseImageAccuracy";
import { resolvePoseImageSources } from "@/lib/poseImageSources";
/** Marketing never needs the pose catalog or the SVG rendering engine. */
export function MarketingPoseImage({ slug, alt, className, priority, thumb, aspect, sizes }: ComponentProps<typeof PoseImage>) {
  const mismatch = poseImageMismatch(slug);
  if (mismatch) return <div className={className} role="img" aria-label={mismatch.instructed}>{mismatch.instructed}</div>;
  const sources = resolvePoseImageSources(slug, { thumb });
  return <picture className={`block ${aspect ?? "aspect-[1/2]"} ${className ?? ""}`}>
    <source srcSet={sources.webpSrc} type="image/webp" />
    <img src={sources.src} alt={accurateImageAlt(slug, alt || "Pose illustration")}
      width={600} height={1200} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
      sizes={sizes} className="h-full w-full object-contain" />
  </picture>;
}
