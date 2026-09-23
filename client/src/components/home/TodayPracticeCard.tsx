/**
 * Today's practice — the one decision Home is for.
 *
 * Everything on this card is derived from the queue it will start: the length
 * for the teaching mode in use, the level, the effort, and the props you need
 * in the room. The only authored strings are the title and the reason, and the
 * reason is checkable against what the practitioner told us.
 *
 * Secondary controls (time, focus, preview) sit under one obvious Start rather
 * than beside it, because a row of equal buttons is the thing that made the old
 * Home a directory.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PoseImage } from "@/components/PoseImage";
import { Skeleton } from "@/components/ui/skeleton";
import { asanaBySlug } from "@/data/content";
import { formatDuration } from "@/lib/formatDuration";
import type { PracticeRecommendation } from "@/lib/homeRecommendation";
import { buildSessionPreflight, toTimedPoses } from "@/lib/sessionPreflight";
import { briefModeFit, nearestOfferedMinutes } from "@/lib/sessionFit";
import { DurationFitNotice } from "@/components/DurationFitNotice";
import { TIME_OPTIONS, NEED_OPTIONS } from "@/lib/yogaTrainer";
import type { InstructionMode } from "@/lib/guidedDuration";
import { ChevronDown, Package, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function TodayPracticeCardSkeleton() {
  return (
    <Card className="surface-banner border-primary/30" data-testid="today-practice-loading">
      <CardContent className="space-y-4 p-5">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-12 w-full sm:w-56" />
      </CardContent>
    </Card>
  );
}

export function TodayPracticeCard({
  recommendation,
  mode = "guided",
  onStart,
  onChangeMinutes,
  onChangeFocus,
  currentMinutes,
  currentNeed,
}: {
  recommendation: PracticeRecommendation;
  mode?: InstructionMode;
  onStart: (rec: PracticeRecommendation, instructionMode?: "guided" | "brief" | "timer") => void;
  /** Re-generate at a different length. Absent when this practice is fixed. */
  onChangeMinutes?: (minutes: number) => void;
  /** Re-generate for a different focus. Absent when this practice is fixed. */
  onChangeFocus?: (need: string) => void;
  currentMinutes?: number | null;
  currentNeed?: string | null;
}) {
  const [panel, setPanel] = useState<"none" | "time" | "focus" | "poses">("none");

  const poses = recommendation.poses
    .map((p) => {
      const a = asanaBySlug(p.slug);
      return a ? { ...a, holdSeconds: p.holdSeconds, sides: p.sides } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const preflight = buildSessionPreflight({
    poses,
    mode,
    requestedMinutes: recommendation.requestedMinutes,
  });
  const fit = recommendation.fit ?? preflight.fit;
  /**
   * Captions instead of voice, when that is what makes the requested length
   * possible. An explicit button — the practitioner asked to be talked through
   * a practice, so swapping that for captions is their call, not ours.
   */
  const briefOffer =
    fit && !fit.fits && recommendation.requestedMinutes != null
      ? (() => {
          const brief = briefModeFit({
            requestedMinutes: recommendation.requestedMinutes,
            poses: toTimedPoses(poses),
          });
          return brief.fits
            ? { minutes: brief.minutes, savedMinutes: brief.savedMinutes }
            : null;
        })()
      : null;
  const toggle = (next: typeof panel) => setPanel((p) => (p === next ? "none" : next));

  return (
    <Card className="surface-banner border-primary/30" data-testid="today-practice">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="font-serif text-2xl leading-tight" data-testid="today-practice-title">
            {recommendation.title}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="today-practice-spec">
            {preflight.timeLabel} · {preflight.difficulty.level} · {preflight.intensity.level}
          </p>
        </div>

        <p
          className="flex items-start gap-2 text-sm"
          data-testid="today-practice-equipment"
        >
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            {preflight.equipmentSentence
              ? `You'll need ${preflight.equipmentSentence}.`
              : "No props needed."}
          </span>
        </p>

        <p className="text-sm text-muted-foreground" data-testid="today-practice-reason">
          {recommendation.reason}
        </p>

        {fit && !fit.fits && fit.explanation && (
          <DurationFitNotice
            fit={fit}
            offerMinutes={
              recommendation.adjustable && onChangeMinutes
                ? (() => {
                    const offer = nearestOfferedMinutes(fit.plannedMinutes, TIME_OPTIONS);
                    return offer != null && offer !== currentMinutes ? offer : null;
                  })()
                : null
            }
            onUseOfferedMinutes={onChangeMinutes}
            briefOffer={briefOffer}
            onUseBriefMode={() => onStart(recommendation, "brief")}
            testIdPrefix="today-practice-fit"
          />
        )}

        <Button
          size="lg"
          className="min-h-12 w-full cursor-pointer sm:w-auto"
          onClick={() => onStart(recommendation)}
          data-testid="button-start-today-practice"
        >
          <Play className="mr-2 h-5 w-5" />
          Start {preflight.timeLabel} practice
        </Button>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
          {onChangeMinutes && (
            <SecondaryControl
              active={panel === "time"}
              onClick={() => toggle("time")}
              testId="button-change-time"
            >
              Change time
            </SecondaryControl>
          )}
          {onChangeFocus && (
            <SecondaryControl
              active={panel === "focus"}
              onClick={() => toggle("focus")}
              testId="button-change-focus"
            >
              Change focus
            </SecondaryControl>
          )}
          <SecondaryControl
            active={panel === "poses"}
            onClick={() => toggle("poses")}
            testId="button-preview-poses"
          >
            Preview poses
          </SecondaryControl>
        </div>

        {panel === "time" && onChangeMinutes && (
          <div className="flex flex-wrap gap-2" data-testid="panel-change-time">
            {TIME_OPTIONS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={currentMinutes === m ? "default" : "outline"}
                className="min-h-11"
                onClick={() => onChangeMinutes(m)}
                data-testid={`option-time-${m}`}
              >
                {m} min
              </Button>
            ))}
          </div>
        )}

        {panel === "focus" && onChangeFocus && (
          <div className="flex flex-wrap gap-2" data-testid="panel-change-focus">
            {NEED_OPTIONS.map((n) => (
              <Button
                key={n.id}
                size="sm"
                variant={currentNeed === n.id ? "default" : "outline"}
                className="min-h-11"
                onClick={() => onChangeFocus(n.id)}
                data-testid={`option-focus-${n.id}`}
              >
                {n.label}
              </Button>
            ))}
          </div>
        )}

        {panel === "poses" && (
          <ol className="space-y-2" data-testid="panel-preview-poses">
            {poses.map((p, i) => (
              <li key={`${p.slug}-${i}`} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <PoseImage
                  slug={p.slug}
                  thumb
                  breath={false}
                  shadow={false}
                  rounded="rounded-lg"
                  aspect="aspect-square"
                  className="h-10 w-10 shrink-0"
                  sizes="40px"
                />
                <Link
                  href={`/asanas/${p.slug}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {p.english}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDuration(p.holdSeconds)}
                  {p.sides === "each" ? " each side" : ""}
                </span>
              </li>
            ))}
          </ol>
        )}

        {preflight.modifications.length > 0 && panel === "poses" && (
          <p className="text-xs text-muted-foreground">
            Every pose carries its own modifications — they're shown again before you start.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SecondaryControl({
  children,
  active,
  onClick,
  testId,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent text-foreground",
      )}
      data-testid={testId}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 transition-transform", active && "rotate-180")} aria-hidden />
    </button>
  );
}
