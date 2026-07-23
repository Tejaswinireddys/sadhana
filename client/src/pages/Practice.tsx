import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedPose } from "@/components/AnimatedAsana";
import { EmptyState } from "@/components/EmptyState";
import { MoodCheckIn } from "@/components/MoodCheckIn";
import { Confetti } from "@/components/Confetti";
import { usePractice } from "@/context/PracticeContext";
import { useToast } from "@/hooks/use-toast";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { logPracticeSession } from "@/lib/logPracticeSession";
import { breathBySlug, type Mood } from "@/data/content";
import { Link } from "wouter";
import { Play, Pause, SkipForward, X, Check } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

function playChime() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
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
      gain.gain.linearRampToValueAtTime(0.25, start + 0.04);
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

export default function Practice() {
  useDocumentTitle("Practice timer · Sadhana");
  const {
    todays,
    meta,
    clear,
    saveProgress,
    progress: sessionProgress,
    needsRestore,
    consumeRestoredProgress,
  } = usePractice();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const sessionLogged = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPostMood = useRef<Mood | null>(null);

  // Mood check-in state (v3.4)
  const [showPreMood, setShowPreMood] = useState(false);
  const [showPostMood, setShowPostMood] = useState(false);
  const [preMood, setPreMood] = useState<Mood | null>(null);
  const [postMood, setPostMood] = useState<Mood | null>(null);
  const [confetti, setConfetti] = useState(false);
  const finishedMinutes = useRef(1);

  const current = todays[index];
  useWakeLock(started && !paused && !finished);

  // Restore mid-session progress after refresh.
  useEffect(() => {
    if (!needsRestore || !sessionProgress || sessionProgress.mode !== "practice") return;
    if (todays.length === 0) return;
    setIndex(Math.min(sessionProgress.index, todays.length - 1));
    setRemaining(
      sessionProgress.remaining ??
        todays[Math.min(sessionProgress.index, todays.length - 1)]?.holdSeconds ??
        30,
    );
    setElapsedTotal(sessionProgress.elapsedTotal ?? 0);
    setStarted(!!sessionProgress.started);
    setPaused(true);
    consumeRestoredProgress();
    toast({
      title: "Session restored",
      description: "Your practice was paused after a refresh. Tap Resume when ready.",
    });
  }, [needsRestore, sessionProgress, todays, consumeRestoredProgress, toast]);

  // Snapshot progress while running.
  useEffect(() => {
    if (!started || finished || todays.length === 0) return;
    saveProgress({
      mode: "practice",
      index,
      remaining,
      started: true,
      elapsedTotal,
      paused,
    });
  }, [started, finished, index, remaining, elapsedTotal, paused, todays.length, saveProgress]);

  // Persist the session + auto-journal + milestone celebration. Runs once the
  // post-mood check-in resolves (picked or skipped).
  const finalizeSession = useCallback(
    async (resolvedPost: Mood | null) => {
      if (sessionLogged.current || saving) return;
      lastPostMood.current = resolvedPost;
      setSaving(true);
      setSaveFailed(false);
      const minutes = finishedMinutes.current;
      const poseNames = todays.map((a) => a.english);
      const sessionLabel = meta.label ?? "Practice session";

      const result = await logPracticeSession({
        minutes,
        poseNames,
        label: sessionLabel,
        pathwaySlug: meta.pathwaySlug ?? null,
        preMood,
        postMood: resolvedPost,
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
    setStarted(false);
    setFinished(true);
    const minutes = Math.max(1, Math.round(elapsedTotal / 60));
    finishedMinutes.current = minutes;
    playChime();
    // Prompt for post-practice mood before persisting.
    setShowPostMood(true);
  }, [elapsedTotal]);

  // Step 1 of begin: show the pre-mood prompt (optional).
  const requestBegin = () => {
    if (todays.length === 0) return;
    setShowPreMood(true);
  };

  // Step 2 of begin: actually start the timer.
  const startTimer = () => {
    setStarted(true);
    setFinished(false);
    setIndex(0);
    setRemaining(todays[0].holdSeconds);
    setElapsedTotal(0);
    setPaused(false);
    sessionLogged.current = false;
    setPostMood(null);
  };

  const nextPose = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= todays.length) {
        return i;
      }
      setRemaining(todays[i + 1].holdSeconds);
      playChime();
      return i + 1;
    });
  }, [todays]);

  // Countdown tick
  useEffect(() => {
    if (!started || paused) return;
    const t = setInterval(() => {
      setElapsedTotal((e) => e + 1);
      setRemaining((r) => {
        if (r <= 1) {
          if (index + 1 >= todays.length) {
            clearInterval(t);
            finish();
            return 0;
          } else {
            playChime();
            setIndex((i) => i + 1);
            return todays[index + 1].holdSeconds;
          }
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, paused, index, todays, finish]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const suggestedBreath = meta.breathSlug ? breathBySlug(meta.breathSlug) : null;

  // Empty state
  if (todays.length === 0 && !finished) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          title="No asanas selected"
          description="Start from the practice hub — pick a mood session, warm-up, or pathway — then switch to timer-only if you prefer."
        >
          <Button asChild data-testid="button-go-practice-hub">
            <Link href="/guided">Start practice</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  // Finished screen
  if (finished) {
    const reflection =
      preMood && postMood
        ? `You moved from ${preMood} → ${postMood}. Beautiful.`
        : null;
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
        <div className="animate-fade-in flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
          <AnimatedPose pose="savasana" size={120} className="text-primary" />
          <h1 className="font-serif text-3xl">Namaste 🙏</h1>
          <p className="text-muted-foreground">
            You practiced {finishedMinutes.current} minutes.
            {sessionLogged.current
              ? " Session logged."
              : saveFailed
                ? " Not saved yet."
                : saving
                  ? " Saving…"
                  : ""}
          </p>
          {saveFailed && (
            <Button
              onClick={() => finalizeSession(lastPostMood.current)}
              disabled={saving}
              data-testid="button-retry-save"
            >
              Retry save
            </Button>
          )}
          {reflection && (
            <p className="font-serif text-lg text-primary" data-testid="text-mood-reflection">
              {reflection}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                clear();
                navigate("/");
              }}
              data-testid="button-finish-home"
            >
              Back home
            </Button>
            <Button
              onClick={() => {
                navigate(
                  `/journal?new=1&title=${encodeURIComponent(meta.label ?? "Practice reflection")}`,
                );
              }}
              data-testid="button-journal-prompt"
            >
              Reflect in journal
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Pre-start preview
  if (!started) {
    return (
      <>
        <MoodCheckIn
          open={showPreMood}
          title="How are you feeling?"
          description="Optional — a quick check-in before you begin."
          confirmLabel="Skip"
          testIdPrefix="premood"
          onPick={(m) => {
            setPreMood(m);
            setShowPreMood(false);
            startTimer();
          }}
          onSkip={() => {
            setPreMood(null);
            setShowPreMood(false);
            startTimer();
          }}
        />
        <div className="animate-fade-in space-y-6">
          <header className="space-y-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">Today's practice</h1>
            <p className="text-muted-foreground">
              {meta.label ? `${meta.label} · ` : ""}
              {todays.length} poses queued. Press start when you're ready.
            </p>
            <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-sm" data-testid="mode-toggle">
              <button
                onClick={() => navigate("/guided")}
                className="rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
                data-testid="toggle-guided"
              >
                Guided
              </button>
              <button
                className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                data-testid="toggle-simple"
                aria-pressed="true"
              >
                Timer only
              </button>
            </div>
          </header>
          <Card className="shadow-soft">
            <CardContent className="space-y-2 p-5">
              {todays.map((a, i) => (
                <div
                  key={a.slug}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid={`queue-item-${a.slug}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-primary">
                      <AnimatedPose pose={a.pose} size={32} />
                    </span>
                    {i + 1}. {a.english}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.holdSeconds}s</span>
                </div>
              ))}
              {suggestedBreath && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Suggested breath afterward: {suggestedBreath.name}
                </p>
              )}
            </CardContent>
          </Card>
          <Button size="lg" className="w-full" onClick={requestBegin} data-testid="button-begin-session">
            <Play className="mr-2 h-5 w-5" /> Begin session
          </Button>
        </div>
      </>
    );
  }

  // Full-screen timer
  const progress = current ? 1 - remaining / current.holdSeconds : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-center">
      <button
        onClick={() => {
          setStarted(false);
        }}
        className="absolute right-5 top-5 text-muted-foreground hover:text-foreground"
        data-testid="button-exit-timer"
        aria-label="Exit timer"
      >
        <X className="h-6 w-6" />
      </button>

      <p className="mb-1 text-sm uppercase tracking-widest text-muted-foreground">
        Pose {index + 1} of {todays.length}
      </p>
      <div className="text-primary">
        <AnimatedPose pose={current?.pose || "mountain"} size={180} />
      </div>
      <h1 className="mt-2 font-serif text-3xl" data-testid="text-current-pose">{current?.english}</h1>
      <p className="text-muted-foreground">{current?.sanskrit}</p>
      <p className="text-sm text-muted-foreground">{current?.breathing}</p>

      <div className="relative my-6 flex h-40 w-40 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 44}
            strokeDashoffset={2 * Math.PI * 44 * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span className="font-serif text-5xl tabular-nums" data-testid="text-countdown">{mmss(remaining)}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="lg" onClick={() => setPaused((p) => !p)} data-testid="button-pause">
          {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          <span className="ml-1.5">{paused ? "Resume" : "Pause"}</span>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            if (index + 1 >= todays.length) finish();
            else nextPose();
          }}
          data-testid="button-skip"
        >
          <SkipForward className="mr-1.5 h-5 w-5" /> Skip
        </Button>
        <Button size="lg" onClick={finish} data-testid="button-complete-session">
          <Check className="mr-1.5 h-5 w-5" /> Finish
        </Button>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Total: <span className="tabular-nums" data-testid="text-total-timer">{mmss(elapsedTotal)}</span>
      </p>
    </div>
  );
}
