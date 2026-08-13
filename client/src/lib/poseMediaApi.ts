/**
 * Fetch the server media manifest for a pose.
 * Prefer this over guessing `/videos/...` or `/voice/...` paths.
 */
import { useQuery } from "@tanstack/react-query";
import type { PoseMediaSources } from "@/data/poseMedia";
import { poseHasVideo, poseMediaFor, poseNarrationSrc } from "@/data/poseMedia";

export type MediaCue = { start: number; end: number; text?: string };

export type PoseMediaManifest = {
  video: {
    hls: string | null;
    mp4: string;
    webm?: string | null;
    poster: string;
    captions?: string | null;
  } | null;
  audio: { url: string; cues: MediaCue[] | null } | null;
};

const cache = new Map<string, PoseMediaManifest>();

export async function fetchPoseMedia(slug: string): Promise<PoseMediaManifest> {
  if (cache.has(slug)) return cache.get(slug)!;
  const res = await fetch(`/api/poses/${encodeURIComponent(slug)}/media`, {
    credentials: "include",
  });
  if (!res.ok) {
    // Fall back to local convention so offline / older deploys still work.
    const fallback = conventionFallback(slug);
    cache.set(slug, fallback);
    return fallback;
  }
  const data = (await res.json()) as PoseMediaManifest;
  cache.set(slug, data);
  return data;
}

/** Map API video → PoseDemoStage sources (adds webm sibling when mp4 is local). */
export function manifestToVideoSources(
  slug: string,
  manifest: PoseMediaManifest | undefined,
): PoseMediaSources | null {
  if (manifest?.video) {
    const mp4 = manifest.video.mp4;
    const webm =
      manifest.video.webm ||
      (mp4.endsWith(".mp4") ? mp4.replace(/\.mp4$/i, ".webm") : mp4);
    const convention = poseHasVideo(slug) ? poseMediaFor(slug) : null;
    return {
      mp4,
      webm,
      poster: manifest.video.poster,
      ...(manifest.video.captions || convention?.captions
        ? { captions: manifest.video.captions ?? convention?.captions }
        : {}),
    };
  }
  if (poseHasVideo(slug)) return poseMediaFor(slug);
  return null;
}

/**
 * Resolve narration URL from the manifest.
 * - While the query is still loading (`undefined`), use the convention path so
 *   players can start prefetching without waiting a round-trip.
 * - Once loaded, trust the server: missing audio → empty string (no 404 spam).
 */
export function manifestAudioUrl(
  slug: string,
  manifest: PoseMediaManifest | undefined,
): string {
  if (manifest?.audio?.url) return manifest.audio.url;
  if (manifest === undefined) return poseNarrationSrc(slug);
  return "";
}

function conventionFallback(slug: string): PoseMediaManifest {
  const hasVideo = poseHasVideo(slug);
  const media = hasVideo ? poseMediaFor(slug) : null;
  return {
    video: media
      ? {
          hls: null,
          mp4: media.mp4,
          webm: media.webm,
          poster: media.poster,
          captions: media.captions ?? null,
        }
      : null,
    audio: {
      url: `/audio/pose-${slug}.mp3`,
      cues: null,
    },
  };
}

export function usePoseMedia(slug: string | undefined) {
  return useQuery({
    queryKey: ["/api/poses", slug, "media"],
    queryFn: () => fetchPoseMedia(slug!),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}
