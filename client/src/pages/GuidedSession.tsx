// GuidedSession — a continuous, voice-narrated flow through a queued session.
//
// A single full-height screen with three vertical zones:
//   Top    — session progress bar, session name, close (X).
//   Middle — trainer demo stage (pose video when available, illustrated
//            figure fallback), prev/next thumbs, pose name.
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
import { FullScreenOverlay } from "@/components/FullScreenOverlay";
import { SavePracticeDialog } from "@/components/SavePracticePrompt";
import { declineBlocking, savePromptLevel } from "@/lib/savePracticePrompt";
import { useAuth } from "@/lib/auth";
import { todayISO, type Stats } from "@/lib/sadhana";
import { usePractice } from "@/context/PracticeContext";
import { useToast } from "@/hooks/use-toast";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { logPracticeSession } from "@/lib/logPracticeSession";
import { unlockAudio } from "@/lib/audioUnlock";
import { type Mood } from "@/data/content";
import type { Preferences } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/formatDuration";
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
  Volume2,
  VolumeX,
  RotateCcw,
  Gauge,
  Subtitles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WARMUP, asanaBySlug } from "@/data/content";
import { PoseTrainerStage } from "@/components/PoseTrainerStage";
import { momentumClass } from "@/lib/poseMomentum";
import { PoseImage } from "@/components/PoseImage";
import { PoseTipsSheet, PoseTipsTrigger } from "@/components/PoseTipsSheet";
import { poseNarrationSrc, poseHasVideo, poseMediaFor } from "@/data/poseMedia";
import { practiceHoldCues } from "@/lib/poseExplanation";
import {
  QUICK_SESSIONS,
  sessionMinutes,
  sessionTimeLabel,
  TRANSITION_SECONDS,
  SIDE_SWITCH_SECONDS,
} from "@/data/quickSessions";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNarrationTiming } from "@/hooks/use-narration-timing";
import { createVoiceController, readVoicePrefs, type VoiceCommand } from "@/lib/voiceControl";

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

/** Reading window used when narration is off or unavailable. */
const SILENT_INSTRUCTION_SECONDS = 12;
const FALLBACK_HOLD_CUES = [
  "Inhale…",
  "Exhale…",
  "Find your edge…",
  "Soften…",
  "Stay present…",
];

type Phase = "transitionIn" | "instruction" | "sideSwitch" | "hold" | "complete";

/** Live countdown uses clock notation; everything else uses formatDuration. */
const mmss = formatClock;

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
    loadSession(poses, {
      label: q.label,
      plannedMinutes: sessionMinutes(q.poses),
      breathSlug: q.breathSlug ?? null,
      introPoseSlug: q.introPoseSlug ?? q.poses[0]?.slug ?? null,
    });
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
  // The gate is evaluated at the session boundary only — never mid-practice.
  const { isSignedIn } = useAuth();
  const { data: guestStats } = useQuery<Stats>({
    queryKey: ["/api/sessions/stats", todayISO()],
  });
  const [guestAcknowledged, setGuestAcknowledged] = useState(false);
  const voiceEnabled = prefs ? prefs.voiceEnabled !== 0 : true;

  // ---- flow state -----------------------------------------------------------
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("transitionIn");
  const [side, setSide] = useState<1 | 2>(1); // which side we're on for "each" poses
  const [phaseRemaining, setPhaseRemaining] = useState(TRANSITION_SECONDS); // seconds
  const [holdBudget, setHoldBudget] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  // 0–1 through the spoken step — drives limb interpolation on rigged poses.
  const [stepProgress, setStepProgress] = useState(1);
  const [paused, setPaused] = useState(false);
  // Session-local narration mute — independent of the saved `voiceEnabled`
  // preference, so silencing the voice for one practice (e.g. to use your own
  // music) doesn't rewrite the user's global setting.
  const [muted, setMuted] = useState(false);
  /** Playback pace for narration + countdown (0.75 / 1 / 1.25). */
  const [pace, setPace] = useState<0.75 | 1 | 1.25>(1);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [imgVisible, setImgVisible] = useState(true); // crossfade toggle
  const [cueIndex, setCueIndex] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(false);

  // ---- premium: breath cycle + image key for crossfade ----------------------
  const [confirmExit, setConfirmExit] = useState(false);

  // ---- completion / mood state ----------------------------------------------
  const [finished, setFinished] = useState(false);
  // Suppressed when an upstream flow (the Trainer) already collected it.
  const [showPreMood, setShowPreMood] = useState(!meta.preMood);
  const [showPostMood, setShowPostMood] = useState(false);
  const [preMood, setPreMood] = useState<Mood | null>(meta.preMood ?? null);
  const [postMood, setPostMood] = useState<Mood | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [showRpe, setShowRpe] = useState(false);
  const [started, setStarted] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPostMood = useRef<Mood | null>(null);
  const finishedMinutes = useRef(1);
  const sessionLogged = useRef(false);
  useWakeLock(started && !paused && !finished);
  const posesCompleted = useRef(0);
  // Indices the practitioner skipped past rather than held. Logging a
  // skipped-through session as "8 poses" was a lie the journal couldn't undo.
  const skippedIndices = useRef<Set<number>>(new Set());
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
  // Bumped when instruction (narration) starts so the muted demo clip restarts
  // in sync with this pose's /voice/pose-{slug}.mp3.
  const [videoRestartToken, setVideoRestartToken] = useState(0);

  const current = todays[index];
  const prev = index > 0 ? todays[index - 1] : null;
  const next = index + 1 < todays.length ? todays[index + 1] : null;
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
    const href = poseNarrationSrc(next.slug);
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

  const src = current ? poseNarrationSrc(current.slug) : "";

  // Per-step narration boundaries — replaces dividing the audio evenly, which
  // put the focus halo and camera on the wrong words for uneven step texts.
  const stepTexts = useMemo(() => steps.map((s) => s.text), [steps]);
  const { resolve: resolveStep } = useNarrationTiming(
    current?.slug ?? "",
    stepTexts,
    voiceEnabled && !audioBrokenRef.current ? voiceDuration : SILENT_INSTRUCTION_SECONDS,
  );

  // Focus + step metadata for 3D moments during instruction.
  const activeMomentum = momentumClass(
    phase === "instruction" || phase === "hold" ? steps[stepIndex] : null,
  );
  const activeStepPose =
    phase === "instruction"
      ? steps[stepIndex]?.pose || current?.pose
      : current?.pose;

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
      if (!voiceEnabled || muted) return;
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
    [voiceEnabled, muted],
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
    async (resolvedPost: Mood | null, resolvedRpe: number | null = rpe) => {
      if (sessionLogged.current || saving) return;
      lastPostMood.current = resolvedPost;
      setSaving(true);
      setSaveFailed(false);
      const minutes = finishedMinutes.current;
      const poseNames = todays.map((a) => a.english);
      const sessionLabel = meta.label ?? "Guided session";

      const result = await logPracticeSession({
        minutes,
        plannedMinutes: meta.plannedMinutes ?? null,
        poseNames,
        posesCompleted: posesCompleted.current,
        posesSkipped: skippedIndices.current.size,
        label: sessionLabel,
        pathwaySlug: meta.pathwaySlug ?? null,
        preMood,
        postMood: resolvedPost,
        rpe: resolvedRpe,
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
    [todays, meta, preMood, rpe, toast, saving, saveProgress],
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
    posesCompleted.current = Math.max(0, todays.length - skippedIndices.current.size);
    const newSeconds = Math.max(0, elapsedTotal - loggedSeconds.current);
    loggedSeconds.current = elapsedTotal;
    const minutes = Math.max(1, Math.round(newSeconds / 60));
    finishedMinutes.current = minutes;
    setConfetti(true);
    setTimeout(() => setConfetti(false), 2800);
    playChime();
    // Let the summary land first. Opening the mood dialog immediately covered
    // "Beautiful practice / 5 minutes / 8 poses" — the thing they just earned —
    // with another question.
    setTimeout(() => setShowPostMood(true), 2200);
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
  const SILENT_INSTRUCTION = SILENT_INSTRUCTION_SECONDS;

  const startInstruction = useCallback(
    (whichSide: 1 | 2) => {
      setPhase("instruction");
      setSide(whichSide);
      setStepIndex(0);
      // Restart muted pose video with this pose's narration (or silent guide).
      setVideoRestartToken((n) => n + 1);
      const a = audioRef.current;
      if (!voiceEnabled || audioBrokenRef.current || !a) {
        // Timer-driven walkthrough: the master tick counts this down and the
        // step captions cycle across the window.
        setPhaseRemaining(SILENT_INSTRUCTION);
        return;
      }
      a.currentTime = 0;
      a.playbackRate = pace;
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
    [voiceEnabled, pace],
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

  // Keep narration rate in sync when the practitioner changes pace mid-pose.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = pace;
  }, [pace]);

  // ---- master 1s tick -------------------------------------------------------
  useEffect(() => {
    if (!started || paused || finished) return;
    // Pace slows/fastens the wall-clock of countdowns (not engagement scoring).
    const intervalMs = Math.round(1000 / pace);
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
          const { index: idx, progress } = resolveStep(elapsed);
          setStepIndex(idx);
          setStepProgress(progress);
        }
        return r - 1;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [
    started,
    paused,
    finished,
    phase,
    pace,
    voiceEnabled,
    index,
    todays.length,
    startInstruction,
    onVoiceEnded,
    goToPose,
    finish,
    stepCount,
    resolveStep,
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
    skippedIndices.current.add(index);
    if (index + 1 >= todays.length) finish();
    else goToPose(index + 1);
  };
  const handlePrev = () => {
    if (index === 0) enterTransition(0);
    else goToPose(index - 1);
  };
  const handleRepeatCue = () => {
    if (phase === "instruction") {
      startInstruction(side);
      toast({ title: "Repeating guidance", description: "Playing this pose’s cues again." });
      return;
    }
    if (phase === "hold") {
      setCueIndex(0);
      toast({ title: "Cue restarted", description: "Form cues will cycle from the top." });
      return;
    }
    enterTransition(index);
  };
  const cyclePace = () => {
    setPace((p) => (p === 1 ? 1.25 : p === 1.25 ? 0.75 : 1));
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

  // Auto-pause when the tab is hidden so timers/audio don't run off-screen.
  useEffect(() => {
    if (!started || finished) return;
    const onVis = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [started, finished]);

  // Hands-free voice commands (opt-in via Settings / voice prefs).
  useEffect(() => {
    if (!started || finished || !readVoicePrefs().enabled) return;
    const apply = (cmd: VoiceCommand) => {
      if (cmd === "pause") setPaused(true);
      else if (cmd === "resume") setPaused(false);
      else if (cmd === "repeat") handleRepeatCue();
      else if (cmd === "skip") handleSkip();
      else if (cmd === "slower") setPace((p) => (p === 1.25 ? 1 : 0.75));
      else if (cmd === "faster") setPace((p) => (p === 0.75 ? 1 : 1.25));
      else if (cmd === "modification") setTipsOpen(true);
      else if (cmd === "stop") setConfirmExit(true);
    };
    const ctrl = createVoiceController({
      onCommand: (cmd) => {
        apply(cmd);
        toast({ title: `Voice: ${cmd}`, description: "Hands-free control" });
      },
      onError: (message) => toast({ title: "Voice control", description: message, variant: "destructive" }),
    });
    ctrl.start();
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished]);

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
                          {sessionTimeLabel(q.poses)} · {q.intent}
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
      <FullScreenOverlay label="Practice complete">
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
            setShowRpe(true);
          }}
          onSkip={() => {
            setShowPostMood(false);
            setShowRpe(true);
          }}
        />
        {showRpe && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-6"
            role="dialog"
            aria-label="Rate of perceived exertion"
            data-testid="rpe-dialog"
          >
            <div className="w-full max-w-md space-y-4 text-center">
              <h2 className="font-serif text-2xl">How hard did that feel?</h2>
              <p className="text-sm text-muted-foreground">
                Rate of perceived exertion (1 easy – 10 maximal). Used only to ease tomorrow’s plan.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    className="min-h-11 min-w-11"
                    variant={rpe === n ? "default" : "outline"}
                    onClick={() => setRpe(n)}
                    data-testid={`rpe-${n}`}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  className="min-h-11"
                  variant="outline"
                  onClick={() => {
                    setShowRpe(false);
                    void finalizeSession(postMood, null);
                  }}
                >
                  Skip
                </Button>
                <Button
                  className="min-h-11"
                  disabled={rpe == null}
                  onClick={() => {
                    setShowRpe(false);
                    void finalizeSession(postMood, rpe);
                  }}
                  data-testid="rpe-confirm"
                >
                  Save effort
                </Button>
              </div>
            </div>
          </div>
        )}
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
          data-testid="guided-complete"
        >
          {/* Was a 🙏 emoji — a third visual language in a flow that already
              had watercolour illustrations and the player's wireframes. Close
              on the same illustration the rest of the app uses. */}
          <div className="h-28 w-28 overflow-hidden rounded-full bg-accent/30">
            <PoseImage
              slug="savasana"
              alt=""
              aspect="aspect-square"
              rounded="rounded-full"
              breath={false}
              shadow={false}
              thumb
              testId="complete-illustration"
            />
          </div>
          <h1 className="font-serif text-4xl">Beautiful practice</h1>
          <div className="flex gap-8 text-center">
            <div>
              <p className="font-serif text-3xl tabular-nums text-primary" data-testid="text-complete-minutes">
                {finishedMinutes.current}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {finishedMinutes.current === 1 ? "minute" : "minutes"}
              </p>
            </div>
            <div>
              <p className="font-serif text-3xl tabular-nums text-primary" data-testid="text-complete-poses">
                {skippedIndices.current.size > 0
                  ? `${posesCompleted.current}/${todays.length}`
                  : posesCompleted.current}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {skippedIndices.current.size > 0
                  ? `poses · ${skippedIndices.current.size} skipped`
                  : "poses"}
              </p>
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
      </FullScreenOverlay>
    );
  }

  // ---- pre-start: pre-mood check-in, then auto-begin ------------------------
  if (!started) {
    const totalSessions = guestStats?.totalSessions ?? 0;
    const gate =
      guestAcknowledged
        ? "none"
        : savePromptLevel({ isSignedIn, totalSessions, atSessionBoundary: true });
    const blocked = gate === "blocking";

    return (
      <>
        <SavePracticeDialog
          open={blocked}
          totalSessions={totalSessions}
          currentStreak={guestStats?.currentStreak ?? 0}
          onContinueAsGuest={() => {
            declineBlocking(totalSessions);
            setGuestAcknowledged(true);
          }}
        />
        <MoodCheckIn
          open={showPreMood && !blocked}
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
          {meta.introPoseSlug && poseHasVideo(meta.introPoseSlug) && (
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft"
              data-testid="mood-intro-video"
            >
              <video
                className="aspect-video w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster={poseMediaFor(meta.introPoseSlug).poster}
                aria-label={`Illustrated intro for ${meta.label ?? "this session"}`}
              >
                <source src={poseMediaFor(meta.introPoseSlug).webm} type="video/webm" />
                <source src={poseMediaFor(meta.introPoseSlug).mp4} type="video/mp4" />
              </video>
            </div>
          )}
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
    <FullScreenOverlay label="Guided practice session">
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="guided-session"
    >
      <audio
        ref={audioRef}
        src={src}
        // Session-local mute. Kept on the element (rather than skipping
        // playback) so narration still drives step timing — silencing the voice
        // must not change the pace of the practice.
        muted={muted}
        preload={voiceEnabled ? "metadata" : "none"}
        data-testid="guided-audio"
        onLoadedMetadata={(e) => setVoiceDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          if (phase !== "instruction") return;
          const a = e.target as HTMLAudioElement;
          if (a.duration > 0) {
            const { index: idx, progress } = resolveStep(a.currentTime);
            setStepIndex(idx);
            setStepProgress(progress);
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
            {current && (
              <PoseTrainerStage
                key={current.slug}
                slug={current.slug}
                english={current.english}
                sanskrit={current.sanskrit}
                poseKey={current.pose}
                stepPoseKey={activeStepPose}
                momentum={activeMomentum}
                stepIndex={phase === "instruction" ? stepIndex : Math.max(0, stepCount - 1)}
                playing={!paused && (phase === "instruction" || phase === "hold")}
                restartToken={videoRestartToken}
                guideActive={phase === "instruction"}
                side={isEach ? (side as 1 | 2) : 1}
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
              "min-h-[3rem] animate-fade-in px-2 text-center transition-all motion-reduce:animate-none",
              isHold
                ? "text-base text-muted-foreground"
                : "text-lg font-medium text-foreground",
              !captionsOn && "sr-only",
            )}
            data-testid="guided-caption"
            aria-live="polite"
          >
            {activeCaption}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={handlePrev}
              data-testid="button-prev-pose"
              aria-label="Previous pose"
              title="Previous pose"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={handleRepeatCue}
              data-testid="button-repeat-cue"
              aria-label="Repeat current guidance"
              title="Repeat current guidance"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              onClick={() => setPaused((p) => !p)}
              data-testid="button-pause-guided"
              className="min-h-11 min-w-[7rem]"
            >
              {paused ? <Play className="mr-1.5 h-5 w-5" /> : <Pause className="mr-1.5 h-5 w-5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={handleSkip}
              data-testid="button-skip-pose"
              aria-label="Skip to next pose"
              title="Skip to next pose"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={handleAdd30}
              data-testid="button-add-30"
              aria-label="Add 30 seconds"
              title="Add 30 seconds to this hold"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={() => setMuted((m) => !m)}
              data-testid="button-mute-guided"
              aria-label={muted ? "Unmute narration" : "Mute narration"}
              aria-pressed={muted}
              title={muted ? "Unmute narration" : "Mute narration"}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={cyclePace}
              data-testid="button-pace-guided"
              aria-label={`Practice pace ${pace}x. Tap to change.`}
              title={`Pace ${pace}×`}
            >
              <Gauge className="h-5 w-5" />
              <span className="sr-only">Pace {pace}×</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={() => setCaptionsOn((c) => !c)}
              data-testid="button-captions-guided"
              aria-label={captionsOn ? "Hide captions" : "Show captions"}
              aria-pressed={captionsOn}
              title={captionsOn ? "Hide captions" : "Show captions"}
            >
              <Subtitles className="h-5 w-5" />
            </Button>
            <PoseTipsTrigger onClick={() => setTipsOpen(true)} />
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="guided-pace-label">
            <TimerIcon className="h-3.5 w-3.5" />
            ~{Math.max(1, Math.round(remainingEstimate / 60))} min left · pace {pace}×
            {side === 2 ? " · side 2" : isEach ? " · side 1" : ""}
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
    </FullScreenOverlay>
  );
}
