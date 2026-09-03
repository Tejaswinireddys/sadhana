// GuidedSession — a continuous, voice-narrated flow through a queued session.
//
// A single full-height screen with three vertical zones:
//   Top    — session progress bar, session name, close (X).
//   Middle — trainer demo stage (pose video when available, illustrated
//            figure fallback), prev/next thumbs, pose name.
//   Bottom — countdown, synced step / form cues, transport, pose-tips button.
//
// State machine per pose:
//   transitionIn (5s, chime; optional robot "Next: …")  →
//   instruction (cue list + voice, halo tracks steps)   →
//   sideSwitch (2s, only when sides === "each") → instruction (side 2) →
//   hold (breath-synced countdown + form cues) →
//   next pose transitionIn … → complete.
//
// Narration priority per pose:
//   (a) human MP3 from media manifest → (b) neural MP3 / server TTS cache →
//   (c) browser speechSynthesis only if allowRobotVoice → (d) silent captions.
// Mute stops voice but keeps the timer; pace is Slow / Normal.
//
// Screen readers: a dedicated polite live region announces pose name + cue on
// change, the last 10 seconds of a hold once, and session start / pause /
// resume / complete. The on-screen caption is visual only (it includes a
// breath label that ticks every second).
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
import { SavePracticeCompleteCard } from "@/components/SavePracticePrompt";
import { declineBlocking, savePromptLevel } from "@/lib/savePracticePrompt";
import { useAuth } from "@/lib/auth";
import { todayISO, type Stats } from "@/lib/sadhana";
import { usePractice } from "@/context/PracticeContext";
import { useToast } from "@/hooks/use-toast";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { buildJournalEntry, logPracticeSession } from "@/lib/logPracticeSession";
import { estimateBreathCount } from "@/lib/sessionBreaths";
import { captureProduct } from "@/lib/productAnalytics";
import { sessionCredit, sessionExitCopy, sessionHeadline, type SessionCredit } from "@/lib/sessionCredit";
import { guidedClockFrozen } from "@/lib/guidedClock";
import {
  GUIDED_SR,
  cueTextForGuidedPhase,
  poseAndCueAnnouncement,
  shouldAnnounceHoldEndingOnce,
  withSessionStarted,
} from "@/lib/guidedLiveAnnounce";
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
import { practiceHoldCues } from "@/lib/poseExplanation";
import {
  fetchPoseMedia,
  invalidatePoseMedia,
  manifestToVideoSources,
  usePoseMedia,
} from "@/lib/poseMediaApi";
import { preloadPoseVideo, clearPreloadedPoseVideo } from "@/lib/videoPreload";
import { StreamVideo } from "@/components/StreamVideo";
import {
  QUICK_SESSIONS,
  preSessionSummary,
  quickSessionMeta,
  sessionMinutes,
  sessionTimeLabel,
  TRANSITION_SECONDS,
  SIDE_SWITCH_SECONDS,
} from "@/data/quickSessions";
import { resolvePreMood, shouldAskPreMood } from "@/lib/moods";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { resolveStepAt } from "@/lib/narrationTiming";
import { cuesToStepTimings, type NarrationCue } from "@/lib/narrationCues";
import { breathAt } from "@/lib/breathCycle";
import {
  ensureNeuralNarration,
  resolveNarrationPlayback,
  type NarrationPlayback,
} from "@/lib/narrationPlayback";
import { createSpeechCuePlayer, type SpeechCuePlayer } from "@/lib/speechCuePlayer";
import { createVoiceController, readVoicePrefs, type VoiceCommand } from "@/lib/voiceControl";

// ---- soft chime (shared with Practice) --------------------------------------
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const schedule = () => scheduleChimeTones(ctx);
    if (ctx.state === "suspended") {
      void ctx.resume().then(schedule).catch(() => ctx.close().catch(() => {}));
    } else {
      schedule();
    }
  } catch {
    /* ignore audio errors */
  }
}

function scheduleChimeTones(ctx: AudioContext) {
  try {
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
    setTimeout(() => ctx.close().catch(() => {}), 2200);
  } catch {
    /* ignore audio errors */
  }
}

/** Reading window used when narration is off or unavailable. */
const SILENT_INSTRUCTION_SECONDS = 12;
/** Dual-layer pose swap duration — matches PoseHumanStage. */
const CROSSFADE_MS = 700;
/** Hide transport / chrome after this idle window on hold. */
const IDLE_CHROME_MS = 3200;
const FALLBACK_HOLD_CUES = [
  "Inhale…",
  "Exhale…",
  "Find your edge…",
  "Soften…",
  "Stay present…",
];

type Phase = "transitionIn" | "instruction" | "sideSwitch" | "hold" | "complete";

/** Always-mounted polite live region — never display:none / aria-hidden. */
function GuidedLiveRegion({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="guided-sr-announce"
    >
      {message}
    </div>
  );
}

type StageLayer = {
  id: number;
  slug: string;
  english: string;
  sanskrit: string;
  poseKey: string;
};

/** Live countdown uses clock notation; everything else uses formatDuration. */
const mmss = formatClock;

export default function GuidedSession() {
  useDocumentTitle("Practice · Sadhana");
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
    loadSession(poses, quickSessionMeta(q));
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
  const { isSignedIn } = useAuth();
  const { data: guestStats } = useQuery<Stats>({
    queryKey: ["/api/sessions/stats", todayISO()],
  });
  const [savePromptDismissed, setSavePromptDismissed] = useState(false);
  const voiceEnabled = prefs ? prefs.voiceEnabled !== 0 : true;
  const allowRobotVoice = prefs ? prefs.allowRobotVoice === 1 : false;

  // ---- flow state -----------------------------------------------------------
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("transitionIn");
  const [side, setSide] = useState<1 | 2>(1); // which side we're on for "each" poses
  const [phaseRemaining, setPhaseRemaining] = useState(TRANSITION_SECONDS); // seconds
  const [holdBudget, setHoldBudget] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  // 0–1 through the spoken step — drives limb interpolation on rigged poses.
  const [stepProgress, setStepProgress] = useState(1);
  const [narrationTime, setNarrationTime] = useState(0);
  const [paused, setPaused] = useState(false);
  // Session-local narration mute — independent of the saved `voiceEnabled`
  // preference, so silencing the voice for one practice (e.g. to use your own
  // music) doesn't rewrite the user's global setting.
  const [muted, setMuted] = useState(false);
  /** Playback pace: Slow (0.75) / Normal (1). Voice commands may set 1.25. */
  const [pace, setPace] = useState<0.75 | 1 | 1.25>(1);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [srMessage, setSrMessage] = useState("");
  const srQueueRef = useRef<string[]>([]);
  const srTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartAnnouncedRef = useRef(false);
  const lastSrPoseRef = useRef("");
  const holdEndingAnnouncedRef = useRef(false);
  const prevPausedRef = useRef<boolean | null>(null);
  const [playback, setPlayback] = useState<NarrationPlayback | null>(null);
  const [breathLabel, setBreathLabel] = useState("Inhale…");
  const holdElapsedRef = useRef(0);
  const speechPlayerRef = useRef<SpeechCuePlayer | null>(null);
  const silentElapsedRef = useRef(0);
  const instructionModeRef = useRef<"mp3" | "speech" | "silent">("silent");
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [stageLayers, setStageLayers] = useState<StageLayer[]>([]);
  const stageIdRef = useRef(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cueIndex, setCueIndex] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  /** Pause button *or* the leave dialog — both freeze countdown, voice, and advance. */
  const clockFrozen = guidedClockFrozen(paused, confirmExit);
  const holdSecondsRef = useRef(0);
  const finishedBreaths = useRef(0);
  const exitTriggerRef = useRef<HTMLButtonElement | null>(null);
  const motionPrefOn = prefs ? prefs.motionEnabled !== 0 : true;
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smoothCrossfade = motionPrefOn && !reduceMotion;

  // ---- completion / mood state ----------------------------------------------
  const [finished, setFinished] = useState(false);
  // Skip when mood is already known (Trainer energy, or a Home mood-session tap).
  const knownPreMood = resolvePreMood(meta.preMood, meta.label);
  const [showPreMood, setShowPreMood] = useState(shouldAskPreMood(knownPreMood));
  const [showPostMood, setShowPostMood] = useState(false);
  const [preMood, setPreMood] = useState<Mood | null>(knownPreMood);
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
  useWakeLock(started && !clockFrozen && !finished);
  const posesCompleted = useRef(0);
  // Indices the practitioner skipped past rather than held. Logging a
  // skipped-through session as "8 poses" was a lie the journal couldn't undo.
  const skippedIndices = useRef<Set<number>>(new Set());
  const completedIndices = useRef<Set<number>>(new Set());
  const holdElapsed = useRef(0);
  const elapsedRef = useRef(0);
  const creditRef = useRef(sessionCredit({
    holdSeconds: 0,
    elapsedSeconds: 0,
    posesCompleted: 0,
    posesSkipped: 0,
    posesTotal: 0,
  }));
  const [endedEarly, setEndedEarly] = useState(false);
  const [credited, setCredited] = useState(true);
  // Seconds already attributed to a logged session — lets "Do one more pose"
  // log only the *additional* time instead of double-counting the whole run.
  const loggedSeconds = useRef(0);
  // +30s pressed outside the hold phase: bank it and apply when the hold starts.
  const pendingExtension = useRef(0);

  const announce = useCallback((text: string) => {
    const nextMsg = text.trim();
    if (!nextMsg) return;
    const play = (msg: string) => {
      setSrMessage((prevMsg) => {
        const prev = prevMsg.replace(/\u00a0/g, "").trimEnd();
        if (prev === msg) return prevMsg;
        return msg;
      });
    };
    if (srTimerRef.current != null) {
      srQueueRef.current.push(nextMsg);
      return;
    }
    play(nextMsg);
    const drain = () => {
      const queued = srQueueRef.current.shift();
      if (!queued) {
        srTimerRef.current = null;
        return;
      }
      play(queued);
      srTimerRef.current = setTimeout(drain, 1100);
    };
    srTimerRef.current = setTimeout(drain, 1100);
  }, []);

  useEffect(
    () => () => {
      if (srTimerRef.current) clearTimeout(srTimerRef.current);
    },
    [],
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // True when this pose's narration failed to load/play. The instruction phase
  // then runs on the silent countdown instead of waiting forever for audio.
  const audioBrokenRef = useRef(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  // Bumped when instruction (narration) starts so the muted demo clip restarts
  // in sync with this pose's /audio/pose-{slug}.mp3 (via media manifest).
  const [videoRestartToken, setVideoRestartToken] = useState(0);

  const current = todays[index];
  const prev = index > 0 ? todays[index - 1] : null;
  const next = index + 1 < todays.length ? todays[index + 1] : null;
  const { data: currentMedia } = usePoseMedia(current?.slug);
  const { data: introMedia } = usePoseMedia(meta.introPoseSlug || undefined);
  const introVideo = useMemo(
    () => (meta.introPoseSlug ? manifestToVideoSources(meta.introPoseSlug, introMedia) : null),
    [meta.introPoseSlug, introMedia],
  );
  // Keep premood in sync if a mood session is loaded onto this already-mounted page.
  useEffect(() => {
    if (started) return;
    const known = resolvePreMood(meta.preMood, meta.label);
    setPreMood(known);
    setShowPreMood(shouldAskPreMood(known));
  }, [meta.preMood, meta.label, started]);
  const holdCues = useMemo(
    () => (current ? practiceHoldCues(current) : FALLBACK_HOLD_CUES),
    [current],
  );
  const stepTexts = useMemo(() => (current?.steps ?? []).map((s) => s.text), [current]);

  // Resolve cue list + playback kind whenever the pose / prefs / manifest change.
  useEffect(() => {
    if (!current) {
      setPlayback(null);
      return;
    }
    // While the manifest query is in flight, optimistically use the neural
    // convention path so Begin → first pose doesn't briefly drop to speech.
    if (currentMedia === undefined) {
      setPlayback(
        resolveNarrationPlayback({
          manifest: {
            video: null,
            audio: {
              url: `/audio/pose-${current.slug}.mp3`,
              source: "neural",
              cues: null,
            },
          },
          stepTexts,
          voiceEnabled,
          allowRobotVoice,
        }),
      );
      return;
    }

    let cancelled = false;
    const base = resolveNarrationPlayback({
      manifest: currentMedia,
      stepTexts,
      voiceEnabled,
      allowRobotVoice,
    });
    setPlayback(base);

    if (base.kind === "silent" && voiceEnabled && !currentMedia.audio) {
      void ensureNeuralNarration(current.slug, stepTexts).then((neural) => {
        if (cancelled || !neural) return;
        invalidatePoseMedia(current.slug);
        setPlayback(neural);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [current, currentMedia, stepTexts, voiceEnabled, allowRobotVoice]);

  // Close tips when advancing so the next pose starts clean.
  useEffect(() => {
    setTipsOpen(false);
  }, [current?.slug]);

  // Prefetch the next pose narration + video during hold so transitions stay smooth.
  useEffect(() => {
    if (!next) return;
    // Warm the next clip as soon as we know it — not only in hold — so Fast 3G
    // sessions don't buffer between poses.
    if (phase === "instruction" || phase === "hold" || phase === "sideSwitch") {
      void preloadPoseVideo(next.slug);
    }
  }, [phase, next?.slug]);

  useEffect(() => {
    return () => clearPreloadedPoseVideo();
  }, []);

  useEffect(() => {
    if (phase !== "hold" || !next || !voiceEnabled) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    let link: HTMLLinkElement | null = null;
    let cancelled = false;
    void fetchPoseMedia(next.slug).then((m) => {
      if (cancelled || !m.audio?.url) return;
      link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "fetch";
      link.href = m.audio.url;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
    return () => {
      cancelled = true;
      link?.remove();
    };
  }, [phase, next, voiceEnabled]);

  const steps = current?.steps ?? [];
  const stepCount = steps.length || 1;
  const isEach = current?.sides === "each";

  const src = playback?.kind === "human" || playback?.kind === "neural" ? playback.url : "";
  const activeCues: NarrationCue[] = playback?.cues ?? [];
  const srPoseLine = poseAndCueAnnouncement(
    current?.english ?? "",
    cueTextForGuidedPhase({
      phase,
      poseName: current?.english ?? "",
      instructionCue: activeCues[stepIndex]?.text || steps[stepIndex]?.text || "",
      holdCue: holdCues[cueIndex % Math.max(1, holdCues.length)] ?? "",
    }),
  );
  const cueDuration =
    voiceEnabled && !audioBrokenRef.current && voiceDuration > 0
      ? voiceDuration
      : SILENT_INSTRUCTION_SECONDS;
  const cueTimings = useMemo(
    () => cuesToStepTimings(activeCues, cueDuration),
    [activeCues, cueDuration],
  );
  const resolveStep = useCallback(
    (time: number) => resolveStepAt(cueTimings, time),
    [cueTimings],
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

  // ---- speech-synthesis (robot voice only when allowRobotVoice) -------------
  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || muted || !allowRobotVoice) return;
      try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = Math.max(0.7, Math.min(1.3, 0.92 * pace));
        u.pitch = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    },
    [voiceEnabled, muted, allowRobotVoice, pace],
  );

  // ---- enter transition-in for a given pose index ---------------------------
  const enterTransition = useCallback(
    (i: number) => {
      const pose = todays[i];
      if (!pose) return;
      speechPlayerRef.current?.cancel();
      speechPlayerRef.current = null;
      const nextLayer: StageLayer = {
        id: ++stageIdRef.current,
        slug: pose.slug,
        english: pose.english,
        sanskrit: pose.sanskrit,
        poseKey: pose.pose,
      };
      setStageLayers((prev) => {
        if (!smoothCrossfade || prev.length === 0) return [nextLayer];
        const top = prev[prev.length - 1];
        if (top?.slug === nextLayer.slug) return prev;
        return [...prev, nextLayer].slice(-2);
      });
      setChromeVisible(true);
      setPhase("transitionIn");
      setSide(1);
      setStepIndex(0);
      setPhaseRemaining(TRANSITION_SECONDS);
      setCueIndex(0);
      audioBrokenRef.current = false;
      setVoiceDuration(0);
      playChime();
      speak(`Get ready for ${pose.english}. Take a breath, and prepare.`);
    },
    [todays, speak, smoothCrossfade],
  );

  // After cross-fade settles, keep only the top stage layer.
  useEffect(() => {
    if (stageLayers.length < 2) return;
    const t = setTimeout(() => {
      setStageLayers((prev) => (prev.length > 1 ? prev.slice(-1) : prev));
    }, CROSSFADE_MS + 40);
    return () => clearTimeout(t);
  }, [stageLayers]);

  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      // Idle hide only during calm holds — keep chrome while teaching/navigating.
      if (!clockFrozen && phase === "hold") setChromeVisible(false);
    }, IDLE_CHROME_MS);
  }, [clockFrozen, phase]);

  useEffect(() => {
    if (!started || finished) return;
    bumpChrome();
    const onPointer = () => bumpChrome();
    const onKey = () => bumpChrome();
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onPointer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [started, finished, bumpChrome]);

  // Keep chrome visible when paused or outside hold.
  useEffect(() => {
    if (clockFrozen || phase !== "hold") setChromeVisible(true);
  }, [clockFrozen, phase]);

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
    elapsedRef.current = sessionProgress.elapsedTotal ?? 0;
    holdElapsed.current = sessionProgress.holdElapsed ?? 0;
    holdSecondsRef.current = sessionProgress.holdElapsed ?? 0;
    completedIndices.current = new Set(
      sessionProgress.completedIndices ?? Array.from({ length: i }, (_, n) => n),
    );
    skippedIndices.current = new Set(sessionProgress.skippedIndices ?? []);
    sessionStartAnnouncedRef.current = true;
    setStarted(!!sessionProgress.started);
    setPaused(true);
    setShowPreMood(false);
    consumeRestoredProgress();
    toast({
      title: "Session restored",
      description: "Your guided flow was paused after a refresh. Tap Resume when ready.",
    });
  }, [needsRestore, sessionProgress, todays, consumeRestoredProgress, toast]);

  // Pose name + cue on change (never the per-second breath label).
  useEffect(() => {
    if (!started || finished) return;
    if (!srPoseLine) return;
    const msg = withSessionStarted(srPoseLine, sessionStartAnnouncedRef.current);
    sessionStartAnnouncedRef.current = true;
    if (msg === lastSrPoseRef.current) return;
    lastSrPoseRef.current = msg;
    announce(msg);
  }, [started, finished, srPoseLine, announce]);

  // Pause / resume — including tab-hide and voice commands.
  useEffect(() => {
    if (!started || finished) {
      prevPausedRef.current = paused;
      return;
    }
    if (prevPausedRef.current === null) {
      prevPausedRef.current = paused;
      if (paused) announce(GUIDED_SR.paused);
      return;
    }
    if (prevPausedRef.current === paused) return;
    prevPausedRef.current = paused;
    announce(paused ? GUIDED_SR.paused : GUIDED_SR.resumed);
  }, [paused, started, finished, announce]);

  // Last 10 seconds of a hold, once. Adding time after the warning resets it.
  useEffect(() => {
    if (!started || finished) return;
    if (phase !== "hold") {
      holdEndingAnnouncedRef.current = false;
      return;
    }
    if (phaseRemaining > 10) {
      holdEndingAnnouncedRef.current = false;
      return;
    }
    if (
      shouldAnnounceHoldEndingOnce({
        phase,
        remainingSeconds: phaseRemaining,
        alreadyAnnounced: holdEndingAnnouncedRef.current,
      })
    ) {
      holdEndingAnnouncedRef.current = true;
      announce(GUIDED_SR.holdEnding);
    }
  }, [started, finished, phase, phaseRemaining, announce]);

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
      holdElapsed: holdElapsed.current,
      completedIndices: [...completedIndices.current],
      skippedIndices: [...skippedIndices.current],
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
      if (!creditRef.current.counts) {
        sessionLogged.current = true;
        saveProgress(null);
        return;
      }
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
        breathCount: finishedBreaths.current,
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

  const creditNow = (): SessionCredit =>
    sessionCredit({
      holdSeconds: holdElapsed.current,
      elapsedSeconds: elapsedRef.current,
      posesCompleted: completedIndices.current.size,
      posesSkipped: skippedIndices.current.size,
      posesTotal: todays.length,
    });

  const finish = useCallback((opts?: { endedEarly?: boolean }) => {
    const a = audioRef.current;
    if (a) a.pause();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    const early = !!opts?.endedEarly;
    const credit = creditNow();
    creditRef.current = credit;
    posesCompleted.current = credit.posesCompleted;
    const newSeconds = Math.max(0, elapsedRef.current - loggedSeconds.current);
    loggedSeconds.current = elapsedRef.current;
    finishedMinutes.current = credit.counts
      ? Math.max(1, Math.round(newSeconds / 60) || credit.minutes)
      : Math.max(0, Math.round(newSeconds / 60));
    setEndedEarly(early);
    setCredited(credit.counts);
    setPhase("complete");
    setFinished(true);
    setChromeVisible(true);
    finishedBreaths.current = estimateBreathCount(
      holdSecondsRef.current,
      meta.breathSlug ?? null,
    );
    if (credit.counts) {
      setConfetti(!early);
      setTimeout(() => setConfetti(false), 2800);
      playChime();
      setTimeout(() => {
        void finalizeSession(lastPostMood.current, rpe);
      }, 1200);
    } else {
      sessionLogged.current = true;
      saveProgress(null);
    }
  }, [todays.length, meta.breathSlug, finalizeSession, rpe, saveProgress]);

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
      setStepProgress(0);
      setNarrationTime(0);
      silentElapsedRef.current = 0;
      // Restart muted pose video with this pose's narration (or silent guide).
      setVideoRestartToken((n) => n + 1);
      speechPlayerRef.current?.cancel();
      speechPlayerRef.current = null;

      const mode =
        !voiceEnabled
          ? "silent"
          : src && !audioBrokenRef.current
            ? "mp3"
            : allowRobotVoice && activeCues.length > 0
              ? "speech"
              : "silent";
      instructionModeRef.current = mode;

      if (mode === "mp3") {
        const a = audioRef.current;
        if (!a) {
          instructionModeRef.current = allowRobotVoice ? "speech" : "silent";
          setPhaseRemaining(SILENT_INSTRUCTION);
          if (allowRobotVoice && activeCues.length) {
            speechPlayerRef.current = createSpeechCuePlayer({
              cues: activeCues,
              pace,
              muted,
              onCue: (i) => {
                setStepIndex(i);
              },
            });
            speechPlayerRef.current.tick(0);
          }
          return;
        }
        a.currentTime = 0;
        a.playbackRate = pace;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.catch((err) => {
            if ((err as DOMException)?.name === "AbortError") return;
            audioBrokenRef.current = true;
            // Fall through cleanly: robot voice or silent captions.
            if (allowRobotVoice && activeCues.length) {
              instructionModeRef.current = "speech";
              speechPlayerRef.current = createSpeechCuePlayer({
                cues: activeCues,
                pace,
                muted,
                onCue: (i) => setStepIndex(i),
              });
              speechPlayerRef.current.tick(0);
            } else {
              instructionModeRef.current = "silent";
            }
            setPhaseRemaining(SILENT_INSTRUCTION);
          });
        }
        return;
      }

      // Speech or silent: timer-driven walkthrough with synced captions.
      setPhaseRemaining(SILENT_INSTRUCTION);
      if (mode === "speech") {
        speechPlayerRef.current = createSpeechCuePlayer({
          cues: activeCues,
          pace,
          muted,
          onCue: (i) => setStepIndex(i),
        });
        speechPlayerRef.current.tick(0);
      }
    },
    [voiceEnabled, pace, src, allowRobotVoice, activeCues, muted],
  );

  const enterHold = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    speechPlayerRef.current?.cancel();
    speechPlayerRef.current = null;
    const hold = current?.holdSeconds ?? 30;
    const usedVoice =
      voiceEnabled &&
      instructionModeRef.current === "mp3" &&
      !audioBrokenRef.current;
    const vd = usedVoice ? Math.round(voiceDuration) : 0;
    const remaining = Math.max(3, hold - vd) + pendingExtension.current;
    pendingExtension.current = 0;
    setPhaseRemaining(remaining);
    setHoldBudget(remaining);
    setStepIndex(Math.max(0, stepCount - 1));
    setStepProgress(1);
    setNarrationTime(
      voiceEnabled && !audioBrokenRef.current && voiceDuration > 0
        ? voiceDuration
        : SILENT_INSTRUCTION_SECONDS,
    );
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

  // Mute stays independent of the clock. Pause *and* the leave dialog freeze
  // narration so the pose-advance scheduler cannot fire behind the modal.
  useEffect(() => {
    speechPlayerRef.current?.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    speechPlayerRef.current?.setPaused(clockFrozen);
  }, [clockFrozen]);

  // ---- master 1s tick -------------------------------------------------------
  useEffect(() => {
    if (!started || clockFrozen || finished) return;
    // Pace slows/fastens the wall-clock of countdowns (not engagement scoring).
    const intervalMs = Math.round(1000 / pace);
    const t = setInterval(() => {
      setElapsedTotal((e) => {
        const next = e + 1;
        elapsedRef.current = next;
        return next;
      });
      if (phase === "hold") holdElapsed.current += 1;
      setRemainingEstimate((r) => Math.max(0, r - 1));
      if (phase === "hold") holdSecondsRef.current += 1;

      if (phase === "hold") {
        holdElapsedRef.current += 1;
        const breath = breathAt(holdElapsedRef.current, 1);
        setBreathLabel(breath.label);
        // Advance form cues on each full breath cycle so voice/text stay aligned.
        if (holdElapsedRef.current > 0 && holdElapsedRef.current % 8 === 0) {
          setCueIndex((c) => (c + 1) % Math.max(1, holdCues.length));
        }
      }

      setPhaseRemaining((r) => {
        // MP3 instruction is driven by audio currentTime, not this countdown.
        if (phase === "instruction" && instructionModeRef.current === "mp3") return r;

        if (r <= 1) {
          if (phase === "transitionIn") {
            startInstruction(1);
            return 0;
          }
          if (phase === "instruction") {
            speechPlayerRef.current?.cancel();
            onVoiceEnded();
            return 0;
          }
          if (phase === "sideSwitch") {
            startInstruction(2);
            return 0;
          }
          if (phase === "hold") {
            completedIndices.current.add(index);
            if (index + 1 >= todays.length) {
              finish();
            } else {
              goToPose(index + 1);
            }
            return 0;
          }
        }

        // Speech / silent instruction: advance cues from elapsed media-time.
        if (phase === "instruction" && instructionModeRef.current !== "mp3") {
          silentElapsedRef.current += 1;
          const elapsed = silentElapsedRef.current;
          const { index: idx, progress } = resolveStep(elapsed);
          setStepIndex(idx);
          setStepProgress(progress);
          setNarrationTime(elapsed);
          speechPlayerRef.current?.tick(elapsed);
        }
        return r - 1;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [
    started,
    clockFrozen,
    finished,
    phase,
    pace,
    index,
    todays.length,
    startInstruction,
    onVoiceEnded,
    goToPose,
    finish,
    resolveStep,
    holdCues.length,
  ]);

  // Reset breath clock when entering hold.
  useEffect(() => {
    if (phase !== "hold") return;
    holdElapsedRef.current = 0;
    setCueIndex(0);
    setBreathLabel("Inhale…");
  }, [phase, current?.slug]);

  // Kick off the first transition once the session actually starts.
  useEffect(() => {
    if (started && !finished && index === 0 && phase === "transitionIn" && phaseRemaining === TRANSITION_SECONDS) {
      // ensure the opening chime + speech fire once
    }
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- pause / resume of underlying audio -----------------------------------
  useEffect(() => {
    const a = audioRef.current;
    if (clockFrozen) {
      a?.pause();
      speechPlayerRef.current?.setPaused(true);
      try {
        window.speechSynthesis?.pause();
      } catch {
        /* ignore */
      }
    } else if (started && phase === "instruction" && voiceEnabled && !finished) {
      if (instructionModeRef.current === "mp3" && a) {
        const p = a.play();
        if (p && typeof p.then === "function") p.catch(() => {});
      }
      speechPlayerRef.current?.setPaused(false);
      try {
        window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
    }
  }, [clockFrozen, started, phase, voiceEnabled, finished]);

  // ---- controls -------------------------------------------------------------
  const beginSession = () => {
    void unlockAudio();
    // Prime the *actual* narration element (not just a decoy) synchronously
    // inside this click handler. iOS/WebKit in particular only grants
    // autoplay permission to a media element that has itself been played
    // (even briefly, even muted) during a real user gesture — unlocking a
    // separate temporary element/context isn't always enough. The real
    // instruction-phase play() call happens several seconds later once the
    // opening transition finishes, which is too far from the click for some
    // browsers to still count it as gesture-initiated.
    try {
      const a = audioRef.current;
      if (a) {
        const wasMuted = a.muted;
        a.muted = true;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = wasMuted;
          }).catch(() => {
            a.muted = wasMuted;
          });
        } else {
          a.pause();
          a.currentTime = 0;
          a.muted = wasMuted;
        }
      }
    } catch {
      /* ignore — falls back to the instruction-phase play() attempt */
    }
    setStarted(true);
    setIndex(0);
    setElapsedTotal(0);
    holdElapsed.current = 0;
    elapsedRef.current = 0;
    setPaused(false);
    sessionLogged.current = false;
    loggedSeconds.current = 0;
    pendingExtension.current = 0;
    holdSecondsRef.current = 0;
    finishedBreaths.current = 0;
    setStageLayers([]);
    setChromeVisible(true);
    skippedIndices.current = new Set();
    completedIndices.current = new Set();
    setEndedEarly(false);
    setCredited(true);
    setPostMood(null);
    enterTransition(0);
    void captureProduct("session_started", {
      pathway: meta.pathwaySlug || meta.label || "guided",
      planned_minutes: meta.plannedMinutes ?? Math.max(1, Math.round(todays.length * 2)),
    });
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
    // UI toggles Slow ↔ Normal; voice commands may still set 1.25.
    setPace((p) => (p === 0.75 ? 1 : 0.75));
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
      else if (cmd === "stop") attemptExit();
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

  const attemptExit = (trigger?: HTMLButtonElement | null) => {
    if (finished) {
      clear();
      navigate("/");
      return;
    }
    if (trigger) exitTriggerRef.current = trigger;
    setConfirmExit(true);
  };

  // ---- empty state: practice hub -------------------------------------------
  if (todays.length === 0 && !finished) {
    return (
      <div className="animate-fade-in space-y-8" data-testid="practice-hub">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Practice</h1>
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
                  <Link href="/asanas">Poses</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" data-testid="button-hub-builder">
                  <Link href="/builder">Builder</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
        <section className="flex flex-wrap gap-2" aria-label="More ways to practice">
          <Button asChild variant="outline" size="sm" data-testid="button-hub-adaptive">
            <Link href="/adaptive">Adaptive plan</Link>
          </Button>
          <Button asChild variant="outline" size="sm" data-testid="button-hub-pose-coach">
            <Link href="/pose-coach">Pose self-check</Link>
          </Button>
          <Button asChild variant="outline" size="sm" data-testid="button-hub-breathing">
            <Link href="/breathing">Breathing</Link>
          </Button>
          <Button asChild variant="outline" size="sm" data-testid="button-hub-kids">
            <Link href="/kids">Kids</Link>
          </Button>
        </section>
      </div>
    );
  }

  // ---- completion card ------------------------------------------------------
  if (finished) {
    const reflection =
      preMood && postMood ? `You moved from ${preMood} → ${postMood}. Beautiful.` : null;
    const summaryEntry = buildJournalEntry({
      label: meta.label ?? "Guided session",
      minutes: finishedMinutes.current,
      plannedMinutes: meta.plannedMinutes ?? null,
      poseNames: todays.map((a) => a.english),
      posesCompleted: posesCompleted.current,
      posesSkipped: skippedIndices.current.size,
      preMood,
      postMood,
      breathCount: finishedBreaths.current,
    });
    return (
      <FullScreenOverlay label="Practice complete">
        <GuidedLiveRegion message={GUIDED_SR.sessionComplete} />
        <Confetti active={confetti} />
        <MoodCheckIn
          open={showPostMood}
          title="How do you feel now?"
          description="Optional — notice the shift in your body and mind."
          confirmLabel="Skip"
          testIdPrefix="postmood"
          onPick={(m) => {
            setPostMood(m);
            lastPostMood.current = m;
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
                    if (!sessionLogged.current) void finalizeSession(postMood, null);
                  }}
                >
                  Skip
                </Button>
                <Button
                  className="min-h-11"
                  disabled={rpe == null}
                  onClick={() => {
                    setShowRpe(false);
                    if (!sessionLogged.current) void finalizeSession(postMood, rpe);
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
              aspect="aspect-square"
              rounded="rounded-full"
              breath={false}
              shadow={false}
              fit="contain"
              testId="complete-illustration"
            />
          </div>
          <h1 className="font-serif text-4xl" data-testid="guided-complete-headline">
            {sessionHeadline({
              counts: credited,
              minutes: finishedMinutes.current,
              endedEarly,
              posesCompleted: posesCompleted.current,
              posesTotal: todays.length,
            })}
          </h1>
          <div className="flex flex-wrap items-start justify-center gap-8 text-center">
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
            <div>
              <p
                className="font-serif text-3xl tabular-nums text-primary"
                data-testid="text-complete-breaths"
              >
                {finishedBreaths.current}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {finishedBreaths.current === 1 ? "breath" : "breaths"}
              </p>
            </div>
          </div>
          {credited ? (
            <p className="max-w-md text-sm text-muted-foreground" data-testid="text-summary-saved">
              {saving
                ? "Saving to your journal…"
                : sessionLogged.current
                  ? "Saved to your journal."
                  : saveFailed
                    ? "Couldn’t save yet — retry below."
                    : "Writing your session summary…"}
            </p>
          ) : (
            <p className="max-w-sm text-sm text-muted-foreground">
              Skipping through doesn't count toward your streak. Stay for a minute of holding, or
              finish at least half the poses.
            </p>
          )}
          {credited && meta.pathwaySlug && !endedEarly && (
            <p className="text-sm text-muted-foreground">Day marked complete · {meta.label}</p>
          )}
          {reflection && (
            <p className="font-serif text-lg text-primary" data-testid="text-mood-reflection">
              {reflection}
            </p>
          )}
          {!showPostMood && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => setShowPostMood(true)}
              data-testid="button-optional-mood"
            >
              Add mood (optional)
            </Button>
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
          {credited &&
            !savePromptDismissed &&
            savePromptLevel({
              isSignedIn,
              totalSessions: guestStats?.totalSessions ?? 0,
              atCompletion: true,
            }) === "blocking" && (
              <SavePracticeCompleteCard
                totalSessions={guestStats?.totalSessions ?? 0}
                currentStreak={guestStats?.currentStreak ?? 0}
                onDismiss={() => {
                  declineBlocking(guestStats?.totalSessions ?? 0);
                  setSavePromptDismissed(true);
                }}
              />
            )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              size="lg"
              onClick={async () => {
                if (credited && !sessionLogged.current) {
                  await finalizeSession(postMood, rpe);
                }
                if (sessionLogged.current || !credited) {
                  clear();
                  navigate("/");
                }
              }}
              data-testid="button-log-continue"
              disabled={saving}
            >
              Done — back home
            </Button>
            {credited && (
              <Button
                size="lg"
                variant="outline"
                onClick={async () => {
                  if (!sessionLogged.current) {
                    await finalizeSession(postMood, rpe);
                  }
                  if (sessionLogged.current) {
                    clear();
                    navigate(
                      `/journal?new=1&title=${encodeURIComponent(summaryEntry.title)}&body=${encodeURIComponent(summaryEntry.body)}`,
                    );
                  }
                }}
                data-testid="button-journal-prompt"
                disabled={saving}
              >
                <NotebookPen className="mr-1.5 h-4 w-4" /> Reflect in journal
              </Button>
            )}
            {credited && (
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
            )}
          </div>
        </div>
      </FullScreenOverlay>
    );
  }

  // ---- pre-start: pre-mood check-in, then auto-begin ------------------------
  if (!started) {
    return (
      <>
        <MoodCheckIn
          open={showPreMood && shouldAskPreMood(knownPreMood)}
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
          <h1 className="font-serif text-3xl">Practice</h1>
          <p className="max-w-md text-muted-foreground" data-testid="pre-session-summary">
            {preSessionSummary({
              label: meta.label,
              poseCount: todays.length,
              minutes: meta.plannedMinutes ?? sessionMinutes(todays),
            })}
          </p>
          {introVideo && (
            <StreamVideo
              media={introVideo}
              className="aspect-video w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-soft"
              aria-label={`Illustrated intro for ${meta.label ?? "this session"}`}
              testId="mood-intro-video"
            />
          )}
          {/* Guided is primary; timer-only is the secondary mode */}
          <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-sm" data-testid="mode-toggle">
            <button
              className="min-h-11 rounded-full bg-primary px-3 py-2 font-medium text-primary-foreground"
              data-testid="toggle-guided"
              aria-pressed="true"
            >
              Guided
            </button>
            <button
              onClick={() => navigate("/practice")}
              className="min-h-11 rounded-full px-3 py-2 text-muted-foreground hover:text-foreground"
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
  const exitCopy = sessionExitCopy(creditNow());
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
      ? `Get ready for ${current?.english ?? "the next pose"}…`
      : phase === "sideSwitch"
        ? "Switch sides"
        : isHold
          ? `${breathLabel} ${holdCues[cueIndex % holdCues.length] ?? ""}`.trim()
          : activeCues[stepIndex]?.text || steps[stepIndex]?.text || "";

  const layersForStage =
    stageLayers.length > 0
      ? stageLayers
      : current
        ? [
            {
              id: 0,
              slug: current.slug,
              english: current.english,
              sanskrit: current.sanskrit,
              poseKey: current.pose,
            } satisfies StageLayer,
          ]
        : [];

  return (
    <FullScreenOverlay label="Practice session">
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="guided-session"
      data-chrome={chromeVisible ? "visible" : "idle"}
      data-clock-frozen={clockFrozen ? "true" : "false"}
    >
      <GuidedLiveRegion message={srMessage} />
      <audio
        ref={audioRef}
        {...(src ? { src } : {})}
        // Session-local mute. Kept on the element (rather than skipping
        // playback) so narration still drives step timing — silencing the voice
        // must not change the pace of the practice.
        muted={muted}
        preload={voiceEnabled && src ? "metadata" : "none"}
        data-testid="guided-audio"
        onLoadedMetadata={(e) => setVoiceDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => {
          if (phase !== "instruction") return;
          const a = e.target as HTMLAudioElement;
          if (a.duration > 0) {
            const { index: idx, progress } = resolveStep(a.currentTime);
            setStepIndex(idx);
            setStepProgress(progress);
            setNarrationTime(a.currentTime);
          }
        }}
        onEnded={onVoiceEnded}
        onError={() => {
          // Narration can't load. Fall back to robot voice or silent captions.
          audioBrokenRef.current = true;
          if (phase !== "instruction") return;
          if (allowRobotVoice && activeCues.length > 0) {
            instructionModeRef.current = "speech";
            silentElapsedRef.current = 0;
            speechPlayerRef.current?.cancel();
            speechPlayerRef.current = createSpeechCuePlayer({
              cues: activeCues,
              pace,
              muted,
              onCue: (i) => setStepIndex(i),
            });
            speechPlayerRef.current.tick(0);
          } else {
            instructionModeRef.current = "silent";
          }
          setPhaseRemaining(SILENT_INSTRUCTION);
        }}
      />

      {/* Thin progress always on; full top chrome fades when idle. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-accent/40"
        aria-hidden
      >
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${progress}%` }}
          data-testid="guided-progress"
        />
      </div>

      {/* ── TOP STRIP ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 transition-opacity duration-500 motion-reduce:transition-none",
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!chromeVisible}
        {...(!chromeVisible ? { inert: true } : {})}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" data-testid="text-session-name">
            {meta.label ?? "Guided flow"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pose {index + 1} of {todays.length}
          </p>
        </div>
        <button
          ref={exitTriggerRef}
          onClick={(e) => attemptExit(e.currentTarget)}
          className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          data-testid="button-exit-guided"
          aria-label="Exit session"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      {!chromeVisible && (
        <button
          onClick={(e) => attemptExit(e.currentTarget)}
          className="absolute right-3 top-3 z-30 inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-background/70 text-muted-foreground backdrop-blur-sm hover:bg-accent hover:text-foreground"
          data-testid="button-exit-guided-idle"
          aria-label="Exit session"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* ── MIDDLE (the star) ─────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 sm:px-4">
        {/* prev thumb */}
        {prev && (
          <div
            className={cn(
              "absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-1 transition-opacity duration-500 sm:flex motion-reduce:transition-none",
              chromeVisible ? "opacity-40" : "pointer-events-none opacity-0",
            )}
          >
            <img width={80} height={160}
              src={`${import.meta.env.BASE_URL}poses/${prev.slug}.png`}
              alt={prev.imageAlt}
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
          <div
            className={cn(
              "absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-1 transition-opacity duration-500 sm:flex motion-reduce:transition-none",
              chromeVisible ? "opacity-40" : "pointer-events-none opacity-0",
            )}
          >
            <img width={80} height={160}
              src={`${import.meta.env.BASE_URL}poses/${next.slug}.png`}
              alt={next.imageAlt}
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

        <div className="flex w-full max-w-xl flex-col items-center">
          <div
            className="relative flex h-[min(58vh,560px)] w-full items-center justify-center"
            data-testid="guided-stage-crossfade"
          >
            {layersForStage.map((layer, i) => {
              const isTop = i === layersForStage.length - 1;
              const live = isTop && current?.slug === layer.slug;
              return (
                <div
                  key={layer.id}
                  className={cn(
                    "inset-0 flex items-center justify-center",
                    layersForStage.length > 1 ? "absolute" : "relative h-full w-full",
                    smoothCrossfade
                      ? "transition-opacity duration-700 ease-out motion-reduce:transition-none"
                      : "",
                    isTop ? "z-10 opacity-100" : "z-0 opacity-0",
                  )}
                >
                  <PoseTrainerStage
                    slug={layer.slug}
                    english={layer.english}
                    sanskrit={layer.sanskrit}
                    poseKey={layer.poseKey}
                    stepPoseKey={live ? activeStepPose : layer.poseKey}
                    momentum={live ? activeMomentum : undefined}
                    stepIndex={
                      live
                        ? phase === "instruction"
                          ? stepIndex
                          : Math.max(0, stepCount - 1)
                        : 0
                    }
                    stepProgress={
                      live
                        ? phase === "instruction"
                          ? stepProgress
                          : 1
                        : 1
                    }
                    playing={
                      live && !clockFrozen && (phase === "instruction" || phase === "hold")
                    }
                    restartToken={live ? videoRestartToken : 0}
                    syncVideoToVoice
                    narrationTime={live ? narrationTime : 0}
                    narrationDuration={
                      live
                        ? voiceEnabled && !audioBrokenRef.current && voiceDuration > 0
                          ? voiceDuration
                          : SILENT_INSTRUCTION
                        : 0
                    }
                    guideActive={
                      live && (phase === "instruction" || phase === "hold")
                    }
                    caption={
                      live && (phase === "instruction" || phase === "hold")
                        ? activeCaption
                        : null
                    }
                    side={live && isEach ? (side as 1 | 2) : 1}
                    variant="practice"
                    data-testid={isTop ? "guided-hero" : `guided-hero-prev-${layer.slug}`}
                  />
                </div>
              );
            })}
          </div>

          <h1
            className={cn(
              "mt-3 font-serif text-3xl transition-opacity duration-500 motion-reduce:transition-none",
              chromeVisible ? "opacity-100" : "opacity-70",
            )}
            data-testid="text-current-pose"
          >
            {current?.english}
            {isEach && (
              <span className="ml-2 text-base text-muted-foreground">· side {side}</span>
            )}
          </h1>
          <p
            className={cn(
              "italic text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none",
              chromeVisible ? "opacity-100" : "opacity-0",
            )}
            data-testid="text-current-sanskrit"
          >
            {current?.sanskrit}
          </p>
        </div>
      </div>

      {/* ── BOTTOM STRIP ──────────────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 px-4 pb-5 pt-4 transition-[opacity,border-color] duration-500 motion-reduce:transition-none",
          chromeVisible ? "border-t border-border" : "border-t border-transparent",
        )}
      >
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
          >
            {activeCaption}
          </p>

          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-2 transition-opacity duration-500 motion-reduce:transition-none",
              chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            data-testid="guided-transport"
            aria-hidden={!chromeVisible}
            {...(!chromeVisible ? { inert: true } : {})}
          >
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
              aria-pressed={paused}
              aria-label={paused ? "Resume session" : "Pause session"}
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
              aria-label={`Practice pace ${pace === 0.75 ? "slow" : "normal"}. Tap to change.`}
              title={pace === 0.75 ? "Pace: Slow" : pace === 1.25 ? "Pace: Fast" : "Pace: Normal"}
            >
              <Gauge className="h-5 w-5" />
              <span className="sr-only">
                Pace {pace === 0.75 ? "slow" : pace === 1.25 ? "fast" : "normal"}
              </span>
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

          <p
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none",
              chromeVisible ? "opacity-100" : "opacity-0",
            )}
            data-testid="guided-pace-label"
          >
            <TimerIcon className="h-3.5 w-3.5" />
            ~{Math.max(1, Math.round(remainingEstimate / 60))} min left ·{" "}
            {pace === 0.75 ? "slow" : pace === 1.25 ? "fast" : "normal"}
            {side === 2 ? " · side 2" : isEach ? " · side 1" : ""}
            {playback?.kind === "speech" ? " · robot voice" : ""}
          </p>
        </div>
      </div>

      <PoseTipsSheet
        asana={current}
        open={tipsOpen}
        onOpenChange={setTipsOpen}
      />

      {/* Exit confirmation — unmount content when closed so copy leaves the a11y tree. */}
      <AlertDialog
        open={confirmExit}
        onOpenChange={(open) => {
          setConfirmExit(open);
          if (!open) {
            const node = exitTriggerRef.current;
            requestAnimationFrame(() => node?.focus());
          }
        }}
      >
        {confirmExit ? (
        <AlertDialogContent
          data-testid="guided-leave-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            exitTriggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the session?</AlertDialogTitle>
            <AlertDialogDescription>{exitCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-exit-cancel">Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const preview = creditNow();
                if (preview.counts) {
                  finish({ endedEarly: true });
                  return;
                }
                const a = audioRef.current;
                if (a) a.pause();
                try {
                  window.speechSynthesis?.cancel();
                } catch {
                  /* ignore */
                }
                saveProgress(null);
                clear();
                navigate("/");
              }}
              data-testid="button-exit-confirm"
            >
              {exitCopy.leaveLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </div>
    </FullScreenOverlay>
  );
}
