import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PoseSvg } from "@/components/PoseSvg";
import { EmptyState } from "@/components/EmptyState";
import { usePractice } from "@/context/PracticeContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { todayISO } from "@/lib/sadhana";
import { Link } from "wouter";
import { Play, Pause, SkipForward, X, Check } from "lucide-react";

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
  const { todays, clear } = usePractice();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const sessionLogged = useRef(false);

  const current = todays[index];

  const logSession = useCallback(
    (minutes: number) => {
      if (sessionLogged.current) return;
      sessionLogged.current = true;
      apiRequest("POST", "/api/sessions", {
        date: todayISO(),
        durationMinutes: Math.max(1, minutes),
        asanas: JSON.stringify(todays.map((a) => a.english)),
        pathwaySlug: null,
        notes: null,
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        })
        .catch(() => {});
    },
    [todays],
  );

  const finish = useCallback(() => {
    setStarted(false);
    setFinished(true);
    const minutes = Math.max(1, Math.round(elapsedTotal / 60));
    logSession(minutes);
    playChime();
    const poseList = todays.map((a) => a.english).join(", ");
    toast({
      title: "Practice complete 🌿",
      description: "Add a quick reflection to your journal?",
      action: (
        <Button
          size="sm"
          onClick={() =>
            navigate(
              `/journal?new=1&title=${encodeURIComponent("Practice reflection")}&body=${encodeURIComponent(
                `Today I practiced: ${poseList}. ${minutes} min.`,
              )}`,
            )
          }
          data-testid="button-journal-prompt"
        >
          Reflect
        </Button>
      ),
    });
  }, [elapsedTotal, logSession, navigate, todays, toast]);

  // Start the timer
  const begin = () => {
    if (todays.length === 0) return;
    setStarted(true);
    setFinished(false);
    setIndex(0);
    setRemaining(todays[0].holdSeconds);
    setElapsedTotal(0);
    setPaused(false);
    sessionLogged.current = false;
  };

  const nextPose = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= todays.length) {
        return i; // handled by effect below
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
          // move to next pose or finish
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

  // Empty state
  if (todays.length === 0 && !finished) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          title="No asanas selected"
          description="Add a few poses from the Asana Library to build today's session, then return here to practice."
        >
          <Button asChild data-testid="button-go-library">
            <Link href="/asanas">Browse the library</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  // Finished screen
  if (finished) {
    return (
      <div className="animate-fade-in flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <PoseSvg pose="savasana" size={120} className="text-primary" />
        <h1 className="font-serif text-3xl">Namaste 🙏</h1>
        <p className="text-muted-foreground">
          You practiced {Math.max(1, Math.round(elapsedTotal / 60))} minutes. Session logged.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { clear(); navigate("/"); }} data-testid="button-finish-home">
            Back to dashboard
          </Button>
          <Button onClick={() => { setFinished(false); }} data-testid="button-practice-again">
            Practice again
          </Button>
        </div>
      </div>
    );
  }

  // Pre-start preview
  if (!started) {
    return (
      <div className="animate-fade-in space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Today's practice</h1>
          <p className="text-muted-foreground">{todays.length} poses queued. Press start when you're ready.</p>
        </header>
        <Card className="shadow-soft">
          <CardContent className="space-y-2 p-5">
            {todays.map((a, i) => (
              <div key={a.slug} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid={`queue-item-${a.slug}`}>
                <span className="flex items-center gap-2">
                  <span className="text-primary"><PoseSvg pose={a.pose} size={32} /></span>
                  {i + 1}. {a.english}
                </span>
                <span className="text-xs text-muted-foreground">{a.holdSeconds}s</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Button size="lg" className="w-full" onClick={begin} data-testid="button-begin-session">
          <Play className="mr-2 h-5 w-5" /> Begin session
        </Button>
      </div>
    );
  }

  // Full-screen timer
  const progress = current ? 1 - remaining / current.holdSeconds : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-center">
      <button
        onClick={() => { setStarted(false); }}
        className="absolute right-5 top-5 text-muted-foreground hover:text-foreground"
        data-testid="button-exit-timer"
        aria-label="Exit timer"
      >
        <X className="h-6 w-6" />
      </button>

      <p className="mb-1 text-sm uppercase tracking-widest text-muted-foreground">
        Pose {index + 1} of {todays.length}
      </p>
      <div className="text-primary animate-breathe">
        <PoseSvg pose={current?.pose || "mountain"} size={180} />
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
