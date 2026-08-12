/**
 * Build the GET /api/poses/:slug/media payload from files on disk.
 * Never invents CDN URLs — only reports assets that actually exist.
 *
 * Audio priority on disk:
 *   1. voice/human/pose-{slug}.mp3  → source: "human"
 *   2. voice/pose-{slug}.mp3        → source: "neural" (pre-recorded TTS)
 *   3. .data/tts-cache/pose-{slug}.mp3 → source: "neural" (runtime cache)
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCachedTts } from "./tts";

export type NarrationCue = { t: number; text: string };

export type PoseMediaManifest = {
  video: { hls: string | null; mp4: string; poster: string } | null;
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

/** Validate slug shape — letters, numbers, hyphens only. */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) && slug.length <= 80;
}

export function buildPoseMediaManifest(slug: string): PoseMediaManifest {
  const root = publicRoot();
  const mp4Path = join(root, "videos", "poses", `${slug}.mp4`);
  const hlsPath = join(root, "videos", "poses", `${slug}.m3u8`);
  const posterPng = join(root, "poses", `${slug}.png`);
  const posterWebp = join(root, "poses", `${slug}.webp`);
  const humanPath = join(root, "voice", "human", `pose-${slug}.mp3`);
  const neuralPath = join(root, "voice", `pose-${slug}.mp3`);

  let video: PoseMediaManifest["video"] = null;
  if (nonEmpty(mp4Path)) {
    const poster = nonEmpty(posterPng)
      ? `/poses/${slug}.png`
      : nonEmpty(posterWebp)
        ? `/poses/${slug}.webp`
        : `/poses/${slug}.png`;
    video = {
      hls: nonEmpty(hlsPath) ? `/videos/poses/${slug}.m3u8` : null,
      mp4: `/videos/poses/${slug}.mp4`,
      poster,
    };
  }

  let audio: PoseMediaManifest["audio"] = null;
  const cues = readCues(slug, root);
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
