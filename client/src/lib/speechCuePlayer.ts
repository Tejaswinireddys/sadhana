/**
 * Browser speechSynthesis cue player — last-resort narration when no MP3
 * exists and the user has opted into allowRobotVoice.
 *
 * Speaks each cue when the session clock reaches cue.t. Mute cancels speech
 * but the clock (and on-screen cues) keep advancing.
 */
import type { NarrationCue } from "@/lib/narrationCues";
import { cueIndexAt } from "@/lib/narrationCues";

export type SpeechCuePlayer = {
  /** Advance media-time (seconds). Speaks newly reached cues. */
  tick: (time: number) => void;
  /** Cancel any in-flight utterance. */
  cancel: () => void;
  /** Pause / resume underlying synthesis when supported. */
  setPaused: (paused: boolean) => void;
  setMuted: (muted: boolean) => void;
};

export function createSpeechCuePlayer(opts: {
  cues: NarrationCue[];
  /** 0.75 / 1 / 1.25 — maps to SpeechSynthesisUtterance.rate */
  pace?: number;
  muted?: boolean;
  onCue?: (index: number, cue: NarrationCue) => void;
}): SpeechCuePlayer {
  let lastSpoken = -1;
  let muted = !!opts.muted;
  let paused = false;
  const pace = opts.pace ?? 1;
  const cues = opts.cues;

  const speakCue = (index: number) => {
    if (muted || paused) return;
    const cue = cues[index];
    if (!cue) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cue.text);
      // Map session pace onto a calm utterance rate.
      u.rate = Math.max(0.7, Math.min(1.3, 0.92 * pace));
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      opts.onCue?.(index, cue);
    } catch {
      /* ignore */
    }
  };

  return {
    tick(time: number) {
      if (cues.length === 0) return;
      const idx = cueIndexAt(cues, time);
      if (idx > lastSpoken) {
        // Speak every newly crossed cue (usually one per tick).
        for (let i = lastSpoken + 1; i <= idx; i += 1) speakCue(i);
        lastSpoken = idx;
      }
    },
    cancel() {
      lastSpoken = -1;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    setPaused(next: boolean) {
      paused = next;
      try {
        if (next) window.speechSynthesis?.pause();
        else window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
    },
    setMuted(next: boolean) {
      muted = next;
      if (next) {
        try {
          window.speechSynthesis?.cancel();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
