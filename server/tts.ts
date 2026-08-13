/**
 * Neural TTS cache — generates pose narration MP3s when no pre-recorded file
 * exists. Provider is selected by TTS_PROVIDER (elevenlabs | azure | google).
 *
 * Without credentials the endpoint returns 501 so the client can fall through
 * to speechSynthesis (allowRobotVoice) or silent captions.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

export type TtsCue = { t: number; text: string };

export type TtsResult = {
  url: string;
  source: "neural";
  cues: TtsCue[];
  cached: boolean;
};

function cacheDir(): string {
  const dir = resolve(process.cwd(), ".data", "tts-cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function nonEmpty(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).size > 0;
  } catch {
    return false;
  }
}

export function ttsCachePaths(slug: string) {
  const dir = cacheDir();
  return {
    mp3: join(dir, `pose-${slug}.mp3`),
    meta: join(dir, `pose-${slug}.json`),
  };
}

export function readCachedTts(slug: string): TtsResult | null {
  const { mp3, meta } = ttsCachePaths(slug);
  if (!nonEmpty(mp3)) return null;
  let cues: TtsCue[] = [];
  if (nonEmpty(meta)) {
    try {
      const data = JSON.parse(readFileSync(meta, "utf-8")) as { cues?: TtsCue[] };
      if (Array.isArray(data.cues)) cues = data.cues;
    } catch {
      /* ignore */
    }
  }
  return {
    url: `/audio/tts/pose-${slug}.mp3`,
    source: "neural",
    cues,
    cached: true,
  };
}

export function ttsConfigured(): boolean {
  const provider = (process.env.TTS_PROVIDER || "").toLowerCase();
  if (provider === "elevenlabs") return Boolean(process.env.ELEVENLABS_API_KEY);
  if (provider === "azure") {
    return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
  }
  if (provider === "google") return Boolean(process.env.GOOGLE_TTS_API_KEY);
  return false;
}

function scriptHash(texts: string[]): string {
  return createHash("sha256").update(texts.join("\n")).digest("hex").slice(0, 16);
}

function estimateCues(texts: string[]): TtsCue[] {
  // Lightweight mirror of client syllable estimate — enough for captions when
  // the provider does not return word timings.
  const weights = texts.map((t) => Math.max(1, t.split(/\s+/).filter(Boolean).length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const duration = Math.max(8, texts.reduce((s, t) => s + t.split(/\s+/).length * 0.42, 0));
  let cursor = 0;
  return texts.map((text, i) => {
    const t = cursor;
    cursor += (weights[i]! / total) * duration;
    return { t: Math.round(t * 1000) / 1000, text };
  });
}

async function synthesizeElevenLabs(text: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY!;
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_monolingual_v1",
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function synthesizeAzure(text: string): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY!;
  const region = process.env.AZURE_SPEECH_REGION!;
  const voice = process.env.AZURE_SPEECH_VOICE || "en-US-JennyNeural";
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    },
  );
  if (!res.ok) {
    throw new Error(`Azure TTS failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function synthesizeGoogle(text: string): Promise<Buffer> {
  const key = process.env.GOOGLE_TTS_API_KEY!;
  const voice = process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-J";
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: voice },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Google TTS failed (${res.status})`);
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("Google TTS returned no audio");
  return Buffer.from(data.audioContent, "base64");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function synthesize(text: string): Promise<Buffer> {
  const provider = (process.env.TTS_PROVIDER || "").toLowerCase();
  if (provider === "elevenlabs") return synthesizeElevenLabs(text);
  if (provider === "azure") return synthesizeAzure(text);
  if (provider === "google") return synthesizeGoogle(text);
  throw new Error("TTS_PROVIDER not configured");
}

/**
 * Return cached neural audio, or generate + cache when a provider is configured.
 */
export async function ensureNeuralTts(
  slug: string,
  texts: string[],
  cuesIn?: TtsCue[] | null,
): Promise<TtsResult> {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) {
    throw Object.assign(new Error("No narration text"), { status: 400 });
  }

  const cached = readCachedTts(slug);
  const { meta } = ttsCachePaths(slug);
  if (cached && nonEmpty(meta)) {
    try {
      const prev = JSON.parse(readFileSync(meta, "utf-8")) as { hash?: string };
      if (prev.hash === scriptHash(clean)) return cached;
    } catch {
      /* regenerate */
    }
  } else if (cached) {
    return cached;
  }

  if (!ttsConfigured()) {
    throw Object.assign(new Error("Neural TTS is not configured"), { status: 501 });
  }

  const script = clean.join(". ");
  const audio = await synthesize(script);
  const cues = cuesIn?.length ? cuesIn : estimateCues(clean);
  const paths = ttsCachePaths(slug);
  writeFileSync(paths.mp3, audio);
  writeFileSync(
    paths.meta,
    JSON.stringify({ slug, hash: scriptHash(clean), cues, provider: process.env.TTS_PROVIDER }, null, 2),
  );

  return {
    url: `/audio/tts/pose-${slug}.mp3`,
    source: "neural",
    cues,
    cached: false,
  };
}
