/**
 * Acquisition quiz at /start — BetterMe-style short funnel with plan + paywall.
 * Emits the exact product analytics events defined under funnel/events.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { PLANS, writePreferredPlan, type PlanId } from "@/lib/plans";
import { captureProduct, rememberFunnelFlowId, trackAppFirstOpen } from "@/lib/productAnalytics";
import { parseAttribution, attributionProps } from "../../../funnel/attribution";
import { getFlow, resolveFlowId } from "../../../funnel/flows";
import { readUrlParam } from "@/lib/hashQuery";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Sparkles } from "lucide-react";

type Phase = "quiz" | "plan" | "paywall";

export default function StartQuiz() {
  useDocumentTitle("Start · Find your practice · Sadhana");

  const attr = useMemo(() => {
    if (typeof window === "undefined") return parseAttribution({});
    return parseAttribution(new URLSearchParams(window.location.search));
  }, []);

  const flowId = useMemo(
    () => resolveFlowId(attr.flow_id || readUrlParam("flow"), attr.ref || readUrlParam("ref")),
    [attr.flow_id, attr.ref],
  );
  const flow = useMemo(() => getFlow(flowId), [flowId]);
  const utm = useMemo(() => attributionProps(attr), [attr]);

  const [phase, setPhase] = useState<Phase>("quiz");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();

  const startedRef = useRef(false);
  const quizStartedAt = useRef<number>(Date.now());
  const questionShownAt = useRef<number>(Date.now());
  const lastQuestionId = useRef<string>(flow.questions[0]?.id ?? "");
  const abandonedRef = useRef(false);

  const question = flow.questions[index];
  const plan = PLANS.find((p) => p.id === flow.recommendedPlan) ?? PLANS[1]!;
  const priceShown = plan.monthlyUsd;
  const currency = "USD";

  // quiz_started + first question
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
    const q0 = flow.questions[0];
    if (q0) {
      lastQuestionId.current = q0.id;
      questionShownAt.current = Date.now();
      void captureProduct("quiz_question_shown", {
        flow_id: flowId,
        question_id: q0.id,
        index: 0,
      });
    }
  }, [flowId, flow.questions, attr.ref, utm]);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Abandon on leave / unmount while still in quiz (not when advancing to plan).
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

  const showQuestion = useCallback(
    (nextIndex: number) => {
      const q = flow.questions[nextIndex];
      if (!q) return;
      lastQuestionId.current = q.id;
      questionShownAt.current = Date.now();
      void captureProduct("quiz_question_shown", {
        flow_id: flowId,
        question_id: q.id,
        index: nextIndex,
      });
    },
    [flow.questions, flowId],
  );

  const answer = (optionId: string) => {
    if (!question) return;
    const ms = Math.max(0, Date.now() - questionShownAt.current);
    void captureProduct("quiz_answered", {
      flow_id: flowId,
      question_id: question.id,
      answer: optionId,
      ms_on_screen: ms,
    });
    const nextAnswers = { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);

    if (index + 1 < flow.questions.length) {
      const next = index + 1;
      setIndex(next);
      showQuestion(next);
      return;
    }

    // Complete → plan reveal → paywall
    abandonedRef.current = true; // completed, not abandoned
    const duration = Math.max(0, Date.now() - quizStartedAt.current);
    void captureProduct("quiz_completed", { flow_id: flowId, duration_ms: duration });
    void captureProduct("plan_revealed", { flow_id: flowId });
    setPhase("plan");
  };

  const openPaywall = () => {
    void captureProduct("paywall_viewed", {
      flow_id: flowId,
      price_shown: priceShown,
      currency,
      ...utm,
    });
    setPhase("paywall");
  };

  const startCheckout = async (planId: PlanId) => {
    if (planId === "free") {
      writePreferredPlan("free");
      navigate("/guided");
      return;
    }
    writePreferredPlan(planId);
    void captureProduct("checkout_started", {
      flow_id: flowId,
      plan: planId,
      ...utm,
    });
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, interval: "month", flow_id: flowId }),
      });
      const data = (await res.json()) as { url?: string; error?: string; hint?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      // Billing off — continue into the free app with the recommended plan preference.
      navigate("/plus?checkout=waitlist");
    } catch {
      navigate("/plus");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-[70vh] max-w-lg space-y-6 px-4 py-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Sadhana</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{flow.title}</h1>
        <p className="text-sm text-muted-foreground">{flow.subtitle}</p>
      </header>

      {phase === "quiz" && question && (
        <section className="space-y-4" data-testid="quiz-step" aria-labelledby="quiz-prompt">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Question {index + 1} of {flow.questions.length}
            </span>
            <span className="tabular-nums">{Math.round(((index + 1) / flow.questions.length) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${((index + 1) / flow.questions.length) * 100}%` }}
            />
          </div>
          <h2 id="quiz-prompt" className="font-serif text-xl font-medium">
            {question.prompt}
          </h2>
          <div className="grid gap-2">
            {question.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`quiz-option-${opt.id}`}
                onClick={() => answer(opt.id)}
                className={cn(
                  "flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors",
                  "hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  answers[question.id] === opt.id && "border-primary bg-primary/10",
                )}
              >
                {opt.label}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === "plan" && (
        <section className="space-y-4" data-testid="plan-reveal">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Your plan
            </div>
            <h2 className="font-serif text-2xl font-semibold">{plan.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Based on your answers
              {answers.goal ? ` (focus: ${answers.goal})` : ""}, we recommend a gentle daily practice
              with clear safety cues — no streaks that shame you for missing a day.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {plan.bullets.slice(0, 4).map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button className="min-h-12 w-full" size="lg" onClick={openPaywall} data-testid="see-pricing">
            See pricing
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 w-full"
            onClick={() => {
              writePreferredPlan("free");
              navigate("/");
            }}
          >
            Continue with free practice
          </Button>
        </section>
      )}

      {phase === "paywall" && (
        <section className="space-y-4" data-testid="paywall">
          <div className="rounded-3xl border border-primary/30 bg-card p-6 text-center shadow-soft">
            <p className="text-sm text-muted-foreground">Sadhana Plus</p>
            <p className="mt-1 font-serif text-4xl font-semibold tabular-nums">
              ${priceShown}
              <span className="text-base font-normal text-muted-foreground">/{currency === "USD" ? "mo" : currency}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Cancel anytime. Safety library and guest practice stay free forever. No countdown
              discounts.
            </p>
          </div>
          <Button
            className="min-h-12 w-full"
            size="lg"
            disabled={busy}
            onClick={() => void startCheckout(flow.recommendedPlan)}
            data-testid="checkout-plus"
          >
            {busy ? "Starting checkout…" : `Continue with ${plan.name}`}
          </Button>
          <Button
            variant="outline"
            className="min-h-11 w-full"
            disabled={busy}
            onClick={() => void startCheckout("free")}
          >
            Stay on Free
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already practicing?{" "}
            <Link href="/" className="underline underline-offset-2">
              Open the app
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
