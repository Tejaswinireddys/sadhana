/**
 * Resolve how a pose should be narrated, in priority order:
 *   (a) pre-recorded human MP3 from the media manifest
 *   (b) neural TTS track (manifest neural file, or server-generated cache)
 *   (c) browser speechSynthesis — only when allowRobotVoice is set
 *   (d) silent captions / timer walkthrough
 */
import type { PoseMediaManifest } from "@/lib/poseMediaApi";
import {
  buildCueList,
  resolveCueList,
  type NarrationCue,
  DEFAULT_CUE_WINDOW_SECONDS,
} from "@/lib/narrationCues";

export type NarrationSourceKind = "human" | "neural" | "speech" | "silent";

export type NarrationPlayback = {
  kind: NarrationSourceKind;
  /** MP3 URL for human/neural; empty for speech/silent. */
  url: string;
  cues: NarrationCue[];
};

export type AudioSourceKind = "human" | "neural";

/** Normalize manifest audio cues (legacy {start,end} or {t,text}) → NarrationCue[]. */
export function normalizeManifestCues(
  cues: unknown,
  stepTexts: string[],
): NarrationCue[] | null {
  if (!cues || !Array.isArray(cues) || cues.length === 0) return null;
  const out: NarrationCue[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    const raw = cues[i] as { t?: number; start?: number; text?: string };
    const t = typeof raw.t === "number" ? raw.t : typeof raw.start === "number" ? raw.start : i * 3;
    const text = (raw.text || stepTexts[i] || "").trim();
    if (!text) continue;
    out.push({ t, text });
  }
  return out.length ? out : null;
}

/**
 * Pick the best playback mode for a pose given the media manifest + prefs.
 * Does not call the TTS generator — use `ensureNeuralNarration` for that.
 */
export function resolveNarrationPlayback(opts: {
  manifest: PoseMediaManifest | null | undefined;
  stepTexts: string[];
  voiceEnabled: boolean;
  allowRobotVoice: boolean;
  duration?: number;
}): NarrationPlayback {
  const duration = opts.duration ?? DEFAULT_CUE_WINDOW_SECONDS;
  const stepTexts = opts.stepTexts;
  const manifestCues = normalizeManifestCues(opts.manifest?.audio?.cues ?? null, stepTexts);
  const cues = resolveCueList({ stepTexts, manifestCues, duration });

  if (!opts.voiceEnabled) {
    return { kind: "silent", url: "", cues };
  }

  const audio = opts.manifest?.audio;
  if (audio?.url) {
    const source = audio.source === "human" ? "human" : "neural";
    return { kind: source, url: audio.url, cues };
  }

  if (opts.allowRobotVoice) {
    return {
      kind: "speech",
      url: "",
      cues: cues.length ? cues : buildCueList(stepTexts, duration),
    };
  }

  return { kind: "silent", url: "", cues };
}

/**
 * Ask the server to generate/cached a neural MP3 when the manifest has none.
 * Returns updated playback or null if generation is unavailable.
 */
export async function ensureNeuralNarration(
  slug: string,
  stepTexts: string[],
): Promise<NarrationPlayback | null> {
  const cues = buildCueList(stepTexts, DEFAULT_CUE_WINDOW_SECONDS);
  try {
    const res = await fetch(`/api/poses/${encodeURIComponent(slug)}/tts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: stepTexts,
        cues,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      url?: string;
      cues?: NarrationCue[] | null;
      source?: AudioSourceKind;
    };
    if (!data.url) return null;
    return {
      kind: data.source === "human" ? "human" : "neural",
      url: data.url,
      cues: data.cues?.length ? data.cues : cues,
    };
  } catch {
    return null;
  }
}
