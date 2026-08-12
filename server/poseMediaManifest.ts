/**
 * Build the GET /api/poses/:slug/media payload.
 *
 * Video priority:
 *   1. Adaptive stream (playback ID in pose_media + STREAM_PROVIDER URLs)
 *   2. Local progressive files under client/public/videos/poses/
 *
 * Never invents CDN URLs without a stored playback ID + configured provider.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStreamPlaybackUrls, streamProvider, type StreamProvider } from "./streamConfig";
import { getPosePlayback } from "./poseStreamStore";

export type MediaCue = { start: number; end: number; text?: string };

export type PoseMediaManifest = {
  video: {
    hls: string | null;
    mp4: string | null;
    poster: string;
    playbackId: string | null;
    provider: StreamProvider | "local" | null;
  } | null;
  audio: { url: string; cues: MediaCue[] | null } | null;
};

function nonEmpty(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function moduleDir(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.dirname) return import.meta.dirname;
  } catch {
    /* ignore */
  }
  return dirname(fileURLToPath(import.meta.url));
}

function publicRoot(): string {
  const candidates = [
    resolve(process.cwd(), "client", "public"),
    resolve(process.cwd(), "dist", "public"),
    resolve(moduleDir(), "public"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!;
}

function readCues(slug: string, root: string): MediaCue[] | null {
  const timingPath = join(root, "voice", "timings", `${slug}.timing.json`);
  if (!nonEmpty(timingPath)) return null;
  try {
    const data = JSON.parse(readFileSync(timingPath, "utf-8")) as {
      steps?: { start: number; end: number }[];
    };
    if (!Array.isArray(data.steps) || data.steps.length === 0) return null;
    return data.steps.map((s) => ({ start: s.start, end: s.end }));
  } catch {
    return null;
  }
}

function posterFor(slug: string, root: string): string {
  const posterPng = join(root, "poses", `${slug}.png`);
  const posterWebp = join(root, "poses", `${slug}.webp`);
  if (nonEmpty(posterPng)) return `/poses/${slug}.png`;
  if (nonEmpty(posterWebp)) return `/poses/${slug}.webp`;
  return `/poses/${slug}.png`;
}

/** Validate slug shape — letters, numbers, hyphens only. */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) && slug.length <= 80;
}

export async function buildPoseMediaManifest(slug: string): Promise<PoseMediaManifest> {
  const root = publicRoot();
  const poster = posterFor(slug, root);

  let video: PoseMediaManifest["video"] = null;

  const streamRow = await getPosePlayback(slug);
  if (streamRow?.playbackId) {
    const provider = streamRow.provider || streamProvider();
    const urls = buildStreamPlaybackUrls(streamRow.playbackId, provider);
    if (urls) {
      video = {
        hls: urls.hls,
        mp4: urls.mp4,
        poster,
        playbackId: urls.playbackId,
        provider: urls.provider,
      };
    }
  }

  // Local progressive fallback when no stream ID / provider not configured.
  if (!video) {
    const mp4Path = join(root, "videos", "poses", `${slug}.mp4`);
    const hlsPath = join(root, "videos", "poses", `${slug}.m3u8`);
    if (nonEmpty(mp4Path) || nonEmpty(hlsPath)) {
      video = {
        hls: nonEmpty(hlsPath) ? `/videos/poses/${slug}.m3u8` : null,
        mp4: nonEmpty(mp4Path) ? `/videos/poses/${slug}.mp4` : null,
        poster,
        playbackId: null,
        provider: "local",
      };
    }
  }

  let audio: PoseMediaManifest["audio"] = null;
  const audioPath = join(root, "voice", `pose-${slug}.mp3`);
  if (nonEmpty(audioPath)) {
    audio = {
      url: `/audio/pose-${slug}.mp3`,
      cues: readCues(slug, root),
    };
  }

  return { video, audio };
}
