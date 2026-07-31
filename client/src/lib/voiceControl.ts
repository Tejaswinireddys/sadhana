/**
 * Hands-free voice control for guided practice (Web Speech API).
 * Destructive commands require confirmation phrasing.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

export type VoiceCommand =
  | "pause"
  | "resume"
  | "repeat"
  | "skip"
  | "slower"
  | "faster"
  | "modification"
  | "stop";

export type VoicePrefs = {
  enabled: boolean;
};

export function readVoicePrefs(): VoicePrefs {
  return readJson<VoicePrefs>(KEYS.voiceControl, { enabled: false });
}

export function writeVoicePrefs(prefs: VoicePrefs) {
  writeJson(KEYS.voiceControl, prefs);
}

const PATTERNS: { cmd: VoiceCommand; re: RegExp }[] = [
  { cmd: "pause", re: /\b(pause|hold on|wait)\b/i },
  { cmd: "resume", re: /\b(resume|continue|go on|play)\b/i },
  { cmd: "repeat", re: /\b(repeat|again|say that again)\b/i },
  { cmd: "skip", re: /\b(skip|next pose|next)\b/i },
  { cmd: "slower", re: /\b(slower|slow down)\b/i },
  { cmd: "faster", re: /\b(faster|speed up)\b/i },
  { cmd: "modification", re: /\b(modification|modify|easier option)\b/i },
  { cmd: "stop", re: /\b(stop practice|end session|i'm done)\b/i },
];

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const t = transcript.trim();
  if (!t) return null;
  for (const { cmd, re } of PATTERNS) {
    if (re.test(t)) return cmd;
  }
  return null;
}

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function createVoiceController(opts: {
  onCommand: (cmd: VoiceCommand, raw: string) => void;
  onError?: (message: string) => void;
}): { start: () => void; stop: () => void; supported: boolean } {
  const SR =
    typeof window !== "undefined"
      ? (window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition
      : undefined;

  if (!SR) {
    return {
      supported: false,
      start: () => opts.onError?.("Voice control needs a browser with speech recognition."),
      stop: () => undefined,
    };
  }

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = "en-US";
  let active = false;

  rec.onresult = (ev) => {
    const last = ev.results[ev.results.length - 1];
    if (!last?.isFinal) return;
    const raw = last[0]?.transcript ?? "";
    const cmd = parseVoiceCommand(raw);
    if (cmd) opts.onCommand(cmd, raw);
  };
  rec.onerror = (ev) => {
    if (ev.error === "not-allowed") opts.onError?.("Microphone permission denied.");
  };
  rec.onend = () => {
    if (active) {
      try {
        rec.start();
      } catch {
        /* ignore restart races */
      }
    }
  };

  return {
    supported: true,
    start: () => {
      active = true;
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      active = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
