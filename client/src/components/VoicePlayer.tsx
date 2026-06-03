// VoicePlayer — a guided-audio player for pose/breath/kids narration.
//   - Listen / Pause button (lucide Volume2 / Pause)
//   - visual progress scrubber
//   - speed control (0.75x, 1x, 1.25x, 1.5x)
//   - "Calm female voice (ElevenLabs)" note
//   - HTML <audio> under the hood, React state for play/pause/seek/rate
// When the global "Voice on" preference is OFF, the player is disabled and
// shows a tooltip instead of playing.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Preferences } from "@shared/schema";
import { Volume2, Pause } from "lucide-react";

const RATES = [0.75, 1, 1.25, 1.5] as const;

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoicePlayer({
  src,
  slug,
  label,
}: {
  src: string;
  slug: string;
  label?: string;
}) {
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const voiceEnabled = prefs ? prefs.voiceEnabled === 1 : true;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(1);

  // Reset when the src changes (navigating between poses)
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  // Stop playback if voice gets disabled mid-play
  useEffect(() => {
    if (!voiceEnabled && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [voiceEnabled]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.playbackRate = rate;
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const cycleRate = () => {
    const idx = RATES.indexOf(rate as (typeof RATES)[number]);
    const next = RATES[(idx + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const onSeek = (v: number[]) => {
    const a = audioRef.current;
    if (!a || !isFinite(duration) || duration === 0) return;
    const t = (v[0] / 100) * duration;
    a.currentTime = t;
    setCurrent(t);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  const playerBody = (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft"
      data-testid={`audio-player-${slug}`}
    >
      {label && <p className="text-sm font-medium">{label}</p>}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="default"
          onClick={toggle}
          disabled={!voiceEnabled}
          aria-label={playing ? "Pause narration" : "Play narration"}
          data-testid={`button-voice-toggle-${slug}`}
          className="h-10 w-10 shrink-0 rounded-full"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>

        <div className="flex flex-1 items-center gap-2">
          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
            {fmt(current)}
          </span>
          <Slider
            min={0}
            max={100}
            step={0.5}
            value={[progress]}
            onValueChange={onSeek}
            disabled={!voiceEnabled}
            data-testid={`scrubber-voice-${slug}`}
            className="flex-1"
            aria-label="Seek narration"
          />
          <span className="w-9 text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={cycleRate}
          disabled={!voiceEnabled}
          data-testid={`button-voice-rate-${slug}`}
          className="shrink-0 tabular-nums"
        >
          {rate}x
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          Calm female voice (ElevenLabs)
        </span>
        {!voiceEnabled && (
          <span className="text-[11px] text-muted-foreground">Voice disabled</span>
        )}
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
    </div>
  );

  if (voiceEnabled) return playerBody;

  // When voice is disabled, wrap in a tooltip explaining how to enable it.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{playerBody}</div>
      </TooltipTrigger>
      <TooltipContent data-testid={`tooltip-voice-disabled-${slug}`}>
        Voice disabled — enable in settings
      </TooltipContent>
    </Tooltip>
  );
}
