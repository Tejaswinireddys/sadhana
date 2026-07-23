/**
 * Per-pose demonstration media.
 *
 * Convention (local static files — no invented CDN URLs):
 *   client/public/videos/poses/{slug}.webm
 *   client/public/videos/poses/{slug}.mp4
 *   client/public/captions/poses/{slug}.vtt
 * Poster falls back to the existing illustration: /poses/{slug}.png
 *
 * Video is only requested for slugs listed in POSE_VIDEOS_READY or that have
 * an entry in POSE_MEDIA_OVERRIDES — so missing files never spam 404s.
 *
 * Regenerate illustration-based clips with:
 *   npx tsx script/gen-pose-videos.ts
 *
 * See docs/pose-videos.md for capture guidelines.
 */

import { POSE_VIDEOS_READY_LIST } from "./poseVideosReady.generated";

export type PoseMediaSources = {
  /** Absolute or root-relative WebM URL */
  webm: string;
  /** Absolute or root-relative MP4 URL */
  mp4: string;
  /** Poster / still fallback (defaults to pose PNG) */
  poster: string;
  /** WebVTT captions when a real caption file exists (omit otherwise — avoids 404 tracks) */
  captions?: string;
};

export type PoseMediaOverride = Partial<PoseMediaSources>;

/**
 * Slugs with demo clips under public/videos/poses/.
 * Maintained by script/gen-pose-videos.ts (poseVideosReady.generated.ts).
 */
export const POSE_VIDEOS_READY = new Set<string>(POSE_VIDEOS_READY_LIST);

/**
 * Fill this map when you publish real clips somewhere other than the
 * convention paths. Keys are asana slugs. Having an override also enables video.
 *
 * Example:
 *   tadasana: {
 *     webm: "https://cdn.example.com/poses/tadasana.webm",
 *     mp4: "https://cdn.example.com/poses/tadasana.mp4",
 *     captions: "https://cdn.example.com/poses/tadasana.vtt",
 *   },
 */
export const POSE_MEDIA_OVERRIDES: Record<string, PoseMediaOverride> = {
  // Optional CDN / alternate URLs. Convention paths cover generated clips.
};

/** True when we should attempt to load a demo clip for this slug. */
export function poseHasVideo(slug: string): boolean {
  return POSE_VIDEOS_READY.has(slug) || slug in POSE_MEDIA_OVERRIDES;
}

/** Resolve media URLs for a pose. Always returns paths; UI handles missing files. */
export function poseMediaFor(slug: string): PoseMediaSources {
  const base = import.meta.env.BASE_URL;
  const override = POSE_MEDIA_OVERRIDES[slug] ?? {};
  return {
    webm: override.webm ?? `${base}videos/poses/${slug}.webm`,
    mp4: override.mp4 ?? `${base}videos/poses/${slug}.mp4`,
    poster: override.poster ?? `${base}poses/${slug}.png`,
    // Only attach a track when an override provides captions — convention VTTs are not shipped yet.
    ...(override.captions ? { captions: override.captions } : {}),
  };
}
