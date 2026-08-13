/**
 * PoseExplanation — studio how-to training (detail page).
 *
 * HD how-to video + coaching voice, focus halo on the cued body region, and
 * Form · Breath · Align coaching. Start training is obvious and synced.
 *
 * Honors voiceEnabled: when OFF, silent step countdown still drives the guide.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { asanaBySlug } from "@/data/content";
import { buildPoseExplanation } from "@/lib/poseExplanation";
import { PoseTrainerStage } from "@/components/PoseTrainerStage";
import { momentumClass } from "@/lib/poseMomentum";
import { resolveStepFocus } from "@/lib/poseMoments";
import { useNarrationTiming } from "@/hooks/use-narration-timing";
import { unlockAudio } from "@/lib/audioUnlock";
import { manifestAudioUrl, usePoseMedia } from "@/lib/poseMediaApi";
import { cn } from "@/lib/utils";
import type { Preferences } from "@shared/schema";
import {
  Play,
  Pause,
  Check,
  Sparkles,
  Wind,
  Target,
  AlertTriangle,
  Heart,
  AlignCenter,
} from "lucide-react";

type TeachTab = "form" | "breath" | "align" | "watch" | "feel";

const TABS: { id: TeachTab; label: string; icon: typeof Target }[] = [
  { id: "form", label: "Form", icon: Target },
  { id: "breath", label: "Breath", icon: Wind },
  { id: "align", label: "Align", icon: AlignCenter },
  { id: "watch", label: "Watch outs", icon: AlertTriangle },
  { id: "feel", label: "Feel it", icon: Heart },
];

export function PoseExplanation({ slug }: { slug: string }) {
  const asana = asanaBySlug(slug);
  const { toast } = useToast();
  const { data: prefs } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const { data: poseMedia } = usePoseMedia(slug);
  const voiceEnabled = prefs ? prefs.voiceEnabled !== 0 : true;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  // 0–1 through the spoken step. Rigged poses interpolate limbs across this, so
  // the body is mid-transition while the sentence plays.
  const [stepProgress, setStepProgress] = useState(1);
  const [audioFailed, setAudioFailed] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [tab, setTab] = useState<TeachTab>("form");

  const steps = asana?.steps ?? [];
  const stepCount = steps.length || 1;
  const SILENT_SECONDS_PER_STEP = 6;
  const silentDuration = stepCount * SILENT_SECONDS_PER_STEP;
  const useSilentGuide = !voiceEnabled || audioFailed;
  const effectiveDuration = useSilentGuide ? silentDuration : duration;
  const expl = useMemo(
    () => (asana ? buildPoseExplanation(asana) : null),
    [asana],
  );
  // Real per-step boundaries (generated file when present, syllable-weighted
  // estimate otherwise) instead of dividing the audio into equal slices.
  const stepTexts = useMemo(() => steps.map((s) => s.text), [steps]);
  const { resolve: resolveStep } = useNarrationTiming(slug, stepTexts, effectiveDuration);
  const activeStep = steps[stepIndex];
  const activeMomentum = momentumClass(activeStep);
  const activeStepPose = activeStep?.pose || asana?.pose;
  const activeFocus = useMemo(
    () =>
      started && !completed
        ? resolveStepFocus(activeStep, stepIndex, stepCount)
        : null,
    [started, completed, activeStep, stepIndex, stepCount],
  );
  // During training, video follows play/pause; idle preview loops the clip.
  const stagePlaying = !started || (playing && !completed);

  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    setStarted(false);
    setCompleted(false);
    setCurrent(0);
    setStepIndex(0);
    setAudioFailed(false);
    setRestartToken(0);
    setTab("form");
  }, [slug]);

  // Restart the step video whenever the spoken cue advances.
  useEffect(() => {
    if (!started || completed) return;
    setRestartToken((n) => n + 1);
  }, [stepIndex, started, completed]);

  // If voice is turned off mid-explanation, drop into the silent walkthrough.
  useEffect(() => {
    if (!voiceEnabled && audioRef.current) {
      audioRef.current.pause();
      if (started && !completed && playing) {
        setAudioFailed(true);
      }
    }
  }, [voiceEnabled, started, completed, playing]);

  useEffect(() => {
    if (!useSilentGuide || !started || !playing || completed) return;
    const t = setInterval(() => {
      setCurrent((c) => {
        const nc = c + 0.5;
        const { index, progress } = resolveStep(nc);
        setStepIndex(index);
        setStepProgress(progress);
        if (nc >= silentDuration) {
          setPlaying(false);
          setCompleted(true);
          setStepIndex(stepCount - 1);
          setStepProgress(1);
          return silentDuration;
        }
        return nc;
      });
    }, 500);
    return () => clearInterval(t);
  }, [useSilentGuide, started, playing, completed, stepCount, silentDuration, resolveStep]);

  // Auto-rotate teaching tabs while playing so the rail feels alive.
  useEffect(() => {
    if (!playing || completed || !started) return;
    const order: TeachTab[] = ["form", "breath", "align", "watch", "feel"];
    const t = setInterval(() => {
      setTab((prev) => {
        const i = order.indexOf(prev);
        return order[(i + 1) % order.length];
      });
    }, 7000);
    return () => clearInterval(t);
  }, [playing, completed, started]);

  if (!asana || !expl) return null;

  const src = manifestAudioUrl(asana.slug, poseMedia);
  const progress =
    effectiveDuration > 0 ? Math.min(100, (current / effectiveDuration) * 100) : 0;

  const start = () => {
    void unlockAudio();
    setStarted(true);
    setCompleted(false);
    setCurrent(0);
    setStepIndex(0);
    setTab("form");
    // Restart the muted demo clip with this pose's narration.
    setRestartToken((n) => n + 1);

    if (!voiceEnabled || audioFailed) {
      setPlaying(true);
      return;
    }
    const a = audioRef.current;
    if (!a) {
      setAudioFailed(true);
      setPlaying(true);
      return;
    }
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => setPlaying(true)).catch(() => {
        setAudioFailed(true);
        setPlaying(true);
      });
    } else {
      setPlaying(true);
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const resume = () => {
    if (useSilentGuide) {
      setPlaying(true);
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => setPlaying(true)).catch(() => {
        setAudioFailed(true);
        setPlaying(true);
      });
    } else {
      setPlaying(true);
    }
  };

  const closeDemo = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    setStarted(false);
    setCompleted(false);
    setCurrent(0);
    setStepIndex(0);
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

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
      data-testid={`demo-mode-${asana.slug}`}
      aria-label={`Pose explanation for ${asana.english}`}
    >
      <div className="h-1.5 w-full bg-accent/40" aria-hidden>
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: started ? `${progress}%` : "0%" }}
          data-testid={`demo-progress-${asana.slug}`}
        />
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Studio how-to · Voice coaching
            {!voiceEnabled ? " · Voice off" : null}
          </span>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Learn {asana.english}
          </h2>
          <p className="text-sm text-muted-foreground">
            {asana.sanskrit}
            {" · "}
            HD how-to video follows each spoken cue so you see and hear the shape together.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:items-start">
          <PoseTrainerStage
            slug={asana.slug}
            english={asana.english}
            sanskrit={asana.sanskrit}
            poseKey={asana.pose}
            stepPoseKey={activeStepPose}
            momentum={activeMomentum}
            stepIndex={started ? stepIndex : 0}
            stepProgress={started ? stepProgress : 1}
            playing={stagePlaying}
            restartToken={restartToken}
            syncVideoToVoice
            narrationTime={started ? current : 0}
            narrationDuration={started ? effectiveDuration : 0}
            guideActive={started && !completed}
            focusZone={activeFocus}
            caption={
              started && !completed
                ? `Step ${stepIndex + 1}/${stepCount}: ${activeStep?.text ?? ""}`
                : null
            }
            variant="detail"
            className="min-w-0 w-full"
            data-testid={`demo-hero-${asana.slug}`}
          />

          {/* Teaching rail */}
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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
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
              className="animate-fade-in flex-1 space-y-2.5 pt-1"
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
              {tab === "watch" && expl.modification && (
                <p className="border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  Modification: {expl.modification}
                </p>
              )}
            </div>
          </div>
        </div>

        {!started ? (
          <Button
            size="lg"
            onClick={start}
            data-testid={`button-watch-demo-${asana.slug}`}
            aria-label={`Start pose training for ${asana.english}`}
            className="min-h-12 w-full gap-2 rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-5 w-5 fill-current" /> Start pose training
          </Button>
        ) : completed ? (
          <div
            className="flex flex-col items-center gap-3 rounded-xl bg-accent/40 p-6 text-center"
            data-testid={`demo-complete-${asana.slug}`}
          >
            <p className="font-serif text-lg">You know the cues — try it in your body</p>
            <Button
              onClick={closeDemo}
              variant="default"
              className="gap-2 rounded-full"
              data-testid={`button-demo-got-it-${asana.slug}`}
            >
              <Check className="h-4 w-4" /> Got it
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            onClick={playing ? pause : resume}
            data-testid={`button-pause-demo-${asana.slug}`}
            className="w-full gap-2 rounded-full py-6 text-base font-medium"
          >
            {playing ? (
              <>
                <Pause className="h-5 w-5" /> Pause training
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" /> Resume training
              </>
            )}
          </Button>
        )}

        {/* How-to always visible — Alo lists steps; we highlight the live cue */}
        <ol className="space-y-2" data-testid={`demo-steps-${asana.slug}`}>
          {steps.map((step, i) => {
            const isActive = started && !completed && i === stepIndex;
            const isPast = started && (completed || i < stepIndex);
            return (
              <li
                key={i}
                className={cn(
                  "rounded-lg px-4 py-3 transition-all duration-500",
                  isActive
                    ? "border-l-4 border-primary bg-accent/50 text-base font-medium text-foreground opacity-100"
                    : isPast
                      ? "border-l-4 border-transparent text-sm text-muted-foreground opacity-60"
                      : "border-l-4 border-transparent text-sm text-muted-foreground opacity-70",
                )}
                data-testid={`demo-step-${asana.slug}-${i}`}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="mr-2 font-serif text-primary">{i + 1}.</span>
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
          onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
          onTimeUpdate={(e) => {
            if (useSilentGuide) return;
            const a = e.target as HTMLAudioElement;
            setCurrent(a.currentTime);
            if (a.duration > 0) {
              const { index, progress } = resolveStep(a.currentTime);
              setStepIndex(index);
              setStepProgress(progress);
            }
          }}
          onEnded={() => {
            setPlaying(false);
            setCompleted(true);
            setStepIndex(stepCount - 1);
            setStepProgress(1);
          }}
          onError={() => {
            // Missing / broken narration — keep video + silent step guide.
            setAudioFailed(true);
            if (started && !completed && voiceEnabled) {
              setPlaying(true);
              toast({
                title: "Narration unavailable",
                description: "Running the explanation silently — follow the highlighted steps.",
              });
            }
          }}
        />
      </div>
    </section>
  );
}

/** Back-compat alias used by older imports / tests. */
export { PoseExplanation as DemoMode };
