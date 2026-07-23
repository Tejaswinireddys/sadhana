// GuidedSession — a continuous, voice-narrated flow through a queued session.
//
// A single full-height screen with three vertical zones:
//   Top    — session progress bar, session name, close (X).
//   Middle — pose demonstration stage (video when available, else illustration
//            + focus halo), prev/next thumbs, pose name.
//   Bottom — countdown, synced step / form cues, transport, pose-tips button.
//
// State machine per pose:
//   transitionIn (5s, chime + speechSynthesis "Next: ...")  →
//   instruction (pose-<slug>.mp3 plays, halo tracks steps)   →
//   sideSwitch (2s "Switch sides", only when sides === "each") → instruction (side 2) →
//   hold (silent countdown, rotating form/breath cues) →
//   next pose transitionIn … → complete.
//
// Honors the user's `voiceEnabled` preference: when OFF, no audio plays — the
// session still runs on the countdown + captions (chime approach).
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoodCheckIn } from "@/components/MoodCheckIn";
import { Confetti } from "@/components/Confetti";
import { usePractice } from "@/context/PracticeContext";
import { useToast } from "@/hooks/use-toast";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { logPracticeSession } from "@/lib/logPracticeSession";
import { unlockAudio } from "@/lib/audioUnlock";
import { type Mood } from "@/data/content";
import type { Preferences } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  Plus,
  MicVocal,
  Timer as TimerIcon,
  Flame,
  Route as RouteIcon,
  LayoutGrid,
  NotebookPen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WARMUP, asanaBySlug } from "@/data/content";
import { PoseDemoStage } from "@/components/PoseDemoStage";
import { PoseTipsSheet, PoseTipsTrigger } from "@/components/PoseTipsSheet";
import { poseMediaFor, poseHasVideo } from "@/data/poseMedia";
import { practiceHoldCues } from "@/lib/poseExplanation";
import { QUICK_SESSIONS } from "@/data/quickSessions";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// ---- soft chime (shared with Practice) --------------------------------------
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [528, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.5);
    });
    setTimeout(() => ctx.close(), 2200);
  } catch {
    /* ignore audio errors */
  }
}

const TRANSITION_SECONDS = 5;
const SIDE_SWITCH_SECONDS = 2;
const FALLBACK_HOLD_CUES = [
  "Inhale…",
  "Exhale…",
  "Find your edge…",
  "Soften…",
  "Stay present…",
];

type Phase = "transitionIn" | "instruction" | "sideSwitch" | "hold" | "complete";

const mmss = (s: number) => {
  const v = Math.max(0, Math.round(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

export default function GuidedSession() {
  useDocumentTitle("Guided practice · Sadhana");
  const {
    todays,
    meta,
    clear,
    loadSession,
    saveProgress,
    progress: sessionProgress,
    needsRestore,
    consumeRestoredProgress,
  } = usePractice();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const startQuickSession = (q: (typeof QUICK_SESSIONS)[number]) => {
    const poses = q.poses
      .map((p) => {
        const asana = asanaBySlug(p.slug);
        return asana ? { asana, holdSeconds: p.holdSeconds } : null;
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } =>
          x != null,
      );
    loadSession(poses, { label: `${q.time} · ${q.label}`, breathSlug: q.breathSlug ?? null });
  };

  const startWarmup = () => {
    const poses = WARMUP.steps
      .map((s) => {
        const asana = asanaBySlug(s.asanaSlug);
        if (!asana) return null;
        return { asana, holdSeconds: s.holdSeconds, sides: s.sides };
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
          x != null,
      );
    if (!poses.length) return;
    loadSession(poses, { label: WARMUP.title, pathwaySlug: null });
  };

  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const voiceEnabled = prefs ? prefs.voiceEnabled !== 0 : true;

  // ---- flow state -----------------------------------------------------------
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("transitionIn");
  const [side, setSide] = useState<1 | 2>(1); // which side we're on for "each" poses
  const [phaseRemaining, setPhaseRemaining] = useState(TRANSITION_SECONDS); // seconds
  const [holdBudget, setHoldBudget] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [imgVisible, setImgVisible] = useState(true); // crossfade toggle
  const [cueIndex, setCueIndex] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(false);

  // ---- premium: breath cycle + image key for crossfade ----------------------
  const [confirmExit, setConfirmExit] = useState(false);

  // ---- completion / mood state ----------------------------------------------
  const [finished, setFinished] = useState(false);
  const [showPreMood, setShowPreMood] = useState(true);
  const [showPostMood, setShowPostMood] = useState(false);
  const [preMood, setPreMood] = useState<Mood | null>(null);
  const [postMood, setPostMood] = useState<Mood | null>(null);
  const [started, setStarted] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPostMood = useRef<Mood | null>(null);
  const finishedMinutes = useRef(1);
  const sessionLogged = useRef(false);
  useWakeLock(started && !paused && !finished);
  const posesCompleted = useRef(0);
  // Seconds already attributed to a logged session — lets "Do one more pose"
  // log only the *additional* time instead of double-counting the whole run.
  const loggedSeconds = useRef(0);
  // +30s pressed outside the hold phase: bank it and apply when the hold starts.
  const pendingExtension = useRef(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // True when this pose's narration failed to load/play. The instruction phase
  // then runs on the silent countdown instead of waiting forever for audio.
  const audioBrokenRef = useRef(false);
  const [voiceDuration, setVoiceDuration] = useState(0);

  const current = todays[index];
  const prev = index > 0 ? todays[index - 1] : null;
  const next = index + 1 < todays.length ? todays[index + 1] : null;
  const poseMedia = useMemo(
    () => (current ? poseMediaFor(current.slug) : null),
    [current?.slug],
  );
  const holdCues = useMemo(
    () => (current ? practiceHoldCues(current) : FALLBACK_HOLD_CUES),
    [current],
  );

  // Close tips when advancing so the next pose starts clean.
  useEffect(() => {
    setTipsOpen(false);
  }, [current?.slug]);

  // Prefetch the next pose narration during hold — one file, skip on save-data.
  useEffect(() => {
    if (phase !== "hold" || !next || !voiceEnabled) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const href = `${import.meta.env.BASE_URL}voice/pose-${next.slug}.mp3`;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "fetch";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [phase, next, voiceEnabled]);

  const steps = current?.steps ?? [];
  const stepCount = steps.length || 1;
  const isEach = current?.sides === "each";

  const src = current
    ? `${import.meta.env.BASE_URL}voice/pose-${current.slug}.mp3`
    : "";

  // Focus halo during instruction — PoseDemoStage draws it on the illustration.
  const activeZone =
    phase === "instruction" ? steps[stepIndex]?.focusZone ?? null : null;

  // ---- session time estimate ------------------------------------------------
  const totalEstimateSeconds = useMemo(() => {
    return todays.reduce((sum, a) => {
      const base = a.holdSeconds + TRANSITION_SECONDS;
      return sum + (a.sides === "each" ? base + a.holdSeconds + SIDE_SWITCH_SECONDS : base);
    }, 0);
  }, [todays]);
  const [remainingEstimate, setRemainingEstimate] = useState(totalEstimateSeconds);
  useEffect(() => setRemainingEstimate(totalEstimateSeconds), [totalEstimateSeconds]);

  // ---- speech-synthesis transition voice-over -------------------------------
  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled) return;
      try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.92;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    },
    [voiceEnabled],
  );

  // ---- enter transition-in for a given pose index ---------------------------
  const enterTransition = useCallback(
    (i: number) => {
      const pose = todays[i];
      if (!pose) return;
      setImgVisible(false);
      // Crossfade: fade out, swap, fade in.
      setTimeout(() => setImgVisible(true), 60);
      setPhase("transitionIn");
      setSide(1);
      setStepIndex(0);
      setPhaseRemaining(TRANSITION_SECONDS);
      setCueIndex(0);
      audioBrokenRef.current = false;
      setVoiceDuration(0);
      playChime();
      speak(`Next: ${pose.english}. Take a breath, and prepare.`);
    },
    [todays, speak],
  );

  // Restore mid-session progress after refresh.
  useEffect(() => {
    if (!needsRestore || !sessionProgress || sessionProgress.mode !== "guided") return;
    if (todays.length === 0) return;
    const i = Math.min(sessionProgress.index, todays.length - 1);
    setIndex(i);
    if (sessionProgress.phase) setPhase(sessionProgress.phase as Phase);
    if (sessionProgress.phaseRemaining != null) setPhaseRemaining(sessionProgress.phaseRemaining);
    if (sessionProgress.side) setSide(sessionProgress.side);
    setElapsedTotal(sessionProgress.elapsedTotal ?? 0);
    setStarted(!!sessionProgress.started);
    setPaused(true);
    setShowPreMood(false);
    consumeRestoredProgress();
    toast({
      title: "Session restored",
      description: "Your guided flow was paused after a refresh. Tap Resume when ready.",
    });
  }, [needsRestore, sessionProgress, todays, consumeRestoredProgress, toast]);

  // Snapshot progress while running.
  useEffect(() => {
    if (!started || finished || todays.length === 0) return;
    saveProgress({
      mode: "guided",
      index,
      phase,
      phaseRemaining,
      side,
      started: true,
      elapsedTotal,
      paused,
    });
  }, [
    started,
    finished,
    index,
    phase,
    phaseRemaining,
    side,
    elapsedTotal,
    paused,
    todays.length,
    saveProgress,
  ]);

  // ---- persist + auto-journal + milestone (mirrors Practice.tsx) ------------
  const finalizeSession = useCallback(
    async (resolvedPost: Mood | null) => {
      if (sessionLogged.current || saving) return;
      lastPostMood.current = resolvedPost;
      setSaving(true);
      setSaveFailed(false);
      const minutes = finishedMinutes.current;
      const poseNames = todays.map((a) => a.english);
      const sessionLabel = meta.label ?? "Guided session";

      const result = await logPracticeSession({
        minutes,
        poseNames,
        label: sessionLabel,
        pathwaySlug: meta.pathwaySlug ?? null,
        preMood,
        postMood: resolvedPost,
        journalTags: [sessionLabel, "guided"],
      });
      setSaving(false);

      if (!result.ok) {
        setSaveFailed(true);
        sessionLogged.current = false;
        toast({
          title: "Couldn't save your practice",
          description: "Check your connection, then tap Retry save.",
          variant: "destructive",
        });
        return;
      }

      sessionLogged.current = true;
      setSaveFailed(false);
      saveProgress(null);
      if (result.milestone) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2600);
        playChime();
        toast({ title: result.milestone.title, description: result.milestone.message });
      }
    },
    [todays, meta, preMood, toast, saving, saveProgress],
  );

  const finish = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setPhase("complete");
    setFinished(true);
    posesCompleted.current = todays.length;
    const newSeconds = Math.max(0, elapsedTotal - loggedSeconds.current);
    loggedSeconds.current = elapsedTotal;
    const minutes = Math.max(1, Math.round(newSeconds / 60));
    finishedMinutes.current = minutes;
    setConfetti(true);
    setTimeout(() => setConfetti(false), 2800);
    playChime();
    setShowPostMood(true);
  }, [elapsedTotal, todays.length]);

  // ---- advance to the next pose (or finish) ---------------------------------
  const goToPose = useCallback(
    (i: number) => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      if (i >= todays.length) {
        finish();
        return;
      }
      if (i < 0) i = 0;
      setIndex(i);
      enterTransition(i);
    },
    [todays.length, finish, enterTransition],
  );

  // Silent narration window (seconds of on-screen step reading) used when
  // voice is off OR this pose's narration failed to load.
  const SILENT_INSTRUCTION = 12;

  const startInstruction = useCallback(
    (whichSide: 1 | 2) => {
      setPhase("instruction");
      setSide(whichSide);
      setStepIndex(0);
      const a = audioRef.current;
      if (!voiceEnabled || audioBrokenRef.current || !a) {
        // Timer-driven walkthrough: the master tick counts this down and the
        // step captions cycle across the window.
        setPhaseRemaining(SILENT_INSTRUCTION);
        return;
      }
      a.currentTime = 0;
      a.playbackRate = 1;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.catch((err) => {
          // AbortError = we interrupted playback ourselves (pause/skip); real
          // failures (missing/broken narration) fall back to the silent window.
          if ((err as DOMException)?.name === "AbortError") return;
          audioBrokenRef.current = true;
          setPhaseRemaining(SILENT_INSTRUCTION);
        });
      }
    },
    [voiceEnabled],
  );

  const enterHold = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    const hold = current?.holdSeconds ?? 30;
    const vd = voiceEnabled && !audioBrokenRef.current ? Math.round(voiceDuration) : 0;
    const remaining = Math.max(3, hold - vd) + pendingExtension.current;
    pendingExtension.current = 0;
    setPhaseRemaining(remaining);
    setHoldBudget(remaining);
    setStepIndex(Math.max(0, stepCount - 1));
    setCueIndex(0);
    setPhase("hold");
  }, [current, voiceDuration, voiceEnabled, stepCount]);

  // When narration audio ends → side switch (if "each" and on side 1) or hold.
  const onVoiceEnded = useCallback(() => {
    if (isEach && side === 1) {
      setPhase("sideSwitch");
      setPhaseRemaining(SIDE_SWITCH_SECONDS);
      playChime();
      speak("Switch sides.");
    } else {
      enterHold();
    }
  }, [isEach, side, enterHold, speak]);

  // ---- master 1s tick -------------------------------------------------------
  useEffect(() => {
    if (!started || paused || finished) return;
    const t = setInterval(() => {
      setElapsedTotal((e) => e + 1);
      setRemainingEstimate((r) => Math.max(0, r - 1));

      setPhaseRemaining((r) => {
        // instruction phase with working voice is driven by audio, not this countdown
        if (phase === "instruction" && voiceEnabled && !audioBrokenRef.current) return r;

        if (r <= 1) {
          if (phase === "transitionIn") {
            startInstruction(1);
            return 0;
          }
          if (phase === "instruction") {
            // muted path
            onVoiceEnded();
            return 0;
          }
          if (phase === "sideSwitch") {
            startInstruction(2);
            return 0;
          }
          if (phase === "hold") {
            if (index + 1 >= todays.length) {
              finish();
            } else {
              goToPose(index + 1);
            }
            return 0;
          }
        }
        // silent instruction phase (voice off or narration missing): cycle steps
        if (phase === "instruction" && (!voiceEnabled || audioBrokenRef.current)) {
          const elapsed = SILENT_INSTRUCTION - (r - 1);
          const idx = Math.min(stepCount - 1, Math.floor((elapsed / SILENT_INSTRUCTION) * stepCount));
          setStepIndex(idx);
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [
    started,
    paused,
    finished,
    phase,
    voiceEnabled,
    index,
    todays.length,
    startInstruction,
    onVoiceEnded,
    goToPose,
    finish,
    stepCount,
  ]);

  // Slow-cycling form + breath cues during the hold phase (every 5s).
  useEffect(() => {
    if (phase !== "hold" || paused || finished) return;
    setCueIndex(0);
    const t = setInterval(
      () => setCueIndex((c) => (c + 1) % Math.max(1, holdCues.length)),
      5000,
    );
    return () => clearInterval(t);
  }, [phase, paused, finished, holdCues]);

  // Kick off the first transition once the session actually starts.
  useEffect(() => {
    if (started && !finished && index === 0 && phase === "transitionIn" && phaseRemaining === TRANSITION_SECONDS) {
      // ensure the opening chime + speech fire once
    }
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- pause / resume of underlying audio -----------------------------------
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (paused) {
      a.pause();
      try {
        window.speechSynthesis?.pause();
      } catch {
        /* ignore */
      }
    } else if (started && phase === "instruction" && voiceEnabled && !finished) {
      const p = a.play();
      if (p && typeof p.then === "function") p.catch(() => {});
      try {
        window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
    }
  }, [paused, started, phase, voiceEnabled, finished]);

  // ---- controls -------------------------------------------------------------
  const beginSession = () => {
    void unlockAudio();
    setStarted(true);
    setIndex(0);
    setElapsedTotal(0);
    setPaused(false);
    sessionLogged.current = false;
    loggedSeconds.current = 0;
    pendingExtension.current = 0;
    setPostMood(null);
    enterTransition(0);
  };

  const handleSkip = () => {
    if (index + 1 >= todays.length) finish();
    else goToPose(index + 1);
  };
  const handlePrev = () => {
    if (index === 0) enterTransition(0);
    else goToPose(index - 1);
  };
  const handleAdd30 = () => {
    if (phase === "hold" || phase === "transitionIn" || phase === "sideSwitch") {
      setPhaseRemaining((r) => r + 30);
      if (phase === "hold") setHoldBudget((b) => b + 30);
    } else {
      // During narration the countdown is audio-driven; bank the extension so
      // the upcoming hold actually gets the extra time.
      pendingExtension.current += 30;
    }
    toast({ title: "+30 seconds", description: "Extended this hold." });
  };

  const attemptExit = () => {
    if (finished) {
      clear();
      navigate("/");
      return;
    }
    setConfirmExit(true);
  };

  // ---- empty state: practice hub -------------------------------------------
  if (todays.length === 0 && !finished) {
    return (
      <div className="animate-fade-in space-y-8" data-testid="practice-hub">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Start practice</h1>
          <p className="text-muted-foreground">
            Ask the Yoga Trainer, choose how you feel, warm up, or open a pathway — then begin a guided voice session.
          </p>
        </header>

        <Card className="border-primary/30 bg-accent/40 shadow-soft" data-testid="hub-trainer">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-serif text-xl">Yoga Trainer</p>
              <p className="text-sm text-muted-foreground">
                Four quick questions → a practice shaped for your body today.
              </p>
            </div>
            <Button asChild data-testid="button-hub-trainer">
              <Link href="/trainer">Meet your trainer</Link>
            </Button>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="font-serif text-xl">How do you feel?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_SESSIONS.map((q) => {
              const Icon = q.icon;
              return (
                <Card key={q.id} className="shadow-soft" data-testid={`hub-quick-${q.id}`}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-serif text-lg leading-tight">{q.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {q.time} · {q.intent}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => startQuickSession(q)} data-testid={`button-hub-begin-${q.id}`}>
                      Begin
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card className="border-primary/30 bg-accent/40 shadow-soft">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                <p className="font-serif text-lg">5-min warm-up</p>
              </div>
              <p className="text-sm text-muted-foreground">Wake the spine before a longer flow.</p>
              <Button onClick={startWarmup} data-testid="button-hub-warmup">
                <Play className="mr-1.5 h-4 w-4" /> Start warm-up
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <RouteIcon className="h-4 w-4 text-secondary" />
                <p className="font-serif text-lg">Pathways</p>
              </div>
              <p className="text-sm text-muted-foreground">Quick flows, challenges, and programs.</p>
              <Button asChild variant="outline" data-testid="button-hub-pathways">
                <Link href="/pathways">Browse pathways</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-secondary" />
                <p className="font-serif text-lg">Build your own</p>
              </div>
              <p className="text-sm text-muted-foreground">Pick poses from the library or Builder.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" data-testid="button-go-library">
                  <Link href="/asanas">Library</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" data-testid="button-hub-builder">
                  <Link href="/builder">Builder</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  // ---- completion card ------------------------------------------------------
  if (finished) {
    const reflection =
      preMood && postMood ? `You moved from ${preMood} → ${postMood}. Beautiful.` : null;
    return (
      <>
        <Confetti active={confetti} />
        <MoodCheckIn
          open={showPostMood}
          title="How do you feel now?"
          description="Optional — notice the shift in your body and mind."
          confirmLabel="Skip"
          testIdPrefix="postmood"
          onPick={(m) => {
            setPostMood(m);
            setShowPostMood(false);
            finalizeSession(m);
          }}
          onSkip={() => {
            setShowPostMood(false);
            finalizeSession(null);
          }}
        />
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
          data-testid="guided-complete"
        >
          <div className="text-6xl">🙏</div>
          <h1 className="font-serif text-4xl">Beautiful practice</h1>
          <div className="flex gap-8 text-center">
            <div>
              <p className="font-serif text-3xl tabular-nums text-primary" data-testid="text-complete-minutes">
                {finishedMinutes.current}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">minutes</p>
            </div>
            <div>
              <p className="font-serif text-3xl tabular-nums text-primary" data-testid="text-complete-poses">
                {posesCompleted.current}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">poses</p>
            </div>
          </div>
          {meta.pathwaySlug && (
            <p className="text-sm text-muted-foreground">Day marked complete · {meta.label}</p>
          )}
          {reflection && (
            <p className="font-serif text-lg text-primary" data-testid="text-mood-reflection">
              {reflection}
            </p>
          )}
          {saveFailed && (
            <Button
              onClick={() => finalizeSession(lastPostMood.current)}
              disabled={saving}
              data-testid="button-retry-save"
            >
              Retry save
            </Button>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              size="lg"
              onClick={async () => {
                if (!showPostMood && !sessionLogged.current) {
                  await finalizeSession(postMood);
                }
                // Only leave if the session actually persisted (or was already logged).
                if (sessionLogged.current) {
                  clear();
                  navigate("/");
                }
              }}
              data-testid="button-log-continue"
              disabled={saving}
            >
              Done — back home
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                if (!showPostMood && !sessionLogged.current) {
                  await finalizeSession(postMood);
                }
                if (sessionLogged.current) {
                  const title = meta.label ?? "Practice reflection";
                  clear();
                  navigate(`/journal?new=1&title=${encodeURIComponent(title)}`);
                }
              }}
              data-testid="button-journal-prompt"
              disabled={saving}
            >
              <NotebookPen className="mr-1.5 h-4 w-4" /> Reflect in journal
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                // "Do one more pose" — restart from the last pose for another round.
                sessionLogged.current = false;
                setFinished(false);
                setShowPostMood(false);
                setConfetti(false);
                const lastIdx = Math.max(0, todays.length - 1);
                setStarted(true);
                setPaused(false);
                setIndex(lastIdx);
                enterTransition(lastIdx);
              }}
              data-testid="button-one-more"
            >
              Do one more pose
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ---- pre-start: pre-mood check-in, then auto-begin ------------------------
  if (!started) {
    return (
      <>
        <MoodCheckIn
          open={showPreMood}
          title="How are you feeling?"
          description="Optional — a quick check-in before your guided flow."
          confirmLabel="Skip"
          testIdPrefix="premood"
          onPick={(m) => {
            setPreMood(m);
            setShowPreMood(false);
            beginSession();
          }}
          onSkip={() => {
            setPreMood(null);
            setShowPreMood(false);
            beginSession();
          }}
        />
        <div className="animate-fade-in flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <MicVocal className="h-10 w-10 text-primary" />
          <h1 className="font-serif text-3xl">Guided session</h1>
          <p className="max-w-md text-muted-foreground">
            {meta.label ? `${meta.label} · ` : ""}
            {todays.length} poses · a continuous voice-narrated flow.
          </p>
          {/* Guided is primary; timer-only is the secondary mode */}
          <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-sm" data-testid="mode-toggle">
            <button
              className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
              data-testid="toggle-guided"
              aria-pressed="true"
            >
              Guided
            </button>
            <button
              onClick={() => navigate("/practice")}
              className="rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
              data-testid="toggle-simple"
            >
              Timer only
            </button>
          </div>
          {!voiceEnabled && (
            <p className="text-xs text-muted-foreground">
              Voice is off in your settings — this flow will run with chimes + captions only.
            </p>
          )}
          <Button size="lg" onClick={beginSession} data-testid="button-begin-guided">
            <Play className="mr-2 h-5 w-5" /> Begin
          </Button>
        </div>
      </>
    );
  }

  // ---- running screen -------------------------------------------------------
  const progress = todays.length > 0 ? (index / todays.length) * 100 : 0;
  const isHold = phase === "hold";
  const bottomCountdown =
    phase === "transitionIn"
      ? phaseRemaining
      : phase === "sideSwitch"
        ? phaseRemaining
        : isHold
          ? phaseRemaining
          : // instruction: show remaining hold estimate (voice + hold)
            (current?.holdSeconds ?? 0) - Math.round(voiceEnabled ? audioRef.current?.currentTime ?? 0 : 0);

  const activeCaption =
    phase === "transitionIn"
      ? `Get ready… Next: ${current?.english ?? ""}`
      : phase === "sideSwitch"
        ? "Switch sides"
        : isHold
          ? holdCues[cueIndex % holdCues.length]
          : steps[stepIndex]?.text ?? "";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="guided-session"
    >
      <audio
        ref={audioRef}
        src={src}
        preload={voiceEnabled ? "metadata" : "none"}
        data-testid="guided-audio"
        onLoadedMetadata={(e) => setVoiceDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          if (phase !== "instruction") return;
          const a = e.target as HTMLAudioElement;
          if (a.duration > 0) {
            const idx = Math.min(stepCount - 1, Math.floor((a.currentTime / a.duration) * stepCount));
            setStepIndex(idx);
          }
        }}
        onEnded={onVoiceEnded}
        onError={() => {
          // Narration can't load (fires during preload, possibly before the
          // instruction phase starts). Flag it; if we're already mid-instruction
          // switch to the silent reading window instead of hanging.
          audioBrokenRef.current = true;
          if (phase === "instruction") setPhaseRemaining(SILENT_INSTRUCTION);
        }}
      />

      {/* ── TOP STRIP ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" data-testid="text-session-name">
            {meta.label ?? "Guided flow"}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-accent/50">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
              data-testid="guided-progress"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pose {index + 1} of {todays.length}
          </p>
        </div>
        <button
          onClick={attemptExit}
          className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          data-testid="button-exit-guided"
          aria-label="Exit session"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* ── MIDDLE (the star) ─────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {/* prev thumb */}
        {prev && (
          <div className="absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-1 opacity-40 sm:flex">
            <img
              src={`${import.meta.env.BASE_URL}poses/${prev.slug}.png`}
              alt={prev.english}
              className="h-20 w-20 rounded-xl object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              data-testid="thumb-prev"
            />
            <span className="max-w-[6rem] truncate text-center text-xs text-muted-foreground">
              {prev.english}
            </span>
          </div>
        )}
        {/* next thumb */}
        {next && (
          <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-1 opacity-40 sm:flex">
            <img
              src={`${import.meta.env.BASE_URL}poses/${next.slug}.png`}
              alt={next.english}
              className="h-20 w-20 rounded-xl object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              data-testid="thumb-next"
            />
            <span className="max-w-[6rem] truncate text-center text-xs text-muted-foreground">
              {next.english}
            </span>
          </div>
        )}

        <div className="flex w-full max-w-lg flex-col items-center">
          <div
            className={cn(
              "relative flex h-[46vh] w-full items-center justify-center transition-opacity duration-500 ease-out",
              imgVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {current && poseMedia && (
              <PoseDemoStage
                key={current.slug}
                slug={current.slug}
                english={current.english}
                sanskrit={current.sanskrit}
                poseKey={current.pose}
                media={poseMedia}
                preferVideo={poseHasVideo(current.slug)}
                playing={!paused && (phase === "instruction" || phase === "hold")}
                focusZone={activeZone}
                variant="practice"
                data-testid="guided-hero"
              />
            )}
          </div>

          <h1 className="mt-3 font-serif text-3xl" data-testid="text-current-pose">
            {current?.english}
            {isEach && (
              <span className="ml-2 text-base text-muted-foreground">· side {side}</span>
            )}
          </h1>
          <p className="italic text-muted-foreground" data-testid="text-current-sanskrit">
            {current?.sanskrit}
          </p>
        </div>
      </div>

      {/* ── BOTTOM STRIP ──────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-4 pb-5 pt-4">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
          <span
            className="font-serif text-5xl tabular-nums"
            data-testid="guided-countdown"
          >
            {mmss(bottomCountdown)}
          </span>

          {isHold && holdBudget > 0 && (
            <div
              className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-primary/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={holdBudget}
              aria-valuenow={Math.max(0, holdBudget - phaseRemaining)}
              aria-label="Hold progress"
              data-testid="guided-hold-progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                style={{
                  width: `${Math.min(100, Math.max(0, ((holdBudget - phaseRemaining) / holdBudget) * 100))}%`,
                }}
              />
            </div>
          )}

          <p
            key={`${phase}-${stepIndex}-${cueIndex}`}
            className={cn(
              "min-h-[3rem] animate-fade-in px-2 text-center transition-all",
              isHold
                ? "text-base text-muted-foreground"
                : "text-lg font-medium text-foreground",
            )}
            data-testid="guided-caption"
          >
            {activeCaption}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              data-testid="button-prev-pose"
              aria-label="Previous pose"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              onClick={() => setPaused((p) => !p)}
              data-testid="button-pause-guided"
              className="min-w-[7rem]"
            >
              {paused ? <Play className="mr-1.5 h-5 w-5" /> : <Pause className="mr-1.5 h-5 w-5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSkip}
              data-testid="button-skip-pose"
              aria-label="Skip to next pose"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleAdd30}
              data-testid="button-add-30"
              aria-label="Add 30 seconds"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <PoseTipsTrigger onClick={() => setTipsOpen(true)} />
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TimerIcon className="h-3.5 w-3.5" />
            Time remaining in session: ~{Math.max(1, Math.round(remainingEstimate / 60))} min
          </p>
        </div>
      </div>

      <PoseTipsSheet
        asana={current}
        open={tipsOpen}
        onOpenChange={setTipsOpen}
      />

      {/* Exit confirmation */}
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the session?</AlertDialogTitle>
            <AlertDialogDescription>
              You're mid-practice. Your progress won't be logged if you leave now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-exit-cancel">Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const a = audioRef.current;
                if (a) a.pause();
                try {
                  window.speechSynthesis?.cancel();
                } catch {
                  /* ignore */
                }
                clear();
                navigate("/");
              }}
              data-testid="button-exit-confirm"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
