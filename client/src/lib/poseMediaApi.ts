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
    mp4: string | null;
    poster: string;
    playbackId?: string | null;
    provider?: string | null;
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
    const fallback = conventionFallback(slug);
    cache.set(slug, fallback);
    return fallback;
  }
  const data = (await res.json()) as PoseMediaManifest;
  cache.set(slug, data);
  return data;
}

export function invalidatePoseMedia(slug: string) {
  cache.delete(slug);
}

/** Map API video → player sources (HLS preferred, then progressive). */
export function manifestToVideoSources(
  slug: string,
  manifest: PoseMediaManifest | undefined,
): PoseMediaSources | null {
  if (manifest?.video) {
    const mp4 = manifest.video.mp4;
    const hls = manifest.video.hls;
    if (!hls && !mp4) return poseHasVideo(slug) ? poseMediaFor(slug) : null;
    const webm =
      mp4 && mp4.startsWith("/") && mp4.endsWith(".mp4")
        ? mp4.replace(/\.mp4$/i, ".webm")
        : undefined;
    return {
      hls,
      mp4,
      webm,
      poster: manifest.video.poster || `/poses/${slug}.png`,
      playbackId: manifest.video.playbackId ?? null,
      provider: manifest.video.provider ?? null,
    };
  }
  if (poseHasVideo(slug)) return poseMediaFor(slug);
  return null;
}

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
          hls: media.hls ?? null,
          mp4: media.mp4 ?? null,
          poster: media.poster,
          playbackId: null,
          provider: "local",
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
