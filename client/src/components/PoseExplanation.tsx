/**
 * PoseExplanation — pose lesson on the detail page.
 *
 * One timeline (`buildPoseLesson`) is the single source for the demonstration,
 * narration, caption, step number, highlight, side, phase and remaining time.
 * Before this, the step index came from narration timing, the figure came from
 * a video scrub, the highlight came from a regex over the cue, and the "Hold"
 * label came from a catalog field none of them consulted — so they disagreed.
 *
 * Honors voiceEnabled: with voice off the lesson clock still drives the guide.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { asanaBySlug } from "@/data/content";
import { buildPoseExplanation } from "@/lib/poseExplanation";
import { PoseLessonStage, type LessonStageMediaState } from "@/components/PoseLessonStage";
import {
  buildPoseLesson,
  formatLessonClock,
  nextStepStart,
  phaseLabelFor,
  previousStepStart,
  segmentAt,
  segmentStartAt,
} from "@/lib/poseLesson";
import { manifestAudioUrl, usePoseMedia } from "@/lib/poseMediaApi";
import { unlockAudio } from "@/lib/audioUnlock";
import { cn } from "@/lib/utils";
import type { Preferences } from "@shared/schema";
import {
  AlertTriangle,
  AlignCenter,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Wind,
  X,
} from "lucide-react";

type TeachTab = "form" | "breath" | "align" | "watch" | "feel";

const TABS: { id: TeachTab; label: string; icon: typeof Target }[] = [
  { id: "form", label: "Form", icon: Target },
  { id: "breath", label: "Breath", icon: Wind },
  { id: "align", label: "Align", icon: AlignCenter },
  { id: "watch", label: "Watch outs", icon: AlertTriangle },
  { id: "feel", label: "Feel it", icon: Heart },
];

export function PoseExplanation({
  slug,
  level = "intermediate",
  onTrainingChange,
}: {
  slug: string;
  /** Difficulty path from AsanaDetail — updates steps, timing, props and copy. */
  level?: "beginner" | "intermediate" | "advanced";
  /** Lets the page hide competing actions (sticky "Practice now") while teaching. */
  onTrainingChange?: (active: boolean) => void;
}) {
  const asana = asanaBySlug(slug);
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const { data: poseMedia } = usePoseMedia(slug);
  const voiceEnabled = prefs ? prefs.voiceEnabled !== 0 : true;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  /** The focused teaching block: demonstration, live cue and controls. */
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [timeSec, setTimeSec] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [mediaState, setMediaState] = useState<LessonStageMediaState>("idle");
  const [tab, setTab] = useState<TeachTab>("form");
  /** Bumped whenever the teaching block must be brought back into view. */
  const [keepInView, setKeepInView] = useState(0);

  /**
   * Keep the demonstration on screen.
   *
   * "Start" sits below a long page, and tapping a control focuses it — both of
   * which scroll the demonstration off the top, leaving only the cue and the
   * buttons visible. The browser's focus-scroll happens during the click, so
   * this runs after the commit and then again on the next two frames to land
   * after it rather than racing it.
   */
  useEffect(() => {
    if (keepInView === 0) return;
    let frame = 0;
    const settle = () => stageRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    settle();
    frame = requestAnimationFrame(() => {
      settle();
      frame = requestAnimationFrame(settle);
    });
    return () => cancelAnimationFrame(frame);
  }, [keepInView]);

  const lesson = useMemo(() => buildPoseLesson({ slug, level }), [slug, level]);

  const difficulty =
    level === "beginner" ? "Beginner" : level === "advanced" ? "Advanced" : "Intermediate";
  const expl = useMemo(
    () => (asana ? buildPoseExplanation(asana, difficulty) : null),
    [asana, difficulty],
  );

  const current = lesson ? segmentAt(lesson, timeSec) : null;

  // Buffering must not let narration, captions or the clock run ahead of the
  // picture. A still never buffers, so this only ever gates real clips.
  const stalled = mediaState === "loading" || mediaState === "buffering";

  useEffect(() => {
    onTrainingChange?.(started && !completed);
  }, [started, completed, onTrainingChange]);

  /** Stop this lesson's media. Runs on pose change, level change and unmount. */
  const stopMedia = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTickRef.current = null;
  }, []);

  // Changing pose or variation ends the previous lesson outright — otherwise
  // the old narration keeps playing over the new pose.
  useEffect(() => {
    stopMedia();
    setStarted(false);
    setPlaying(false);
    setCompleted(false);
    setTimeSec(0);
    setMediaState("idle");
    setTab("form");
  }, [slug, level, stopMedia]);

  // Leaving the page must not leave audio running.
  useEffect(() => stopMedia, [stopMedia]);

  // The lesson clock. Narration follows it rather than driving it, so a
  // missing or slow MP3 cannot desynchronise the steps from the timer.
  useEffect(() => {
    if (!started || !playing || completed || stalled || !lesson) {
      lastTickRef.current = null;
      return;
    }
    const loop = (now: number) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setTimeSec((t) => {
        const next = t + delta;
        if (next >= lesson.totalSec) {
          setPlaying(false);
          setCompleted(true);
          return lesson.totalSec;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [started, playing, completed, stalled, lesson]);

  // Narration is slaved to the lesson clock: paused when paused, silent while
  // the demonstration is buffering.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !voiceEnabled) return;
    if (!started || !playing || completed || stalled) {
      a.pause();
      return;
    }
    void a.play().catch(() => undefined);
  }, [started, playing, completed, stalled, voiceEnabled, current?.id]);

  if (!asana || !expl || !lesson) return null;

  const src = manifestAudioUrl(asana.slug, poseMedia);
  const progress = lesson.totalSec > 0 ? Math.min(100, (timeSec / lesson.totalSec) * 100) : 0;
  const remaining = Math.max(0, lesson.totalSec - timeSec);

  const seek = (to: number) => {
    const clamped = Math.max(0, Math.min(lesson.totalSec, to));
    setTimeSec(clamped);
    setCompleted(false);
    setRestartToken((n) => n + 1);
    const a = audioRef.current;
    if (a) a.currentTime = 0;
    setKeepInView((n) => n + 1);
  };

  const start = () => {
    void unlockAudio();
    setStarted(true);
    setCompleted(false);
    setTimeSec(0);
    setRestartToken((n) => n + 1);
    setPlaying(true);
    setKeepInView((n) => n + 1);
  };

  const exitTraining = () => {
    stopMedia();
    setStarted(false);
    setPlaying(false);
    setCompleted(false);
    setTimeSec(0);
  };

  const tabBody = (() => {
    switch (tab) {
      case "form":
        return expl.formCues;
      case "breath":
        return [expl.breathCue];
      case "align":
        return expl.alignmentTips;
      case "watch":
        return expl.watchOuts;
      case "feel":
        return expl.feelIt;
    }
  })();

  const training = started && !completed;
  const activeStepNumber = current?.stepNumber ?? null;

  const controls = (
    <div className="flex flex-wrap items-center gap-2" data-testid="lesson-controls">
      <Button
        variant="outline"
        className="min-h-12 min-w-12"
        onClick={() => seek(previousStepStart(lesson, timeSec))}
        aria-label="Previous step"
        data-testid="lesson-prev"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        className="min-h-12"
        onClick={() => seek(segmentStartAt(lesson, timeSec))}
        aria-label="Replay this step"
        data-testid="lesson-replay"
      >
        <RotateCcw className="mr-1 h-4 w-4" /> Replay
      </Button>
      <Button
        className="min-h-12 flex-1"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause lesson" : "Resume lesson"}
        data-testid={`button-pause-demo-${asana.slug}`}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        <span className="ml-2">{playing ? "Pause" : "Resume"}</span>
      </Button>
      <Button
        variant="outline"
        className="min-h-12 min-w-12"
        onClick={() => seek(nextStepStart(lesson, timeSec))}
        aria-label="Next step"
        data-testid="lesson-next"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        className="min-h-12"
        onClick={exitTraining}
        aria-label="Exit training"
        data-testid="lesson-exit"
      >
        <X className="mr-1 h-4 w-4" /> Exit
      </Button>
    </div>
  );

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
      data-testid={`demo-mode-${asana.slug}`}
      aria-label={`Pose lesson for ${asana.english}`}
      data-training={training ? "active" : "idle"}
    >
      <div className="h-1.5 w-full bg-accent/40" aria-hidden>
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: started ? `${progress}%` : "0%" }}
          data-testid={`demo-progress-${asana.slug}`}
        />
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Pose lesson
            {!voiceEnabled ? " · Voice off" : null}
          </span>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Learn {asana.english}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{asana.sanskrit}</span>
            <Badge variant="outline" className="capitalize" data-testid="lesson-variation">
              {level}
            </Badge>
            <Badge variant="outline" data-testid="lesson-duration-label">
              {lesson.durationLabel}
            </Badge>
            {lesson.props.length ? (
              <Badge variant="secondary" data-testid="lesson-props">
                {lesson.props.join(", ")}
              </Badge>
            ) : null}
          </div>
        </div>

        {/*
          Focused teaching view: demonstration, the one current instruction and
          the controls stay together. Reference material sits below, and never
          replaces the live cue.
        */}
        <div
          className={cn(
            "grid min-w-0 grid-cols-1 gap-4",
            training ? "" : "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:items-start",
          )}
        >
          {/*
            scroll-mt clears the sticky app header (3.5rem). Without it the
            scroll-into-view above parks the top of the demonstration — and the
            media-availability label sitting on it — behind the header.
          */}
          <div className="flex min-w-0 scroll-mt-20 flex-col gap-3" ref={stageRef}>
            <PoseLessonStage
              demo={lesson.demo}
              english={asana.english}
              playing={training && playing}
              restartToken={restartToken}
              focus={training ? current?.focus ?? null : null}
              caption={
                training && current
                  ? `${phaseLabelFor(current.phase)}${
                      current.side !== "both" ? ` · ${current.side} side` : ""
                    }`
                  : null
              }
              onMediaStateChange={setMediaState}
              className={cn(
                "aspect-[3/4] w-full sm:aspect-video",
                // While teaching, the picture shares a short screen with the
                // cue and the controls, so it yields height to them.
                training
                  ? "max-h-[min(38vh,18rem)] landscape:max-h-[min(46vh,14rem)]"
                  : "max-h-[min(46vh,26rem)]",
              )}
              data-testid={`demo-hero-${asana.slug}`}
            />

            {training && current ? (
              <div className="space-y-2" data-testid="lesson-live-cue">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span data-testid="lesson-phase">
                    {phaseLabelFor(current.phase)}
                    {activeStepNumber ? ` · Step ${activeStepNumber} of ${lesson.steps.length}` : ""}
                    {current.cycle
                      ? ` · Round ${current.cycle.round} of ${current.cycle.totalRounds}`
                      : ""}
                    {current.side !== "both" ? ` · ${current.side} side` : ""}
                  </span>
                  <span className="tabular-nums" data-testid="lesson-remaining">
                    {formatLessonClock(remaining)} left
                  </span>
                </div>
                <p className="text-base font-medium leading-relaxed" data-testid="lesson-cue">
                  {current.cue}
                </p>
                {current.breathCue ? (
                  <p className="text-sm text-muted-foreground" data-testid="lesson-breath">
                    {current.breathCue}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/*
              Controls live inside the teaching column so the demonstration,
              the live cue and the buttons scroll as one block and cannot end
              up on opposite sides of the fold.
            */}
            {training ? controls : null}

            {lesson.demo.kind !== "movement" ? (
              <p
                className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground"
                data-testid="lesson-media-disclosure"
              >
                No reviewed movement demonstration exists for {asana.english} yet, so this lesson
                shows a still reference beside the written cues. It does not show the movement into
                or out of the pose.
              </p>
            ) : null}

            {lesson.variationVisualMismatch ? (
              <p
                className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground"
                data-testid="lesson-variation-mismatch"
              >
                {lesson.variationVisualMismatch}
              </p>
            ) : null}
          </div>

          {!training ? (
            <div
              className="flex min-h-[14rem] flex-col rounded-2xl border border-border/70 bg-accent/20 p-3 sm:p-4"
              data-testid={`pose-teach-rail-${asana.slug}`}
            >
              <div
                className="flex gap-1 overflow-x-auto pb-2"
                role="tablist"
                aria-label="Teaching topics"
              >
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
                      tab === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/70 text-muted-foreground hover:text-foreground",
                    )}
                    data-testid={`pose-teach-tab-${id}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>

              <div
                key={tab}
                role="tabpanel"
                className="flex-1 space-y-2.5 pt-1"
                data-testid={`pose-teach-panel-${tab}`}
              >
                <ul className="space-y-2.5">
                  {tabBody.map((line, i) => (
                    <li
                      key={`${tab}-${i}`}
                      className="flex gap-2 text-sm leading-relaxed text-foreground/90"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        {!started ? (
          <Button
            size="lg"
            onClick={start}
            data-testid={`button-watch-demo-${asana.slug}`}
            aria-label={`Start the ${asana.english} lesson`}
            className="min-h-12 w-full gap-2 rounded-full py-6 text-base font-medium"
          >
            <Play className="h-5 w-5 fill-current" /> Start pose lesson
          </Button>
        ) : completed ? (
          <div
            className="flex flex-col items-center gap-3 rounded-xl bg-accent/40 p-6 text-center"
            data-testid={`demo-complete-${asana.slug}`}
          >
            <p className="font-serif text-lg">You know the cues — try it in your body</p>
            <Button
              onClick={exitTraining}
              className="gap-2 rounded-full"
              data-testid={`button-demo-got-it-${asana.slug}`}
            >
              <Check className="h-4 w-4" /> Got it
            </Button>
          </div>
        ) : null}

        <ol className="space-y-2" data-testid={`demo-steps-${asana.slug}`}>
          {lesson.steps.map((step) => {
            const isActive = training && step.number === activeStepNumber;
            const isPast =
              started && (completed || (activeStepNumber != null && step.number < activeStepNumber));
            return (
              <li
                key={step.number}
                className={cn(
                  "rounded-lg px-4 py-3 transition-all duration-500",
                  isActive
                    ? "border-l-4 border-primary bg-accent/50 text-base font-medium text-foreground"
                    : isPast
                      ? "border-l-4 border-transparent text-sm text-muted-foreground opacity-60"
                      : "border-l-4 border-transparent text-sm text-muted-foreground opacity-70",
                )}
                data-testid={`demo-step-${asana.slug}-${step.number - 1}`}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="mr-2 font-serif text-primary">{step.number}.</span>
                {step.text}
              </li>
            );
          })}
        </ol>

        <audio
          ref={audioRef}
          src={voiceEnabled ? src : undefined}
          preload={voiceEnabled ? "auto" : "none"}
          data-testid={`demo-audio-${asana.slug}`}
        />
      </div>
    </section>
  );
}

/** Back-compat alias used by older imports / tests. */
export { PoseExplanation as DemoMode };
