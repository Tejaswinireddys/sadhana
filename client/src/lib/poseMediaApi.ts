/**
 * Fetch the server media manifest for a pose.
 * Prefer this over guessing `/videos/...` or `/voice/...` paths.
 */
import { useQuery } from "@tanstack/react-query";
import type { PoseMediaSources } from "@/data/poseMedia";
import { poseHasVideo, poseMediaFor, poseNarrationSrc } from "@/data/poseMedia";
import type { NarrationCue } from "@/lib/narrationCues";

export type MediaCue = NarrationCue | { start: number; end: number; text?: string };

export type PoseMediaManifest = {
  video: { hls: string | null; mp4: string; poster: string } | null;
  audio: {
    url: string;
    source?: "human" | "neural";
    cues: MediaCue[] | null;
  } | null;
};

const cache = new Map<string, PoseMediaManifest>();

export async function fetchPoseMedia(slug: string): Promise<PoseMediaManifest> {
  if (cache.has(slug)) return cache.get(slug)!;
  const res = await fetch(`/api/poses/${encodeURIComponent(slug)}/media`, {
    credentials: "include",
  });
  if (!res.ok) {
    const fallback = conventionFallback(slug);
    cache.set(slug, fallback);
    return fallback;
  }
  const data = (await res.json()) as PoseMediaManifest;
  cache.set(slug, data);
  return data;
}

/** Drop a cached manifest entry after TTS generation. */
export function invalidatePoseMedia(slug: string) {
  cache.delete(slug);
}

/** Map API video → PoseDemoStage sources (adds webm sibling when mp4 is local). */
export function manifestToVideoSources(
  slug: string,
  manifest: PoseMediaManifest | undefined,
): PoseMediaSources | null {
  if (manifest?.video) {
    const mp4 = manifest.video.mp4;
    const webm = mp4.endsWith(".mp4") ? mp4.replace(/\.mp4$/i, ".webm") : mp4;
    return {
      mp4,
      webm,
      poster: manifest.video.poster,
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
      ? { hls: null, mp4: media.mp4, poster: media.poster }
      : null,
    audio: {
      url: `/audio/pose-${slug}.mp3`,
      source: "neural",
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
