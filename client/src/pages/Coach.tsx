import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePractice } from "@/context/PracticeContext";
import { useCoachBadge } from "@/context/CoachBadgeContext";
import { asanaBySlug } from "@/data/content";
import type { Session, CoachSession } from "@shared/schema";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Play,
  RefreshCw,
  Check,
  Leaf,
  Zap,
  Brain,
  Moon,
  Move,
  Wind,
  X,
} from "lucide-react";

// ---- Wizard option definitions ----
const BODY_OPTIONS = [
  "Rested",
  "Sore",
  "Tight",
  "Injured",
  "Restless legs",
  "Tired",
  "Nothing specific",
] as const;

const BODY_PARTS = [
  "Lower back",
  "Upper back",
  "Neck & shoulders",
  "Hips",
  "Hamstrings",
  "Knees",
  "Wrists",
  "None specific",
] as const;

const ENERGY_OPTIONS = ["Low & sluggish", "Balanced", "Restless & wired", "Anxious"] as const;

const TIME_OPTIONS = [5, 10, 15, 20, 30] as const;

const NEED_OPTIONS: { key: string; label: string; desc: string; icon: any }[] = [
  { key: "calm", label: "Calm", desc: "settle a busy mind", icon: Leaf },
  { key: "energy", label: "Energy", desc: "wake up the body", icon: Zap },
  { key: "flexibility", label: "Flexibility", desc: "open the tight parts", icon: Move },
  { key: "focus", label: "Focus", desc: "mental clarity", icon: Brain },
  { key: "sleep", label: "Sleep prep", desc: "wind down for rest", icon: Moon },
  { key: "movement", label: "Just move", desc: "general movement", icon: Wind },
];

const REVEAL_BODY = new Set(["Sore", "Tight", "Injured"]);

// Map coach need key -> energy label used for check-in memory display
const NEED_LABEL: Record<string, string> = {
  calm: "Calm",
  energy: "Energy",
  flexibility: "Flexibility",
  focus: "Focus",
  sleep: "Sleep prep",
  movement: "Just move",
};

type ComposedPose = { slug: string; holdSeconds: number; sides?: "once" | "each"; why: string };
type ComposeResult = {
  reasoning: string;
  poses: ComposedPose[];
  totalMinutes: number;
  source: "llm" | "fallback";
  coachSessionId?: number | null;
};

function fmtHold(seconds: number, sides?: "once" | "each") {
  const label =
    seconds >= 60
      ? `${Math.round((seconds / 60) * 10) / 10} min`.replace(".0", "")
      : `${seconds} sec`;
  return sides === "each" ? `${label} each side` : label;
}

// Big multi-select / single-select chip button
function ChipButton({
  selected,
  onClick,
  children,
  testId,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={selected}
      className={`rounded-2xl border px-5 py-4 text-left text-base font-medium transition-all hover-elevate ${
        selected
          ? "border-primary bg-primary/10 text-foreground shadow-soft ring-1 ring-primary/40"
          : "border-border bg-background text-foreground hover:border-primary/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-3 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export default function Coach() {
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const { markVisited } = useCoachBadge();

  useEffect(() => {
    markVisited();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Wizard state ----
  const [step, setStep] = useState(0); // 0..3
  const [body, setBody] = useState<string[]>([]);
  const [soreParts, setSoreParts] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string>("");
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [need, setNeed] = useState<string>("");

  // ---- Result / phase state ----
  const [phase, setPhase] = useState<"wizard" | "composing" | "result" | "error">("wizard");
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [showTour, setShowTour] = useState(true);

  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"] });
  const { data: coachHistory = [] } = useQuery<CoachSession[]>({
    queryKey: ["/api/coach/sessions"],
  });

  const showBodyParts = body.some((b) => REVEAL_BODY.has(b));

  // Returning-user greeting from the last completed coach session.
  const lastCompleted = useMemo(
    () => coachHistory.find((c) => c.outcome === "completed"),
    [coachHistory],
  );
  const memoryLine = useMemo(() => {
    if (!lastCompleted) return null;
    try {
      const ci = JSON.parse(lastCompleted.checkIn);
      const comp = JSON.parse(lastCompleted.composed);
      const feltBefore =
        (ci.body && ci.body.length ? ci.body[0].toLowerCase() : null) ??
        (ci.energy ? String(ci.energy).toLowerCase() : "a certain way");
      const need = NEED_LABEL[ci.need] ?? ci.need;
      const poseCount = Array.isArray(comp.poses) ? comp.poses.length : 0;
      const felt = lastCompleted.postMood ? lastCompleted.postMood.toLowerCase() : "lighter";
      return `Last time you felt ${feltBefore}, we did a ${poseCount}-pose ${String(
        need,
      ).toLowerCase()} practice — you left feeling ${felt}. Ready for today?`;
    } catch {
      return null;
    }
  }, [lastCompleted]);

  const toggleMulti = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    if (value === "Nothing specific" || value === "None specific") {
      setArr(arr.includes(value) ? [] : [value]);
      return;
    }
    const without = arr.filter((v) => v !== "Nothing specific" && v !== "None specific");
    setArr(
      without.includes(value) ? without.filter((v) => v !== value) : [...without, value],
    );
  };

  const canAdvance =
    step === 0
      ? body.length > 0
      : step === 1
        ? energy !== ""
        : step === 2
          ? timeMinutes !== null
          : need !== "";

  const doCompose = async () => {
    setPhase("composing");
    const recentSessions = sessions.slice(0, 5).map((s) => ({
      asanas: s.asanas,
      date: s.date,
      label: s.notes ?? undefined,
    }));
    const startedAt = Date.now();
    try {
      const res = await apiRequest("POST", "/api/coach/compose", {
        body,
        soreParts: showBodyParts ? soreParts.filter((p) => p !== "None specific") : [],
        energy: energy || "Balanced",
        timeMinutes: timeMinutes ?? 10,
        need: need || "movement",
        recentSessions,
      });
      const data = (await res.json()) as ComposeResult;
      // Keep the calming loader visible for a minimum ~2s.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 2000) await new Promise((r) => setTimeout(r, 2000 - elapsed));
      setResult(data);
      setPhase("result");
      queryClient.invalidateQueries({ queryKey: ["/api/coach/sessions"] });
    } catch {
      setPhase("error");
    }
  };

  const startGuided = () => {
    if (!result) return;
    const poses = result.poses.flatMap((p) => {
      const asana = asanaBySlug(p.slug);
      return asana ? [{ asana, holdSeconds: p.holdSeconds, sides: p.sides }] : [];
    });
    if (poses.length === 0) return;
    loadSession(poses, {
      label: `Coach — ${NEED_LABEL[need] ?? need} · ${timeMinutes} min`,
      coachSessionId: result.coachSessionId ?? null,
    });
    navigate("/guided");
  };

  const reset = () => {
    setStep(0);
    setBody([]);
    setSoreParts([]);
    setEnergy("");
    setTimeMinutes(null);
    setNeed("");
    setResult(null);
    setPhase("wizard");
  };

  // ---------- Composing loader ----------
  if (phase === "composing") {
    return (
      <div className="flex min-h-[60vh] animate-fade-in flex-col items-center justify-center text-center">
        <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-4 animate-pulse rounded-full bg-primary/15" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="h-9 w-9 animate-pulse" />
          </span>
        </div>
        <h1 className="font-serif text-2xl" data-testid="text-composing">
          Composing your practice…
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Listening to how you feel today and shaping a sequence just for right now.
        </p>
      </div>
    );
  }

  // ---------- Result ----------
  if (phase === "result" && result) {
    return (
      <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Your practice for today</span>
          {result.source === "fallback" && (
            <Badge variant="outline" className="ml-auto text-xs" data-testid="badge-fallback">
              offline composer
            </Badge>
          )}
        </div>

        <Card className="border-primary/30 bg-accent/30 shadow-soft">
          <CardContent className="p-6">
            <p className="font-serif text-lg leading-relaxed" data-testid="text-reasoning">
              {result.reasoning}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="tabular-nums" data-testid="badge-total-minutes">
                ~{result.totalMinutes} min
              </Badge>
              <Badge variant="outline">{result.poses.length} poses</Badge>
              <Badge variant="outline">{NEED_LABEL[need] ?? need}</Badge>
            </div>
          </CardContent>
        </Card>

        <ol className="space-y-3" data-testid="list-composed-poses">
          {result.poses.map((p, i) => {
            const asana = asanaBySlug(p.slug);
            return (
              <li key={`${p.slug}-${i}`}>
                <Card className="shadow-soft" data-testid={`composed-pose-${p.slug}`}>
                  <CardContent className="flex items-center gap-4 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                      {i + 1}
                    </span>
                    <img
                      src={`${import.meta.env.BASE_URL}poses/${p.slug}.png`}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      draggable={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="font-serif text-base leading-tight">
                          {asana?.english ?? p.slug}
                        </p>
                        <span className="text-xs italic text-muted-foreground">
                          {asana?.sanskrit}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{p.why}</p>
                    </div>
                    <span className="shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                      {fmtHold(p.holdSeconds, p.sides)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="flex-1 bg-primary text-primary-foreground"
            onClick={startGuided}
            data-testid="button-start-guided"
          >
            <Play className="mr-2 h-4 w-4" /> Start guided session
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={doCompose}
            data-testid="button-compose-different"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Compose a different one
          </Button>
        </div>
        <button
          onClick={reset}
          className="mx-auto block text-sm text-muted-foreground underline-offset-2 hover:underline"
          data-testid="button-restart-checkin"
        >
          Start a new check-in
        </button>
      </div>
    );
  }

  // ---------- Error ----------
  if (phase === "error") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md animate-fade-in flex-col items-center justify-center text-center">
        <h1 className="font-serif text-2xl">Something interrupted the flow</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your coach couldn't compose a session just now. Let's try again.
        </p>
        <Button className="mt-6" onClick={doCompose} data-testid="button-retry-compose">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  // ---------- Wizard ----------
  const QUESTIONS = [
    "How's your body feeling today?",
    "Your energy?",
    "How much time do you have?",
    "What do you need most today?",
  ];

  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      {/* Onboarding tour overlay for first-time users */}
      {showTour && !lastCompleted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          data-testid="coach-tour"
        >
          <Card className="max-w-sm shadow-soft-lg">
            <CardContent className="space-y-4 p-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-7 w-7" />
              </span>
              <h2 className="font-serif text-xl">This is Sadhana's coach</h2>
              <p className="text-sm text-muted-foreground">
                Answer 4 quick questions, and I'll build you a session just for right now —
                tailored to your body today.
              </p>
              <Button
                className="w-full"
                onClick={() => setShowTour(false)}
                data-testid="button-tour-start"
              >
                Let's begin
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Your coach</span>
        </div>
        {memoryLine && (
          <Card className="border-secondary/40 bg-secondary/10 shadow-soft" data-testid="card-memory">
            <CardContent className="p-4">
              <p className="text-sm leading-relaxed text-foreground">{memoryLine}</p>
            </CardContent>
          </Card>
        )}
        <StepDots step={step} total={4} />
        <h1 className="font-serif text-2xl leading-tight tracking-tight" data-testid="text-question">
          {QUESTIONS[step]}
        </h1>
      </header>

      {/* Question 1: body */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select all that apply.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BODY_OPTIONS.map((opt) => (
              <ChipButton
                key={opt}
                selected={body.includes(opt)}
                onClick={() => toggleMulti(body, setBody, opt)}
                testId={`body-${opt.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              >
                {opt}
              </ChipButton>
            ))}
          </div>
          {showBodyParts && (
            <div className="animate-fade-in space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium">Where, specifically?</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {BODY_PARTS.map((part) => (
                  <ChipButton
                    key={part}
                    selected={soreParts.includes(part)}
                    onClick={() => toggleMulti(soreParts, setSoreParts, part)}
                    testId={`part-${part.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                    className="py-3 text-sm"
                  >
                    {part}
                  </ChipButton>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question 2: energy */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ENERGY_OPTIONS.map((opt) => (
            <ChipButton
              key={opt}
              selected={energy === opt}
              onClick={() => setEnergy(opt)}
              testId={`energy-${opt.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              {opt}
            </ChipButton>
          ))}
        </div>
      )}

      {/* Question 3: time */}
      {step === 2 && (
        <div className="flex flex-wrap gap-3">
          {TIME_OPTIONS.map((t) => (
            <ChipButton
              key={t}
              selected={timeMinutes === t}
              onClick={() => setTimeMinutes(t)}
              testId={`time-${t}`}
              className="min-w-[88px] text-center tabular-nums"
            >
              {t} min
            </ChipButton>
          ))}
        </div>
      )}

      {/* Question 4: need */}
      {step === 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEED_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <ChipButton
                key={opt.key}
                selected={need === opt.key}
                onClick={() => setNeed(opt.key)}
                testId={`need-${opt.key}`}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block leading-tight">{opt.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {opt.desc}
                  </span>
                </span>
              </ChipButton>
            );
          })}
        </div>
      )}

      {/* Nav controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            data-testid="button-next"
          >
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="bg-primary text-primary-foreground"
            onClick={doCompose}
            disabled={!canAdvance}
            data-testid="button-compose"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Compose my practice
          </Button>
        )}
      </div>
    </div>
  );
}
