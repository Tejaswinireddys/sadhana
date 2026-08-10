/**
 * BetterMe-style acquisition quiz: large option tiles, progress, plan reveal.
 * Ethical difference: free practice continues — upgrade is optional, never forced.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { KEYS, writeString } from "@/lib/localPrefs";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";

type Option = { id: string; label: string; hint?: string };
type Question = { id: string; prompt: string; options: Option[] };

const QUESTIONS: Question[] = [
  {
    id: "goal",
    prompt: "What do you want most right now?",
    options: [
      { id: "calm", label: "Feel calmer", hint: "Ease stress and racing thoughts" },
      { id: "mobility", label: "Move more freely", hint: "Loosen stiff hips and back" },
      { id: "strength", label: "Build gentle strength", hint: "Stand taller, feel steadier" },
      { id: "sleep", label: "Sleep better", hint: "Wind down before bed" },
    ],
  },
  {
    id: "body",
    prompt: "Where should we go gently?",
    options: [
      { id: "neck", label: "Neck & shoulders" },
      { id: "hips", label: "Hips & lower back" },
      { id: "full", label: "Full body, easy pace" },
      { id: "breath", label: "Breath & stillness" },
    ],
  },
  {
    id: "experience",
    prompt: "How familiar are you with yoga?",
    options: [
      { id: "new", label: "Brand new", hint: "We'll keep shapes simple" },
      { id: "some", label: "A little experience" },
      { id: "regular", label: "I practice regularly" },
    ],
  },
  {
    id: "time",
    prompt: "How much time do you usually have?",
    options: [
      { id: "10", label: "About 10 minutes" },
      { id: "20", label: "About 20 minutes" },
      { id: "30", label: "30 minutes or more" },
    ],
  },
  {
    id: "habit",
    prompt: "What usually gets in the way?",
    options: [
      { id: "busy", label: "A packed day" },
      { id: "energy", label: "Low energy" },
      { id: "guilt", label: "Feeling behind on streaks" },
      { id: "unsure", label: "Not knowing where to start" },
    ],
  },
];

type Phase = "quiz" | "building" | "plan";

function planCopy(answers: Record<string, string>) {
  const goal = answers.goal || "calm";
  const minutes = answers.time === "30" ? 30 : answers.time === "20" ? 20 : 10;
  const titles: Record<string, string> = {
    calm: "Your Calm Reset Plan",
    mobility: "Your Mobility Flow Plan",
    strength: "Your Steady Strength Plan",
    sleep: "Your Better Sleep Plan",
  };
  const focuses: Record<string, string> = {
    neck: "neck and shoulders",
    hips: "hips and lower back",
    full: "your whole body",
    breath: "breath and stillness",
  };
  return {
    title: titles[goal] || "Your Personal Practice Plan",
    minutes,
    focus: focuses[answers.body || "full"] || "your whole body",
    experience: answers.experience || "new",
    habit: answers.habit || "unsure",
  };
}

export default function StartQuiz() {
  useDocumentTitle("Find your plan · Sadhana");
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("quiz");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const question = QUESTIONS[index];
  const progress = ((index + (phase === "quiz" ? 1 : QUESTIONS.length)) / QUESTIONS.length) * 100;
  const plan = useMemo(() => planCopy(answers), [answers]);

  useEffect(() => {
    writeString(KEYS.welcomeSeen, "1");
  }, []);

  useEffect(() => {
    if (phase !== "building") return;
    const t = window.setTimeout(() => setPhase("plan"), 1600);
    return () => window.clearTimeout(t);
  }, [phase]);

  const pick = (optionId: string) => {
    if (!question) return;
    setSelected(optionId);
    const nextAnswers = { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);
    window.setTimeout(() => {
      setSelected(null);
      if (index + 1 < QUESTIONS.length) {
        setIndex(index + 1);
      } else {
        setPhase("building");
      }
    }, 220);
  };

  const startPractice = () => {
    writeString(KEYS.onboardingDone, "1");
    navigate("/guided");
  };

  return (
    <div className="funnel-shell min-h-[100svh] bg-background text-foreground" data-testid="start-quiz">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
          <Link href="/welcome" className="flex items-center gap-2 text-foreground" aria-label="Sadhana">
            <LotusMark size={22} />
            <span className="font-serif text-lg font-semibold tracking-tight">Sadhana</span>
          </Link>
          {phase === "quiz" && (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {index + 1}/{QUESTIONS.length}
            </span>
          )}
        </div>
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, phase === "quiz" ? progress : 100)}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-8">
        {phase === "quiz" && question && (
          <section className="space-y-6" aria-labelledby="quiz-prompt">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Personalized plan
              </p>
              <h1 id="quiz-prompt" className="font-serif text-3xl font-semibold leading-tight tracking-tight">
                {question.prompt}
              </h1>
            </div>
            <div className="grid gap-3">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`quiz-option-${opt.id}`}
                  onClick={() => pick(opt.id)}
                  className={cn(
                    "funnel-option group flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-all",
                    "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === opt.id && "border-primary bg-primary/10 shadow-soft",
                  )}
                >
                  <span>
                    <span className="block text-base font-semibold">{opt.label}</span>
                    {opt.hint && (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{opt.hint}</span>
                    )}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === "building" && (
          <section className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center" data-testid="plan-building">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary funnel-pulse">
              <Sparkles className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="font-serif text-2xl font-semibold">Building your plan…</h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              Matching poses, pace, and a gentle first session to your answers.
            </p>
          </section>
        )}

        {phase === "plan" && (
          <section className="space-y-6" data-testid="plan-reveal">
            <div className="space-y-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your plan is ready</p>
              <h1 className="font-serif text-3xl font-semibold tracking-tight">{plan.title}</h1>
              <p className="text-muted-foreground">
                A {plan.minutes}-minute practice focused on {plan.focus}
                {plan.experience === "new" ? " — beginner-friendly shapes" : ""}.
              </p>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-primary/25 bg-card p-6 shadow-soft">
              {[
                `${plan.minutes}-minute guided session matched to you`,
                "Safety notes and modifications on every pose",
                "No streak shame if you miss a day",
                "Start free — account optional",
              ].map((line) => (
                <div key={line} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                className="min-h-14 w-full text-base"
                onClick={startPractice}
                data-testid="start-first-session"
              >
                Start my first session <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 w-full"
                asChild
              >
                <Link href="/" onClick={() => writeString(KEYS.onboardingDone, "1")}>
                  Explore the app first
                </Link>
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Want more later?{" "}
              <Link href="/plus" className="underline underline-offset-2">
                See plans
              </Link>
              {" · "}
              cancel anytime in two taps.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
