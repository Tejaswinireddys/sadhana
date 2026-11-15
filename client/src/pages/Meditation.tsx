import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/use-toast";
import { logPracticeSession } from "@/lib/logPracticeSession";
import { cueAt, shouldRingBell } from "@/lib/meditationClock";
import { readUrlParam } from "@/lib/hashQuery";
import {
  AI_SCRIPT_NOTE,
  BELL_CHOICES,
  MEDITATIONS,
  TIMER_CHOICES,
  meditationBySlug,
  type MeditationPractice,
} from "@/data/meditations";
import type { Preferences } from "@shared/schema";

function timerPractice(minutes: number, bellEverySeconds: number): MeditationPractice {
  return {
    slug: "timer",
    name: "Unguided timer",
    minutes,
    kind: "timer",
    summary: "Silence, with a bell at the start, on the interval you choose, and at the end.",
    cues: [
      { t: 0, text: "The timer is running. Stay with whatever you are doing: sitting, breathing, or nothing in particular." },
      { t: minutes * 60, text: "The sit is over." },
    ],
    bellEverySeconds,
    safety: "The bells are short tones from this device. Sit somewhere you do not need to drive or supervise anyone.",
    script: "none",
  };
}

function ringBell() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 528;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.45);
  osc.onended = () => void ctx.close();
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

function SitPlayer({
  practice,
  allowRobotVoice,
}: {
  practice: MeditationPractice;
  allowRobotVoice: boolean;
}) {
  const { toast } = useToast();
  const duration = practice.minutes * 60;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [bellsOn, setBellsOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(allowRobotVoice);
  const startedAt = useRef(0);
  const carried = useRef(0);
  const previousElapsed = useRef(0);
  const spokenAt = useRef<number | null>(null);
  const logged = useRef(false);

  const cue = cueAt(practice.cues, Math.min(elapsed, duration));
  const remaining = Math.max(0, duration - elapsed);
  const remainingLabel = `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const next = carried.current + (performance.now() - startedAt.current) / 1000;
      if (next >= duration) {
        setElapsed(duration);
        setRunning(false);
        setDone(true);
        return;
      }
      setElapsed(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, duration]);

  useEffect(() => {
    if (!bellsOn) {
      previousElapsed.current = elapsed;
      return;
    }
    if (
      shouldRingBell({
        elapsed,
        previousElapsed: previousElapsed.current,
        duration,
        everySeconds: practice.bellEverySeconds,
      })
    ) {
      ringBell();
    }
    previousElapsed.current = elapsed;
  }, [elapsed, bellsOn, duration, practice.bellEverySeconds]);

  useEffect(() => {
    if (!running || !cue || spokenAt.current === cue.t) return;
    spokenAt.current = cue.t;
    if (voiceOn && allowRobotVoice) speak(cue.text);
  }, [cue, running, voiceOn, allowRobotVoice]);

  useEffect(() => {
    if (!done || logged.current) return;
    logged.current = true;
    const minutes = Math.max(1, Math.round(duration / 60));
    void logPracticeSession({
      minutes,
      plannedMinutes: practice.minutes,
      poseNames: [practice.name],
      label: practice.kind === "nidra" ? `Yoga nidra: ${practice.name}` : `Meditation: ${practice.name}`,
      pathwaySlug: null,
      preMood: null,
      postMood: null,
      kind: "meditation",
      journalTags: ["meditation", practice.name],
      journalBody: `${practice.name} for ${minutes} min.`,
    }).then((result) => {
      if (!result.ok) {
        toast({ title: "Could not save this sit", description: result.error, variant: "destructive" });
      }
    });
  }, [done, duration, practice, toast]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const start = () => {
    if (done) {
      setElapsed(0);
      setDone(false);
      carried.current = 0;
      previousElapsed.current = 0;
      spokenAt.current = null;
      logged.current = false;
    }
    carried.current = done ? 0 : elapsed;
    startedAt.current = performance.now();
    setRunning(true);
  };

  const pause = () => {
    carried.current = elapsed;
    setRunning(false);
    window.speechSynthesis?.cancel();
  };

  return (
    <Card data-testid={`meditation-player-${practice.slug}`}>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl">{practice.name}</h2>
          <p className="text-sm text-muted-foreground">{practice.summary}</p>
          {practice.script === "ai-written" && (
            <p className="text-sm" data-testid="meditation-ai-note">
              {AI_SCRIPT_NOTE}
            </p>
          )}
        </div>
        <p className="text-sm" data-testid="meditation-safety">
          <span className="font-medium">Safety. </span>
          <span className="text-muted-foreground">{practice.safety}</span>
        </p>
        <p
          className="font-serif text-4xl tabular-nums"
          role="timer"
          aria-label={`${remainingLabel} remaining`}
          data-testid="meditation-remaining"
        >
          {remainingLabel}
        </p>
        <p className="min-h-16 text-base" aria-live="polite" data-testid="meditation-caption">
          {running || done || elapsed > 0
            ? (cue?.text ?? "")
            : "Press start. The words will appear here, whether or not they are spoken."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <Button type="button" className="min-h-11" onClick={start} data-testid="button-meditation-start">
              {elapsed > 0 && !done ? "Resume" : "Start"}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="min-h-11" onClick={pause} data-testid="button-meditation-pause">
              Pause
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-pressed={bellsOn}
            onClick={() => setBellsOn((on) => !on)}
            data-testid="button-meditation-bells"
          >
            {bellsOn ? "Bells on" : "Bells off"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-pressed={voiceOn && allowRobotVoice}
            disabled={!allowRobotVoice}
            onClick={() => setVoiceOn((on) => !on)}
            data-testid="button-meditation-voice"
          >
            {allowRobotVoice ? (voiceOn ? "Voice on" : "Voice off") : "Voice off"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="meditation-voice-note">
          {allowRobotVoice
            ? "Captions stay on. The computer voice is the same optional voice used in guided practice."
            : "Captions stay on. Spoken voice is off until you turn on the computer voice in Settings, the same switch guided practice uses."}{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function Meditation() {
  useDocumentTitle("Meditation · Sadhana");
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const allowRobotVoice = prefs?.allowRobotVoice === 1;
  const fromUrl = readUrlParam("slug");
  const [slug, setSlug] = useState(fromUrl === "timer" || meditationBySlug(fromUrl || "") ? fromUrl! : "body-scan");
  const [timerMinutes, setTimerMinutes] = useState<(typeof TIMER_CHOICES)[number]>(10);
  const [bellEvery, setBellEvery] = useState(300);

  const practice =
    slug === "timer" ? timerPractice(timerMinutes, bellEvery) : meditationBySlug(slug) ?? MEDITATIONS[0];

  const select = (next: string) => {
    setSlug(next);
    const url = `/meditation?slug=${encodeURIComponent(next)}`;
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Meditation</h1>
        <p className="text-muted-foreground">
          Sits and yoga nidra, with a timer and captions. Finished minutes are saved with your other practice.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MEDITATIONS.map((item) => (
          <button
            key={item.slug}
            type="button"
            className="text-left"
            aria-pressed={slug === item.slug}
            onClick={() => select(item.slug)}
            data-testid={`button-meditation-${item.slug}`}
          >
            <Card className={slug === item.slug ? "border-primary ring-1 ring-primary" : ""}>
              <CardContent className="space-y-1 p-4">
                <h2 className="font-serif text-lg">{item.name}</h2>
                <p className="text-xs text-muted-foreground">{item.minutes} min</p>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </CardContent>
            </Card>
          </button>
        ))}
        <button
          type="button"
          className="text-left"
          aria-pressed={slug === "timer"}
          onClick={() => select("timer")}
          data-testid="button-meditation-timer"
        >
          <Card className={slug === "timer" ? "border-primary ring-1 ring-primary" : ""}>
            <CardContent className="space-y-1 p-4">
              <h2 className="font-serif text-lg">Unguided timer</h2>
              <p className="text-xs text-muted-foreground">Your length · interval bells</p>
              <p className="text-sm text-muted-foreground">
                No script. A bell at the start, on the interval, and at the end.
              </p>
            </CardContent>
          </Card>
        </button>
      </div>

      {slug === "timer" && (
        <fieldset className="space-y-3" data-testid="meditation-timer-options">
          <legend className="text-sm font-medium">Timer</legend>
          <div className="flex flex-wrap gap-2">
            {TIMER_CHOICES.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                variant={timerMinutes === minutes ? "default" : "outline"}
                className="min-h-11"
                aria-pressed={timerMinutes === minutes}
                onClick={() => setTimerMinutes(minutes)}
                data-testid={`meditation-timer-${minutes}`}
              >
                {minutes} min
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {BELL_CHOICES.map((choice) => (
              <Button
                key={choice.seconds}
                type="button"
                variant={bellEvery === choice.seconds ? "default" : "outline"}
                className="min-h-11"
                aria-pressed={bellEvery === choice.seconds}
                onClick={() => setBellEvery(choice.seconds)}
                data-testid={`meditation-bell-${choice.seconds}`}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      <SitPlayer
        key={`${practice.slug}-${practice.minutes}-${practice.bellEverySeconds}`}
        practice={practice}
        allowRobotVoice={allowRobotVoice}
      />
    </div>
  );
}
