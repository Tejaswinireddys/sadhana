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
import { SessionSpec } from "@/components/SessionSpec";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import { poseImageWithheld } from "@/data/poseImageAccuracy";
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
import { amendLoggedSession, buildJournalEntry, logPracticeSession } from "@/lib/logPracticeSession";
import { completionTiles } from "@/lib/completionSummary";
import { estimateBreathCount } from "@/lib/sessionBreaths";
import { captureProduct } from "@/lib/productAnalytics";
import { sessionCredit, sessionExitCopy, sessionHeadline, type SessionCredit } from "@/lib/sessionCredit";
import {
  completionLeavePath,
  shouldFireBackgroundSave,
} from "@/lib/guidedCompletion";
import { setImmersivePlayerActive } from "@/lib/legal";
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
import { asanaBySlug } from "@/data/content";
import { SAMPLE_PRACTICE } from "@/data/samplePractice";
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
import { SessionPreflightCard } from "@/components/SessionPreflightCard";
import { ExploreDirectory } from "@/components/ExploreDirectory";
import { accurateImageAlt } from "@/data/poseImageAccuracy";
import { buildSessionPreflight } from "@/lib/sessionPreflight";
import {
  QUICK_SESSIONS,
  preSessionSummary,
  quickSessionMeta,
  sessionTimeLabel,
  TRANSITION_SECONDS,
  SIDE_SWITCH_SECONDS,
} from "@/data/quickSessions";
import { catalogPreflight, catalogSessionMinutes } from "@/lib/pathwayTiming";
import {
  estimateInstructionSeconds,
  guidedPhaseLabel,
  holdRemainingAfterInstruction,
  instructionCountdown,
  remainingFooterLabel,
  remainingFromPhases,
  teachesFully,
  instructionModeDescription,
  BRIEF_INSTRUCTION_SECONDS,
  type InstructionMode,
} from "@/lib/guidedDuration";
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
/**
 * The silent walkthrough window. Shared with the duration authority so a
 * voice-off session is advertised at the length it actually runs.
 */
const SILENT_INSTRUCTION_SECONDS = BRIEF_INSTRUCTION_SECONDS;
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

/**
 * Doorways to the practice surfaces that are not the main queue.
 *
 * Shown on the practice hub AND on the pre-session screen: with a queue loaded
 * the hub never renders, and these were the only links to Breathing, Kids,
 * Pathways and Challenges outside a long Home scroll.
 */
function MoreWaysToPractice({ className }: { className?: string }) {
  const links: Array<{ href: string; label: string; testId: string }> = [
    { href: "/breathing", label: "Breathing", testId: "button-hub-breathing" },
    { href: "/kids", label: "Kids", testId: "button-hub-kids" },
    { href: "/pathways", label: "Pathways", testId: "button-hub-pathways-more" },
    { href: "/challenges", label: "Challenges", testId: "button-hub-challenges" },
    { href: "/adaptive", label: "Adaptive plan", testId: "button-hub-adaptive" },
    { href: "/pose-coach", label: "Pose self-check", testId: "button-hub-pose-coach" },
  ];
  return (
    <section
      className={cn("flex flex-wrap gap-2", className)}
      aria-label="More ways to practice"
      data-testid="more-ways-to-practice"
    >
      {links.map((l) => (
        <Button key={l.href} asChild variant="outline" size="sm" data-testid={l.testId}>
          <Link href={l.href}>{l.label}</Link>
        </Button>
      ))}
    </section>
  );
}

export default function GuidedSession() {
  useDocumentTitle("Practice · Sadhana");
  const {
    todays,
    meta,
    setMeta,
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

  /** The short first practice from /welcome — gentle, no props, beginner. */
  const firstPractice = useMemo(
    () => catalogPreflight(SAMPLE_PRACTICE.poses.map((p) => ({ slug: p.slug, holdSeconds: p.holdSeconds }))),
    [],
  );
  const startFirstPractice = () => {
    const poses = SAMPLE_PRACTICE.poses
      .map((s) => {
        const asana = asanaBySlug(s.slug);
        return asana ? { asana, holdSeconds: s.holdSeconds } : null;
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } =>
          x != null,
      );
    if (!poses.length) return;
    loadSession(poses, {
      label: SAMPLE_PRACTICE.title,
      pathwaySlug: null,
      plannedMinutes: firstPractice.minutes,
    });
  };

  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const { isSignedIn } = useAuth();
  const { data: guestStats } = useQuery<Stats>({
    queryKey: ["/api/sessions/stats", todayISO()],
  });
  const [savePromptDismissed, setSavePromptDismissed] = useState(false);
  const voiceEnabled = prefs ? prefs.voiceEnabled !== 0 : true;
  const allowRobotVoice = prefs ? prefs.allowRobotVoice === 1 : false;
  /**
   * How this queue will actually be taught, and therefore how long it runs.
   * Voice off means a 12-second on-screen walkthrough per pose instead of a
   * 55–70s recording — roughly a third of the advertised length on a short
   * session, which is why every duration on this screen reads this value.
   */
  const instructionMode: InstructionMode =
    meta.instructionMode ?? (voiceEnabled ? "guided" : "brief");

  /**
   * Everything the preparation screen promises, derived from this exact queue
   * and this exact teaching mode — never from the label the session was
   * launched with.
   */
  const preflight = useMemo(
    () =>
      buildSessionPreflight({
        poses: todays.map((a) => ({ ...a, holdSeconds: a.holdSeconds, sides: a.sides })),
        mode: instructionMode,
        requestedMinutes: meta.plannedMinutes ?? null,
      }),
    [todays, instructionMode, meta.plannedMinutes],
  );

  /**
   * Swap a prop-dependent pose for its reviewed prop-free pair, keeping the
   * hold and the position in the arc. The queue is reloaded rather than
   * mutated so the persisted practice and the preflight agree.
   */
  const swapForPropFreePose = useCallback(
    (fromSlug: string, toSlug: string) => {
      const replacement = asanaBySlug(toSlug);
      if (!replacement) return;
      const next = todays.map((a) =>
        a.slug === fromSlug
          ? {
              asana: replacement,
              holdSeconds: a.holdSeconds,
              ...(a.sides ? { sides: a.sides } : {}),
            }
          : { asana: a, holdSeconds: a.holdSeconds, ...(a.sides ? { sides: a.sides } : {}) },
      );
      loadSession(next, {
        label: meta.label,
        pathwaySlug: meta.pathwaySlug,
        breathSlug: meta.breathSlug ?? null,
        plannedMinutes: meta.plannedMinutes ?? null,
        preMood: meta.preMood ?? null,
        introPoseSlug: meta.introPoseSlug ?? null,
        careRegions: meta.careRegions ?? null,
      });
      toast({
        title: "Swapped for a prop-free pose",
        description: `${replacement.english} replaces the supported version.`,
      });
    },
    [todays, meta, loadSession, toast],
  );

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
  /** Journal row id from auto-save — Reflect edits this instead of creating a duplicate. */
  const journalEntryId = useRef<number | null>(null);
  const sessionRowId = useRef<number | null>(null);
  useWakeLock(started && !clockFrozen && !finished);

  /**
   * Tell the consent banner a practice is running so it does not open over the
   * player. Its "Got it" sat underneath the player's own fixed controls, which
   * made the notice impossible to dismiss without leaving the session.
   */
  const immersive = started && !finished;
  useEffect(() => {
    setImmersivePlayerActive(immersive);
    return () => setImmersivePlayerActive(false);
  }, [immersive]);

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
  // Mirrored into state because the remaining-time footer has to count it —
  // a ref alone bought the practitioner 30 seconds the estimate never showed.
  const pendingExtension = useRef(0);
  const [pendingExtensionSec, setPendingExtensionSec] = useState(0);
  const bankExtension = useCallback((seconds: number) => {
    pendingExtension.current += seconds;
    setPendingExtensionSec(pendingExtension.current);
  }, []);
  const clearBankedExtension = useCallback(() => {
    pendingExtension.current = 0;
    setPendingExtensionSec(0);
  }, []);

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
  /**
   * Learn teaches a pose in full once: the far side and any later repeat get
   * the short Flow cue. `teachingFull` is what this instruction phase is
   * actually doing — Replay sets it back to full on request.
   */
  const isRepeatPose = useMemo(
    () => todays.slice(0, index).some((p) => p.slug === current?.slug),
    [todays, index, current?.slug],
  );
  const [teachingFull, setTeachingFull] = useState(true);
  const voiceTeaching = teachingFull && instructionMode === "guided";

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
    voiceTeaching && voiceEnabled && !audioBrokenRef.current && voiceDuration > 0
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

  // ---- session time remaining (current phase + later poses) -----------------
  const remainingEstimate = remainingFromPhases({
    poses: todays.map((a, i) => ({
      holdSeconds: a.holdSeconds,
      sides: a.sides,
      slug: a.slug,
      stepCount: a.steps?.length ?? 0,
      instructionSeconds:
        i === index && voiceDuration > 0 && voiceTeaching
          ? estimateInstructionSeconds(a.steps?.length ?? 0, voiceDuration)
          : undefined,
    })),
    index,
    phase,
    mode: instructionMode,
    pace,
    pendingHoldExtension: pendingExtensionSec,
    side,
    instructionLeft: instructionCountdown({
      usingMp3:
        voiceEnabled &&
        instructionModeRef.current === "mp3" &&
        !audioBrokenRef.current,
      audioCurrentTime: audioRef.current?.currentTime ?? 0,
      audioDuration: voiceDuration || (audioRef.current?.duration ?? 0),
      phaseRemaining,
    }),
    phaseRemaining,
  });

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
      journalEntryId.current = result.journalId ?? null;
      sessionRowId.current = result.sessionId ?? null;
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

  /**
   * The completion screen's "add mood / rate effort" path.
   *
   * The practice is written the moment it ends, so an answer given afterwards
   * must amend that row. Calling finalizeSession again is guarded against
   * double-logging, which used to mean the answer was simply dropped.
   */
  const saveOrAmendReflection = useCallback(
    async (resolvedPost: Mood | null, resolvedRpe: number | null) => {
      lastPostMood.current = resolvedPost;
      if (!sessionLogged.current) {
        await finalizeSession(resolvedPost, resolvedRpe);
        return;
      }
      if (!creditRef.current.counts) return;
      await amendLoggedSession({
        sessionId: sessionRowId.current,
        journalId: journalEntryId.current,
        postMood: resolvedPost,
        rpe: resolvedRpe,
        journal: {
          label: meta.label ?? "Guided session",
          minutes: finishedMinutes.current,
          plannedMinutes: meta.plannedMinutes ?? null,
          poseNames: todays.map((a) => a.english),
          posesCompleted: posesCompleted.current,
          posesSkipped: skippedIndices.current.size,
          preMood,
          postMood: resolvedPost,
          breathCount: finishedBreaths.current,
        },
      });
    },
    [finalizeSession, meta, todays, preMood],
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
    (whichSide: 1 | 2, opts?: { full?: boolean }) => {
      const full =
        opts?.full ?? teachesFully(instructionMode, { repeat: isRepeatPose, side: whichSide });
      setTeachingFull(full);
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
        !voiceEnabled || instructionMode !== "guided" || !full
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
    [voiceEnabled, instructionMode, isRepeatPose, pace, src, allowRobotVoice, activeCues, muted],
  );

  const enterHold = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    speechPlayerRef.current?.cancel();
    speechPlayerRef.current = null;
    const remaining = holdRemainingAfterInstruction(
      current?.holdSeconds ?? 30,
      pendingExtension.current,
    );
    clearBankedExtension();
    setPhaseRemaining(remaining);
    setHoldBudget(remaining);
    setStepIndex(Math.max(0, stepCount - 1));
    setStepProgress(1);
    setNarrationTime(
      voiceTeaching && voiceEnabled && !audioBrokenRef.current && voiceDuration > 0
        ? voiceDuration
        : SILENT_INSTRUCTION_SECONDS,
    );
    setCueIndex(0);
    setPhase("hold");
  }, [current, voiceDuration, voiceEnabled, voiceTeaching, stepCount, clearBankedExtension]);

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
    clearBankedExtension();
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
      // Replay always gives the full setup, even on a repeat or second side.
      startInstruction(side, { full: true });
      toast({ title: "Repeating guidance", description: "Playing this pose’s full setup again." });
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
      bankExtension(30);
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

  const leaveCompletedSession = (path: string) => {
    if (
      shouldFireBackgroundSave({
        credited,
        sessionLogged: sessionLogged.current,
        saving,
      })
    ) {
      void finalizeSession(postMood, rpe);
    }
    setFinished(false);
    setStarted(false);
    setShowPostMood(false);
    setShowRpe(false);
    saveProgress(null);
    clear();
    navigate(path);
  };

  const attemptExit = (trigger?: HTMLButtonElement | null) => {
    if (finished) {
      leaveCompletedSession(completionLeavePath("home"));
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
          <p className="text-muted-foreground">Practice now, follow a program, or learn a pose.</p>
        </header>

        {/* ── Practice now ─────────────────────────────────────────────── */}
        <section className="space-y-3" aria-labelledby="hub-now-heading" data-testid="hub-practice-now">
          <h2 id="hub-now-heading" className="font-serif text-2xl">Practice now</h2>
          <h3 className="text-sm font-medium text-muted-foreground">How do you feel?</h3>
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
                          {q.intent}
                        </p>
                        <SessionSpec
                          preflight={catalogPreflight(q.poses.map((p) => ({ slug: p.slug, holdSeconds: p.holdSeconds })))}
                          showFormat={false}
                          className="mt-1"
                        />
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-primary/30 bg-accent/40 shadow-soft" data-testid="hub-first-practice">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" aria-hidden />
                  <p className="font-serif text-lg">{firstPractice.minutes}-minute first practice</p>
                </div>
                <SessionSpec preflight={firstPractice} showFormat={false} />
                <Button onClick={startFirstPractice} data-testid="button-hub-first-practice">
                  <Play className="mr-1.5 h-4 w-4" /> Start
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-soft" data-testid="hub-trainer">
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="font-serif text-lg">Build today&apos;s practice</p>
                <p className="text-sm text-muted-foreground">
                  Four questions — body, energy, time, focus — then a practice shaped to your answers.
                  Recovering or low on energy?{" "}
                  <Link href="/adaptive" className="text-primary hover:underline" data-testid="link-hub-adaptive">
                    Use the adaptive plan
                  </Link>
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild data-testid="button-hub-trainer">
                    <Link href="/trainer">Answer 4 questions</Link>
                  </Button>
                  <Button asChild variant="ghost" data-testid="button-hub-builder">
                    <Link href="/builder">Your sequences</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Follow a program ─────────────────────────────────────────── */}
        <section className="space-y-3" aria-labelledby="hub-program-heading" data-testid="hub-follow-program">
          <h2 id="hub-program-heading" className="font-serif text-2xl">Follow a program</h2>
          <Card className="shadow-soft">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <RouteIcon className="mt-1 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  7-day programs and multi-week pathways, one session a day, each with its own
                  preparation. Private challenges sit alongside them.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" data-testid="button-hub-pathways">
                  <Link href="/pathways">Browse programs</Link>
                </Button>
                <Button asChild variant="ghost" data-testid="button-hub-challenges-inline">
                  <Link href="/challenges">Challenges</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Learn a pose ─────────────────────────────────────────────── */}
        <section className="space-y-3" aria-labelledby="hub-learn-heading" data-testid="hub-learn-pose">
          <h2 id="hub-learn-heading" className="font-serif text-2xl">Learn a pose</h2>
          <Card className="shadow-soft">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <LayoutGrid className="mt-1 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  Every pose with its steps, modifications and what to avoid. The virtual instructor
                  teaches five poses step by step (pilot).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" data-testid="button-go-library">
                  <Link href="/asanas">Browse poses</Link>
                </Button>
                <Button asChild variant="ghost" data-testid="button-hub-instructor">
                  <Link href="/instructor">Virtual instructor</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <MoreWaysToPractice />
        {/*
          Comprehensive discovery lives here, on the catalogue page, rather than
          at the bottom of Today — collapsed so it does not compete with the
          three ways in above.
        */}
        <details className="group" data-testid="hub-all-destinations">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>All destinations</span>
            <span className="text-xs text-primary group-open:hidden">Show</span>
            <span className="hidden text-xs text-primary group-open:inline">Hide</span>
          </summary>
          <div className="mt-3">
            <ExploreDirectory headingId="practice-explore-heading" />
          </div>
        </details>
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
          onDismiss={() => {
            setShowPostMood(false);
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
                    void saveOrAmendReflection(postMood, null);
                  }}
                >
                  Skip
                </Button>
                <Button
                  className="min-h-11"
                  disabled={rpe == null}
                  onClick={() => {
                    setShowRpe(false);
                    void saveOrAmendReflection(postMood, rpe);
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
            {completionTiles({
              minutes: finishedMinutes.current,
              posesCompleted: posesCompleted.current,
              posesTotal: todays.length,
              posesSkipped: skippedIndices.current.size,
              breaths: finishedBreaths.current,
            }).map((tile) => (
              <div key={tile.id}>
                <p
                  className="font-serif text-3xl tabular-nums text-primary"
                  data-testid={tile.testId}
                >
                  {tile.value}
                </p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {tile.label}
                </p>
              </div>
            ))}
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
                  try {
                    declineBlocking(guestStats?.totalSessions ?? 0);
                  } catch {
                    /* localStorage can throw in locked-down browsers */
                  }
                  setSavePromptDismissed(true);
                }}
              />
            )}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              size="lg"
              onClick={() => leaveCompletedSession(completionLeavePath("home"))}
              data-testid="button-log-continue"
            >
              Done — back home
            </Button>
            {credited && (
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  leaveCompletedSession(
                    completionLeavePath("journal", {
                      title: summaryEntry.title,
                      body: summaryEntry.body,
                      editId: journalEntryId.current,
                    }),
                  )
                }
                data-testid="button-journal-prompt"
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
                  journalEntryId.current = null;
                  sessionRowId.current = null;
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
          /*
            Answering the mood question used to call beginSession() straight
            away, so a practice launched from Today went question → player and
            the preparation screen underneath was never seen. Sessions that
            carry a mood already (the mood decks) skipped the modal and got the
            preflight, which is why only some entry points appeared to have one.
            Every answer now closes the modal and reveals the same screen.
          */
          onPick={(m) => {
            setPreMood(m);
            setShowPreMood(false);
          }}
          onSkip={() => {
            setPreMood(null);
            setShowPreMood(false);
          }}
          onDismiss={() => {
            setShowPreMood(false);
          }}
        />
        <div className="animate-fade-in flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <MicVocal className="h-10 w-10 text-primary" />
          <h1 className="font-serif text-3xl">Before you start</h1>
          <p className="sr-only" data-testid="pre-session-summary">
            {preSessionSummary({
              label: meta.label,
              poseCount: todays.length,
              timeLabel: sessionTimeLabel(todays, instructionMode),
              mode: instructionMode,
            })}
          </p>
          <SessionPreflightCard
            title={meta.label}
            preflight={preflight}
            poses={todays.map((a) => ({
              slug: a.slug,
              english: a.english,
              holdSeconds: a.holdSeconds,
              sides: a.sides,
            }))}
            onSwapEquipment={swapForPropFreePose}
          />
          {introVideo && (
            <StreamVideo
              media={introVideo}
              className="aspect-video w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-soft"
              aria-label={`Illustrated intro for ${meta.label ?? "this session"}`}
              testId="mood-intro-video"
            />
          )}
          {/*
            Learn / Flow / Timer only. Each shows the length it will actually
            run, and the preflight above recalculates for the one chosen.
          */}
          <div
            role="radiogroup"
            aria-label="How to teach this practice"
            className="grid w-full max-w-lg grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1 text-sm"
            data-testid="mode-toggle"
          >
            {(
              [
                { id: "guided", label: "Learn", testId: "toggle-guided" },
                { id: "brief", label: "Flow", testId: "toggle-flow" },
                { id: "timer", label: "Timer only", testId: "toggle-simple" },
              ] as const
            ).map((m) => {
              const selected = m.id === instructionMode;
              const disabled = m.id === "guided" && !voiceEnabled;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => {
                    // Timer only has its own, simpler screen.
                    if (m.id === "timer") navigate("/practice");
                    else setMeta({ instructionMode: m.id });
                  }}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={m.testId}
                >
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs opacity-90">{sessionTimeLabel(todays, m.id)}</span>
                </button>
              );
            })}
          </div>
          <p className="max-w-lg text-xs text-muted-foreground" data-testid="mode-description">
            {instructionModeDescription(instructionMode)}
          </p>
          {!voiceEnabled && (
            <p className="text-xs text-muted-foreground">
              Voice is off in your settings, so Learn is unavailable — Flow shows each pose's cues as
              captions.
            </p>
          )}
          <Button size="lg" onClick={beginSession} data-testid="button-begin-guided">
            <Play className="mr-2 h-5 w-5" /> Begin
          </Button>
          {/*
            Once a queue is loaded (the quiz loads one), tapping Practice lands
            here instead of the hub — which made Breathing, Kids and Challenges
            unreachable from the nav. Keep the same doorways on this screen.
          */}
          <MoreWaysToPractice className="pt-2" />
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
          : instructionCountdown({
              usingMp3:
                voiceEnabled &&
                instructionModeRef.current === "mp3" &&
                !audioBrokenRef.current,
              audioCurrentTime: audioRef.current?.currentTime ?? 0,
              audioDuration: voiceDuration || (audioRef.current?.duration ?? 0),
              phaseRemaining,
            });

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
      // Safe-area padding keeps the exit button out from under a notch and the
      // transport out from under the home indicator.
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background",
        // Short and wide (landscape phones): the demonstration and the controls
        // sit side by side. Stacked, a 390px-tall viewport left 23 pixels of
        // pose illustration, which teaches nothing.
        "[@media(max-height:500px)_and_(orientation:landscape)]:flex-row",
      )}
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
      {/*
        `min-h-0` is load-bearing. Without it this flex child refuses to shrink
        below its content, and on a 390x844 phone the 58vh stage pushed the pose
        name and its Sanskrit line down behind the timer panel — the heading was
        sliced in half. Media now takes the space that is left over after the
        name, the timer and the controls have theirs.
      */}
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-y-auto px-2 sm:px-4 [@media(max-height:500px)_and_(orientation:landscape)]:w-[44%] [@media(max-height:500px)_and_(orientation:landscape)]:flex-none">
        {/* prev thumb */}
        {prev && (
          <div
            className={cn(
              "absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-1 transition-opacity duration-500 sm:flex motion-reduce:transition-none",
              chromeVisible ? "opacity-40" : "pointer-events-none opacity-0",
            )}
          >
            {poseImageWithheld(prev.slug) ? (
              <WithheldPoseImage slug={prev.slug} compact />
            ) : (
              <img width={80} height={160}
              src={`${import.meta.env.BASE_URL}poses/${prev.slug}.png`}
              alt={accurateImageAlt(prev.slug, prev.imageAlt)}
              className="h-20 w-20 rounded-xl object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              data-testid="thumb-prev"
            />
            )}
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
            {poseImageWithheld(next.slug) ? (
              <WithheldPoseImage slug={next.slug} compact />
            ) : (
              <img width={80} height={160}
              src={`${import.meta.env.BASE_URL}poses/${next.slug}.png`}
              alt={accurateImageAlt(next.slug, next.imageAlt)}
              className="h-20 w-20 rounded-xl object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              data-testid="thumb-next"
            />
            )}
            <span className="max-w-[6rem] truncate text-center text-xs text-muted-foreground">
              {next.english}
            </span>
          </div>
        )}

        <div className="flex min-h-0 w-full max-w-xl flex-1 flex-col items-center justify-center gap-1 py-1">
          {/*
            `min-h` is the other half of the `min-h-0` fix. Letting the stage
            shrink stopped the heading being pushed under the timer; without a
            floor it kept shrinking, to a 124px sliver at 320x568 and 23px in
            landscape. Below this size the illustration stops being a
            demonstration, so the panel below scrolls instead.
          */}
          <div
            className="relative flex w-full flex-1 items-center justify-center"
            style={{ minHeight: "11rem", maxHeight: "min(58vh, 560px)" }}
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
                        ? voiceTeaching &&
                          voiceEnabled &&
                          !audioBrokenRef.current &&
                          voiceDuration > 0
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
              "shrink-0 text-balance px-2 text-center font-serif text-2xl leading-tight transition-opacity duration-500 motion-reduce:transition-none sm:text-3xl",
              chromeVisible ? "opacity-100" : "opacity-70",
            )}
            data-testid="text-current-pose"
          >
            {current?.english}
            {isEach && (
              <span className="ml-2 text-base text-muted-foreground">· side {side}</span>
            )}
          </h1>
          {/*
            Sanskrit is the first thing to go when the viewport is short —
            landscape phones and large-text settings both hit this. It is
            decorative next to the pose name, the cue and the countdown.
          */}
          <p
            className={cn(
              "hidden shrink-0 text-center italic text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none [@media(min-height:700px)]:block",
              chromeVisible ? "opacity-100" : "opacity-0",
            )}
            data-testid="text-current-sanskrit"
          >
            {current?.sanskrit}
          </p>
        </div>
      </div>

      {/* ── BOTTOM STRIP ──────────────────────────────────────────── */}
      {/*
        Short viewports (landscape phones, large-text settings) can make this
        panel taller than the space left for it. Tighten the spacing first, and
        allow it to scroll as a last resort so no control becomes unreachable.
      */}
      <div
        className={cn(
          "shrink-0 overflow-y-auto px-4 pb-5 pt-4 transition-[opacity,border-color] duration-500 motion-reduce:transition-none",
          // The controls took 317 of 568 pixels at 320x568, leaving the
          // demonstration a sliver. Cap the panel so the media keeps the larger
          // share; the panel scrolls rather than squeezing the figure.
          "max-h-[60vh] [@media(max-height:700px)]:max-h-[45vh]",
          "[@media(max-height:700px)]:pb-2 [@media(max-height:700px)]:pt-2",
          // Landscape: the panel is a column beside the demonstration.
          "[@media(max-height:500px)_and_(orientation:landscape)]:h-full",
          "[@media(max-height:500px)_and_(orientation:landscape)]:max-h-none",
          "[@media(max-height:500px)_and_(orientation:landscape)]:w-[56%]",
          "[@media(max-height:500px)_and_(orientation:landscape)]:border-l",
          "[@media(max-height:500px)_and_(orientation:landscape)]:border-t-0",
          chromeVisible ? "border-t border-border" : "border-t border-transparent",
        )}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 [@media(max-height:700px)]:gap-1.5">
          <span
            className="font-serif text-4xl tabular-nums sm:text-5xl [@media(max-height:700px)]:text-3xl"
            data-testid="guided-countdown"
          >
            {mmss(bottomCountdown)}
          </span>
          <p
            className="text-sm font-medium text-muted-foreground"
            data-testid="guided-phase-label"
          >
            {guidedPhaseLabel(phase)}
          </p>

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
              "[@media(max-height:700px)]:line-clamp-2 [@media(max-height:700px)]:min-h-0",
              isHold
                ? "text-base text-muted-foreground"
                : "text-lg font-medium text-foreground",
              !captionsOn && "sr-only",
            )}
            data-testid="guided-caption"
          >
            {activeCaption}
          </p>

          {/*
            Pause and Skip are the controls someone reaches for mid-pose, often
            lying down. Capping the panel to give the demonstration more room
            pushed this row below the fold at 320x568 — reachable by scrolling,
            which is not the same as reachable. It sticks to the bottom of the
            panel instead, and the caption above it scrolls.
          */}
          <div
            className={cn(
              "sticky bottom-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-background/95 py-1 backdrop-blur-sm transition-opacity duration-500 motion-reduce:transition-none",
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
            {/* Addressable on its own so the estimate can be asserted directly. */}
            <span data-testid="guided-remaining">{remainingFooterLabel(remainingEstimate)}</span> ·{" "}
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
