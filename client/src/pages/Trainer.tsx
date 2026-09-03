import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoseCardVideo } from "@/components/PoseCardVideo";
import { usePractice } from "@/context/PracticeContext";
import { asanaBySlug } from "@/data/content";
import { audienceChipFromProfileId, profileById } from "@/data/profiles";
import { KEYS, readString, writeString } from "@/lib/localPrefs";
import {
  BODY_OPTIONS,
  BODY_PARTS,
  ENERGY_OPTIONS,
  NEED_LABEL,
  NEED_OPTIONS,
  TIME_OPTIONS,
  composeTrainerSession,
  moodFromEnergy,
  toggleBodyAnswer,
  toggleBodyPart,
  type TrainerExperience,
  type TrainerSession,
} from "@/lib/yogaTrainer";
import { cn } from "@/lib/utils";
import { formatHold } from "@/lib/formatDuration";
import { ChevronRight, Play, RefreshCw, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { UserProfile } from "@shared/schema";

const TOUR_KEY = "sadhana.trainer.tourDone";
/**
 * The wizard answers and the composed result, kept across a reload.
 *
 * Four questions and a generated sequence used to evaporate on F5, dropping the
 * practitioner back at step 1 with nothing. sessionStorage is the right scope:
 * it survives a refresh and a restored tab, and does not follow someone into
 * next week's practice.
 */
const STATE_KEY = "sadhana.trainer.state.v1";

type PersistedTrainer = {
  step: number;
  body: string[];
  soreParts: string[];
  energy: string;
  timeMinutes: number | null;
  need: string;
  phase: "wizard" | "result";
  result: TrainerSession | null;
};

function loadTrainerState(): PersistedTrainer | null {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTrainer;
    return parsed && Array.isArray(parsed.body) ? parsed : null;
  } catch {
    return null;
  }
}

function saveTrainerState(state: PersistedTrainer | null): void {
  try {
    if (state) sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* quota / private mode — the wizard still works, it just won't survive F5 */
  }
}

function ChipButton({
  selected,
  onClick,
  children,
  testId,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={selected}
      className={cn(
        "min-h-11 rounded-2xl border px-4 py-4 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/15 text-foreground shadow-soft"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= step ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

export default function Trainer() {
  useDocumentTitle("Yoga Trainer · Sadhana");
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const { data: activeProfileRow } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile/active"],
  });
  const activeProfile = profileById(activeProfileRow?.profileId);

  const saved = useMemo(loadTrainerState, []);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [body, setBody] = useState<string[]>(saved?.body ?? []);
  const [soreParts, setSoreParts] = useState<string[]>(saved?.soreParts ?? []);
  const [energy, setEnergy] = useState(saved?.energy ?? "");
  const [timeMinutes, setTimeMinutes] = useState<number | null>(saved?.timeMinutes ?? null);
  const [need, setNeed] = useState(saved?.need ?? "");
  const [phase, setPhase] = useState<"wizard" | "composing" | "result">(
    saved?.phase === "result" && saved.result ? "result" : "wizard",
  );
  const [result, setResult] = useState<TrainerSession | null>(saved?.result ?? null);
  // A restored session skips the tour — they've already seen it.
  const [showTour, setShowTour] = useState(() => !readString(TOUR_KEY) && !saved);

  const showBodyParts = body.some((b) => b === "Sore" || b === "Injured" || b === "A little stiff");

  // Mutual exclusion lives in yogaTrainer so it is testable and so the wizard
  // and the composer agree on what a contradictory answer even is.
  const toggleBody = (value: string) => setBody(toggleBodyAnswer(body, value));
  const togglePart = (value: string) => setSoreParts(toggleBodyPart(soreParts, value));

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
    const started = Date.now();
    const session = composeTrainerSession(
      {
        body,
        soreParts: showBodyParts ? soreParts.filter((p) => p !== "None specific") : [],
        energy: energy || "Balanced",
        timeMinutes: timeMinutes ?? 10,
        need: need || "movement",
      },
      {
        preferSlugs: activeProfile?.recommendedAsanas,
        audience: audienceChipFromProfileId(activeProfileRow?.profileId),
        // Someone who told onboarding they're new should not be handed a
        // two-and-a-half-minute plank.
        experience: (readString(KEYS.experienceLevel) as TrainerExperience | null) ?? undefined,
      },
    );
    const elapsed = Date.now() - started;
    if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed));
    setResult(session);
    setPhase("result");
  };

  const startGuided = () => {
    if (!result) return;
    const poses = result.poses.flatMap((p) => {
      const asana = asanaBySlug(p.slug);
      return asana ? [{ asana, holdSeconds: p.holdSeconds, sides: p.sides }] : [];
    });
    if (!poses.length) return;
    loadSession(poses, {
      label: `Trainer — ${NEED_LABEL[result.deliveredNeed] ?? result.deliveredNeed}`,
      plannedMinutes: timeMinutes ?? result.totalMinutes,
      // We already asked about body and energy; don't ask a third time.
      preMood: moodFromEnergy(energy),
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
    saveTrainerState(null);
  };

  useEffect(() => {
    if (!showTour) writeString(TOUR_KEY, "1");
  }, [showTour]);

  // A full-screen intro that can only be dismissed by its one button feels like
  // a trap. Let Escape close it too, matching every other overlay in the app.
  useEffect(() => {
    if (!showTour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTour(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTour]);

  // Snapshot on every meaningful change so a refresh lands where they were.
  useEffect(() => {
    if (phase === "composing") return;
    const empty = body.length === 0 && !energy && timeMinutes === null && !need && !result;
    saveTrainerState(
      empty ? null : { step, body, soreParts, energy, timeMinutes, need, phase, result },
    );
  }, [step, body, soreParts, energy, timeMinutes, need, phase, result]);

  if (phase === "composing") {
    return (
      <div className="flex min-h-[60vh] animate-fade-in flex-col items-center justify-center text-center">
        <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-4 animate-pulse rounded-full bg-primary/15" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary">
            <UserRound className="h-9 w-9 animate-pulse" />
          </span>
        </div>
        <h1 className="font-serif text-2xl" data-testid="text-composing">
          Building your practice…
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Matching poses to how your body feels today, then closing in rest.
        </p>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Your practice for today</span>
        </div>

        <Card className="surface-banner border-primary/30">
          <CardContent className="p-6">
            <p className="font-serif text-lg leading-relaxed" data-testid="text-reasoning">
              {result.reasoning}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="tabular-nums" data-testid="badge-total-minutes">
                ~{result.totalMinutes} min
              </Badge>
              <Badge variant="outline">{result.poses.length} poses</Badge>
              <Badge variant="outline" data-testid="badge-delivered-need">
                {NEED_LABEL[result.deliveredNeed] ?? "Restorative"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {result.adjustments.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5" data-testid="card-adjustments">
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                {result.deliveredNeed === result.requestedNeed
                  ? `Adjusted for your body — still a ${(NEED_LABEL[result.requestedNeed] ?? result.requestedNeed).toLowerCase()} practice`
                  : `I couldn't safely give you ${(NEED_LABEL[result.requestedNeed] ?? result.requestedNeed).toLowerCase()} today`}
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.adjustments.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* CTA above the long list — was easy to miss below 13 poses */}
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

        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-lg font-medium tracking-tight">Poses in this practice</h2>
          <p className="text-xs text-muted-foreground">Tap a pose to open its guide</p>
        </div>

        <ol className="space-y-3" data-testid="list-composed-poses">
          {result.poses.map((p, i) => {
            const asana = asanaBySlug(p.slug);
            const href = `/asanas/${p.slug}`;
            return (
              <li key={`${p.slug}-${i}`}>
                <Card
                  className="shadow-soft transition-colors hover:border-primary/40"
                  data-testid={`composed-pose-${p.slug}`}
                >
                  <CardContent className="p-0">
                    <Link
                      href={href}
                      className="flex min-h-11 cursor-pointer items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-4"
                      data-testid={`link-composed-pose-${p.slug}`}
                      aria-label={`Open ${asana?.english ?? p.slug} pose guide`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                        {i + 1}
                      </span>
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-20">
                        <PoseCardVideo
                          slug={p.slug}
                          alt={asana?.imageAlt ?? p.slug}
                          className="h-full w-full"
                          testId={`trainer-pose-video-${p.slug}`}
                        />
                      </div>
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
                      <span className="hidden shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground sm:block">
                        {formatHold(p.holdSeconds, p.sides)}
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
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
            data-testid="button-start-guided-bottom"
          >
            <Play className="mr-2 h-4 w-4" /> Start guided session
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={doCompose}
            data-testid="button-compose-different-bottom"
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

  const QUESTIONS = [
    "How's your body feeling today?",
    "Your energy?",
    "How much time do you have?",
    "What do you need most today?",
  ];

  return (
    <div className="mx-auto max-w-2xl animate-fade-in space-y-6">
      {showTour && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          data-testid="trainer-tour"
          role="dialog"
          aria-modal="true"
          aria-label="Meet your Yoga Trainer"
          onClick={() => setShowTour(false)}
        >
          <Card className="max-w-sm shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="space-y-4 p-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserRound className="h-7 w-7" />
              </span>
              <h2 className="font-serif text-xl">Meet your Yoga Trainer</h2>
              <p className="text-sm text-muted-foreground">
                Answer four quick questions and get a practice shaped for your body right now
                {activeProfile ? ` — with ${activeProfile.name} poses woven in` : ""} —
                then flow into a guided session with voice and timers.
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
          <UserRound className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Yoga Trainer</span>
        </div>
        <StepDots step={step} total={4} />
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight" data-testid="text-question">
          {QUESTIONS[step]}
        </h1>
      </header>

      <div className="surface-inset space-y-4 p-4">
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select all that apply.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BODY_OPTIONS.map((opt) => (
              <ChipButton
                key={opt}
                selected={body.includes(opt)}
                onClick={() => toggleBody(opt)}
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
                    onClick={() => togglePart(part)}
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

      {step === 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ENERGY_OPTIONS.map((opt, i) => (
            <ChipButton
              key={opt}
              selected={energy === opt}
              onClick={() => setEnergy(opt)}
              testId={`energy-${opt.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              // An odd option count leaves a dangling half-row; the last chip
              // fills it instead.
              className={
                i === ENERGY_OPTIONS.length - 1 && ENERGY_OPTIONS.length % 2 === 1
                  ? "sm:col-span-2"
                  : undefined
              }
            >
              {opt}
            </ChipButton>
          ))}
        </div>
      )}

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

      {step === 3 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NEED_OPTIONS.map((opt, i) => (
            <ChipButton
              key={opt.id}
              selected={need === opt.id}
              onClick={() => setNeed(opt.id)}
              testId={`need-${opt.id}`}
              className={
                i === NEED_OPTIONS.length - 1
                  ? cn(
                      NEED_OPTIONS.length % 2 === 1 && "col-span-2 sm:col-span-1",
                      NEED_OPTIONS.length % 3 === 1 && "sm:col-span-3",
                      NEED_OPTIONS.length % 3 === 2 && "sm:col-span-2",
                    )
                  : undefined
              }
            >
              {opt.label}
            </ChipButton>
          ))}
        </div>
      )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Step 1 has nowhere to go back to; render nothing rather than a
            disabled control that looks like a dead end. */}
        {step > 0 ? (
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            data-testid="button-back"
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
            data-testid="button-next"
          >
            Continue
          </Button>
        ) : (
          <Button disabled={!canAdvance} onClick={doCompose} data-testid="button-compose">
            <Sparkles className="mr-2 h-4 w-4" /> Compose my practice
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prefer to browse?{" "}
        <Link href="/asanas" className="underline-offset-2 hover:underline">
          Open the asana library
        </Link>
      </p>
    </div>
  );
}
