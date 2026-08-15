/**
 * Build the GET /api/poses/:slug/media payload.
 *
 * Video priority:
 *   1. Adaptive stream (playback ID in pose_media + STREAM_PROVIDER URLs)
 *   2. Local progressive HD files under client/public/videos/poses/
 *
 * Audio priority on disk:
 *   1. voice/human/pose-{slug}.mp3  → source: "human"
 *   2. voice/pose-{slug}.mp3        → source: "neural" (pre-recorded TTS)
 *   3. .data/tts-cache/pose-{slug}.mp3 → source: "neural" (runtime cache)
 *
 * Never invents CDN URLs without a stored playback ID + configured provider.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCachedTts } from "./tts";
import { buildStreamPlaybackUrls, streamProvider, type StreamProvider } from "./streamConfig";
import { getPosePlayback } from "./poseStreamStore";

export type NarrationCue = { t: number; text: string };

export type PoseMediaManifest = {
  video: {
    hls: string | null;
    mp4: string | null;
    webm: string | null;
    poster: string;
    captions: string | null;
    playbackId: string | null;
    provider: StreamProvider | "local" | null;
  } | null;
  audio: {
    url: string;
    source: "human" | "neural";
    cues: NarrationCue[] | null;
  } | null;
};

function nonEmpty(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function moduleDir(): string {
  // In the CJS production bundle `import.meta` is emptied by esbuild, so
  // both `.dirname` and `.url` can be undefined here. This is only ever a
  // third-choice fallback candidate (the cwd-based paths normally match),
  // so fail soft to cwd instead of crashing the whole process on boot.
  try {
    if (typeof import.meta !== "undefined" && import.meta.dirname) return import.meta.dirname;
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    /* ignore */
  }
  return process.cwd();
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

function readCues(slug: string, root: string): NarrationCue[] | null {
  const timingPath = join(root, "voice", "timings", `${slug}.timing.json`);
  if (!nonEmpty(timingPath)) return null;
  try {
    const data = JSON.parse(readFileSync(timingPath, "utf-8")) as {
      steps?: { start: number; end: number; text?: string }[];
      cues?: NarrationCue[];
    };
    if (Array.isArray(data.cues) && data.cues.length > 0) {
      return data.cues.map((c) => ({ t: c.t, text: c.text || "" }));
    }
    if (!Array.isArray(data.steps) || data.steps.length === 0) return null;
    return data.steps.map((s) => ({
      t: s.start,
      text: s.text || "",
    }));
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
  const captionsPath = join(root, "captions", "poses", `${slug}.vtt`);
  const captions = nonEmpty(captionsPath) ? `/captions/poses/${slug}.vtt` : null;

  let video: PoseMediaManifest["video"] = null;

  const streamRow = await getPosePlayback(slug);
  if (streamRow?.playbackId) {
    const provider = streamRow.provider || streamProvider();
    const urls = buildStreamPlaybackUrls(streamRow.playbackId, provider);
    if (urls) {
      video = {
        hls: urls.hls,
        mp4: urls.mp4,
        webm: null,
        poster,
        captions,
        playbackId: urls.playbackId,
        provider: urls.provider,
      };
    }
  }

  // Local progressive HD fallback when no stream ID / provider not configured.
  if (!video) {
    const mp4Path = join(root, "videos", "poses", `${slug}.mp4`);
    const webmPath = join(root, "videos", "poses", `${slug}.webm`);
    const hlsPath = join(root, "videos", "poses", `${slug}.m3u8`);
    if (nonEmpty(mp4Path) || nonEmpty(hlsPath) || nonEmpty(webmPath)) {
      video = {
        hls: nonEmpty(hlsPath) ? `/videos/poses/${slug}.m3u8` : null,
        mp4: nonEmpty(mp4Path) ? `/videos/poses/${slug}.mp4` : null,
        webm: nonEmpty(webmPath) ? `/videos/poses/${slug}.webm` : null,
        poster,
        captions,
        playbackId: null,
        provider: "local",
      };
    }
  }

  let audio: PoseMediaManifest["audio"] = null;
  const cues = readCues(slug, root);
  const humanPath = join(root, "voice", "human", `pose-${slug}.mp3`);
  const neuralPath = join(root, "voice", `pose-${slug}.mp3`);

  if (nonEmpty(humanPath)) {
    audio = {
      url: `/audio/human/pose-${slug}.mp3`,
      source: "human",
      cues,
    };
  } else if (nonEmpty(neuralPath)) {
    audio = {
      url: `/audio/pose-${slug}.mp3`,
      source: "neural",
      cues,
    };
  } else {
    const cached = readCachedTts(slug);
    if (cached) {
      audio = {
        url: cached.url,
        source: "neural",
        cues: cached.cues.length ? cached.cues : cues,
      };
    }
  }

  return { video, audio };
}
