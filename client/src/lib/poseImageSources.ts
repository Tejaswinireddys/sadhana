/**
 * Pose image URL selection — keep thumb requests honest.
 * Pre-scaled /poses/thumbs/<slug> assets are optional; only request ones the
 * generator listed in poseThumbsReady.generated.ts.
 */
import { POSE_THUMBS_READY_LIST } from "../data/poseThumbsReady.generated.ts";

const POSE_THUMBS_READY = new Set(POSE_THUMBS_READY_LIST);

export function resolvePoseImageSources(
  slug: string,
  opts: { thumb?: boolean; baseUrl?: string } = {},
): { src: string; webpSrc: string; usesThumb: boolean } {
  const base = opts.baseUrl ?? "/";
  const fullPng = `${base}poses/${slug}.png`;
  const fullWebp = `${base}poses/${slug}.webp`;
  const usesThumb = Boolean(opts.thumb && POSE_THUMBS_READY.has(slug));
  if (!usesThumb) {
    return { src: fullPng, webpSrc: fullWebp, usesThumb: false };
  }
  return {
    src: `${base}poses/thumbs/${slug}.png`,
    webpSrc: `${base}poses/thumbs/${slug}.webp`,
    usesThumb: true,
  };
}
