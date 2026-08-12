/**
 * Premium acquisition quiz: large option tiles → building → plan with pose previews
 * → loads a real guided session (not an empty Practice hub).
 * Emits funnel product analytics events (PostHog + local buffer).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { KEYS, writeString, type ExperienceLevel, type PracticeIntent } from "@/lib/localPrefs";
import { captureProduct, rememberFunnelFlowId, trackAppFirstOpen } from "@/lib/productAnalytics";
import { cn } from "@/lib/utils";
import { usePractice } from "@/context/PracticeContext";
import { asanaBySlug } from "@/data/content";
import { buildQuizPlan, parseProgramRef, type QuizAnswers } from "@/data/quizPlan";
import { parseAttribution, attributionProps } from "../../../funnel/attribution";
import { resolveFlowId } from "../../../funnel/flows";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";

type Option = { id: string; label: string; hint?: string };
type Question = { id: keyof QuizAnswers; prompt: string; options: Option[] };

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

function persistQuizPrefs(intent: PracticeIntent, experience: ExperienceLevel) {
  writeString(KEYS.practiceIntent, intent);
  writeString(KEYS.experienceLevel, experience);
}

export default function StartQuiz() {
  useDocumentTitle("Find your plan · Sadhana");
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const [phase, setPhase] = useState<Phase>("quiz");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const attr = useMemo(() => {
    if (typeof window === "undefined") return parseAttribution({});
    return parseAttribution(new URLSearchParams(window.location.search));
  }, []);
  const flowId = useMemo(
    () => resolveFlowId(attr.flow_id, attr.ref),
    [attr.flow_id, attr.ref],
  );
  const utm = useMemo(() => attributionProps(attr), [attr]);

  const startedRef = useRef(false);
  const quizStartedAt = useRef(Date.now());
  const questionShownAt = useRef(Date.now());
  const lastQuestionId = useRef(QUESTIONS[0]?.id ?? "goal");
  const abandonedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const question = QUESTIONS[index];
  const progress = ((index + (phase === "quiz" ? 1 : QUESTIONS.length)) / QUESTIONS.length) * 100;
  const plan = useMemo(() => buildQuizPlan(answers), [answers]);

  useEffect(() => {
    writeString(KEYS.welcomeSeen, "1");
  }, []);

  // Honor /start?ref=program-* from landing tiles — pre-fill, don't skip the quiz.
  useEffect(() => {
    if (seeded) return;
    const seed = parseProgramRef(window.location.search);
    if (seed) setAnswers((prev) => ({ ...seed, ...prev }));
    setSeeded(true);
  }, [seeded]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    rememberFunnelFlowId(flowId);
    quizStartedAt.current = Date.now();
    void trackAppFirstOpen(attr.ref ? `quiz:${attr.ref}` : "quiz");
    void captureProduct("quiz_started", {
      flow_id: flowId,
      ref: attr.ref,
      ...utm,
    });
    const q0 = QUESTIONS[0];
    if (q0) {
      lastQuestionId.current = q0.id;
      questionShownAt.current = Date.now();
      void captureProduct("quiz_question_shown", {
        flow_id: flowId,
        question_id: q0.id,
        index: 0,
      });
    }
  }, [flowId, attr.ref, utm]);

  useEffect(() => {
    const onLeave = () => {
      if (abandonedRef.current || phaseRef.current !== "quiz") return;
      abandonedRef.current = true;
      void captureProduct("quiz_abandoned", {
        flow_id: flowId,
        last_question_id: lastQuestionId.current,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!abandonedRef.current && phaseRef.current === "quiz") onLeave();
    };
  }, [flowId]);

  useEffect(() => {
    if (phase !== "building") return;
    const t = window.setTimeout(() => {
      void captureProduct("plan_revealed", { flow_id: flowId });
      setPhase("plan");
    }, 1400);
    return () => window.clearTimeout(t);
  }, [phase, flowId]);

  const showQuestion = useCallback(
    (nextIndex: number) => {
      const q = QUESTIONS[nextIndex];
      if (!q) return;
      lastQuestionId.current = q.id;
      questionShownAt.current = Date.now();
      void captureProduct("quiz_question_shown", {
        flow_id: flowId,
        question_id: q.id,
        index: nextIndex,
      });
    },
    [flowId],
  );

  const pick = (optionId: string) => {
    if (!question) return;
    const ms = Math.max(0, Date.now() - questionShownAt.current);
    void captureProduct("quiz_answered", {
      flow_id: flowId,
      question_id: question.id,
      answer: optionId,
      ms_on_screen: ms,
    });
    setSelected(optionId);
    const nextAnswers = { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);
    window.setTimeout(() => {
      setSelected(null);
      if (index + 1 < QUESTIONS.length) {
        const next = index + 1;
        setIndex(next);
        showQuestion(next);
      } else {
        abandonedRef.current = true;
        const duration = Math.max(0, Date.now() - quizStartedAt.current);
        void captureProduct("quiz_completed", { flow_id: flowId, duration_ms: duration });
        const built = buildQuizPlan(nextAnswers);
        persistQuizPrefs(built.intent, built.experience);
        setPhase("building");
      }
    }, 220);
  };

  const goBack = () => {
    if (phase !== "quiz" || index === 0) return;
    setSelected(null);
    setIndex((i) => Math.max(0, i - 1));
  };

  const startPractice = () => {
    writeString(KEYS.onboardingDone, "1");
    persistQuizPrefs(plan.intent, plan.experience);
    const poses = plan.poses
      .map((p) => {
        const asana = asanaBySlug(p.slug);
        return asana
          ? {
              asana,
              holdSeconds: p.holdSeconds,
              ...(p.sides === "each" ? { sides: "each" as const } : {}),
            }
          : null;
      })
      .filter(
        (
          x,
        ): x is {
          asana: NonNullable<ReturnType<typeof asanaBySlug>>;
          holdSeconds: number;
          sides?: "each";
        } => x != null,
      );
    if (!poses.length) {
      navigate("/guided");
      return;
    }
    loadSession(poses, {
      label: plan.title,
      plannedMinutes: plan.minutes,
      breathSlug: plan.breathSlug ?? null,
      introPoseSlug: plan.introPoseSlug,
    });
    navigate("/guided");
  };

  return (
    <div className="funnel-shell min-h-[100svh] text-foreground" data-testid="start-quiz">
      <div className="yoga-atmosphere pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="yoga-grain pointer-events-none fixed inset-0 -z-10" aria-hidden />

      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            {phase === "quiz" && index > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Previous question"
                data-testid="quiz-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <Link href="/welcome" className="flex items-center gap-2 text-foreground" aria-label="Sadhana">
                <LotusMark size={22} />
                <span className="font-serif text-lg font-semibold tracking-tight">Sadhana</span>
              </Link>
            )}
          </div>
          {phase === "quiz" && (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {index + 1}/{QUESTIONS.length}
            </span>
          )}
        </div>
        <div className="h-1 bg-muted/80">
          <div
            className="funnel-progress h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, phase === "quiz" ? progress : 100)}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-8">
        {phase === "quiz" && question && (
          <section className="funnel-step space-y-6" aria-labelledby="quiz-prompt" key={question.id}>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Personalized plan
              </p>
              <h1
                id="quiz-prompt"
                className="font-serif text-3xl font-semibold leading-tight tracking-tight md:text-[2.15rem]"
              >
                {question.prompt}
              </h1>
              {answers.goal && question.id !== "goal" ? (
                <p className="text-sm text-muted-foreground">
                  Building around {plan.focus}
                  {answers.time ? ` · ~${answers.time} min` : ""}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3">
              {question.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`quiz-option-${opt.id}`}
                  onClick={() => pick(opt.id)}
                  className={cn(
                    "funnel-option group flex min-h-[4.5rem] items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-all duration-200",
                    "border-border/80 bg-card/90 shadow-soft hover:border-primary/45 hover:bg-primary/[0.06]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === opt.id && "border-primary bg-primary/10 ring-1 ring-primary/30",
                    answers[question.id] === opt.id && selected !== opt.id && "border-primary/40",
                  )}
                >
                  <span>
                    <span className="block text-base font-semibold tracking-tight">{opt.label}</span>
                    {opt.hint && (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{opt.hint}</span>
                    )}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === "building" && (
          <section
            className="flex min-h-[55vh] flex-col items-center justify-center space-y-5 text-center"
            data-testid="plan-building"
          >
            <span className="funnel-pulse flex h-20 w-20 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Sparkles className="h-8 w-8" aria-hidden />
            </span>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
                Crafting your first session…
              </h1>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
                Matching poses, pace, and breath to how you feel today — not a generic template.
              </p>
            </div>
          </section>
        )}

        {phase === "plan" && (
          <section className="funnel-step space-y-7" data-testid="plan-reveal">
            <div className="space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Your plan is ready
              </p>
              <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                {plan.title}
              </h1>
              <p className="text-muted-foreground">
                A {plan.timeLabel} practice focused on {plan.focus}
                {plan.experience === "new" ? " — beginner-friendly shapes" : ""}.
              </p>
            </div>

            {/* Pose preview strip — proof the plan is real */}
            <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90 shadow-soft">
              <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-none">
                {plan.poses.slice(0, 5).map((p) => {
                  const a = asanaBySlug(p.slug);
                  if (!a) return null;
                  return (
                    <div
                      key={p.slug}
                      className="w-[4.75rem] shrink-0 space-y-1.5"
                      data-testid="plan-pose-preview"
                    >
                      <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                        <img width={600} height={1200}
                          src={`${import.meta.env.BASE_URL}poses/${p.slug}.png`}
                          alt=""
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground">
                        {a.english}
                      </p>
                    </div>
                  );
                })}
              </div>
              <ul className="space-y-3 border-t border-border/60 px-5 py-5">
                {[
                  `${plan.poses.length} guided poses · ${plan.timeLabel}`,
                  "Safety notes and modifications on every pose",
                  "No streak shame if you miss a day",
                  "Start free — account optional",
                ].map((line) => (
                  <li key={line} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                className="min-h-14 w-full text-base font-semibold"
                onClick={startPractice}
                data-testid="start-first-session"
              >
                Start my first session <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="min-h-12 w-full" asChild>
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
