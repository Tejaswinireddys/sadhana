/**
 * Virtual instructor pilot — Learn / Flow for five foundation poses.
 * One shared clock drives captions, phase timing, and demo scrubbing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { FadeIn } from "@/components/motion";
import { InstructorStage } from "@/components/InstructorStage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  INSTRUCTOR_PILOT_MISSING_ASSETS,
  INSTRUCTOR_PILOT_POSES,
  instructorPoseBySlug,
  resolveTeachingVariant,
  type InstructorMode,
  type InstructorPoseDef,
  type VariationLevel,
} from "@/data/instructorPilot";
import {
  advanceClock,
  pauseClock,
  resumeClock,
  seekClock,
  type InstructorClockState,
} from "@/lib/instructorClock";
import {
  buildSessionTimeline,
  formatClock,
  phaseLabel,
  remapClockAfterPrepExtend,
  segmentAtTime,
} from "@/lib/instructorTimeline";
import {
  effectiveLevelForPose,
  evaluateSafetyPlan,
  relevantRules,
  type RestrictionAnswer,
  type SafetyPlan,
} from "@/lib/instructorSafety";
import {
  clearInstructorSession,
  loadInstructorSession,
  saveInstructorSession,
} from "@/lib/instructorPersist";
import {
  classifyInstructorSave,
  instructorSaveHeadline,
  type InstructorSaveStatus,
} from "@/lib/instructorSave";
import { logPracticeSession } from "@/lib/logPracticeSession";
import { completionLeavePath } from "@/lib/guidedCompletion";
import { cn } from "@/lib/utils";
import {
  Captions,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Plus,
  Replace,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

type UiPhase = "setup" | "safety" | "practice" | "complete";

const LEVELS: VariationLevel[] = ["beginner", "intermediate", "advanced"];

const EMPTY_PLAN: SafetyPlan = {
  ready: false,
  missingRuleIds: [],
  excludedPoseIds: [],
  forcedAdaptations: {},
  forcedBeginnerPoseIds: [],
  warnings: [],
  substitutions: [],
  claimsAdapted: false,
};

function isSafetyPlan(value: unknown): value is SafetyPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as SafetyPlan;
  return (
    typeof p.ready === "boolean" &&
    Array.isArray(p.missingRuleIds) &&
    Array.isArray(p.excludedPoseIds) &&
    p.forcedAdaptations != null &&
    typeof p.forcedAdaptations === "object" &&
    Array.isArray(p.forcedBeginnerPoseIds)
  );
}

export default function InstructorSession() {
  useDocumentTitle("Virtual instructor pilot · Sadhana");
  const [, navigate] = useLocation();

  const [uiPhase, setUiPhase] = useState<UiPhase>("setup");
  const [mode, setMode] = useState<InstructorMode>("learn");
  const [level, setLevel] = useState<VariationLevel>("beginner");
  const [selected, setSelected] = useState<string[]>(() =>
    INSTRUCTOR_PILOT_POSES.map((p) => p.slug),
  );
  const [prepExtraByPoseIndex, setPrepExtraByPoseIndex] = useState<Record<number, number>>({});
  const [answers, setAnswers] = useState<RestrictionAnswer[]>([]);
  const [plan, setPlan] = useState<SafetyPlan>(EMPTY_PLAN);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [narrationOn, setNarrationOn] = useState(true);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [clock, setClock] = useState<InstructorClockState>({
    timeSec: 0,
    playing: false,
    rate: 1,
  });
  const [practicedSec, setPracticedSec] = useState(0);
  const [journalId, setJournalId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<InstructorSaveStatus>("idle");

  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const finishingRef = useRef(false);

  const selectedPoses = useMemo(
    () =>
      selected
        .map((slug) => instructorPoseBySlug(slug))
        .filter((p): p is InstructorPoseDef => Boolean(p)),
    [selected],
  );

  const queuePoses = useMemo(() => {
    if (!plan.ready) return selectedPoses;
    return selectedPoses
      .filter((p) => !plan.excludedPoseIds.includes(p.poseId))
      .map((p) => {
        const sub = plan.substitutions.find((s) => s.fromSlug === p.slug);
        return sub ? instructorPoseBySlug(sub.toSlug) ?? p : p;
      });
  }, [selectedPoses, plan]);

  const levelByPoseId = useMemo(() => {
    const map: Record<string, VariationLevel> = {};
    for (const p of queuePoses) {
      map[p.poseId] = effectiveLevelForPose(p.poseId, level, plan);
    }
    return map;
  }, [queuePoses, level, plan]);

  const timeline = useMemo(
    () =>
      buildSessionTimeline({
        poses: queuePoses,
        mode,
        level,
        levelByPoseId,
        adaptations: plan.forcedAdaptations,
        prepExtraByPoseIndex,
      }),
    [queuePoses, mode, level, levelByPoseId, plan.forcedAdaptations, prepExtraByPoseIndex],
  );

  const current = segmentAtTime(timeline.flat, clock.timeSec);
  const currentPose = current ? queuePoses[current.poseIndex] : null;
  const currentAdaptationId = currentPose
    ? plan.forcedAdaptations[currentPose.poseId] ?? null
    : null;
  const currentPoseLevel = currentPose
    ? effectiveLevelForPose(currentPose.poseId, level, plan)
    : level;
  const currentVariant = currentPose
    ? resolveTeachingVariant(currentPose, currentPoseLevel, currentAdaptationId)
    : null;
  const adaptationDisplayName = currentVariant?.displayName;
  const rules = useMemo(() => relevantRules(selectedPoses), [selectedPoses]);

  const previewSec = useMemo(
    () =>
      buildSessionTimeline({
        poses: selectedPoses,
        mode,
        level,
        prepExtraByPoseIndex: {},
      }).totalSec,
    [selectedPoses, mode, level],
  );

  // Restore paused practice session from sessionStorage once on mount.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadInstructorSession();
    if (!saved || saved.uiPhase !== "practice") return;
    setMode(saved.mode);
    setLevel(saved.level);
    setSelected(saved.selected);
    setAnswers(saved.answers);
    if (isSafetyPlan(saved.plan)) setPlan(saved.plan);
    setPrepExtraByPoseIndex(saved.prepExtraByPoseIndex ?? {});
    setPracticedSec(saved.practicedSec ?? 0);
    startedAtRef.current = saved.startedAt;
    setClock({
      timeSec: saved.clock?.timeSec ?? 0,
      playing: false,
      rate: saved.clock?.rate ?? 1,
    });
    setUiPhase("practice");
  }, []);

  // Persist practice progress.
  useEffect(() => {
    if (uiPhase !== "practice") return;
    saveInstructorSession({
      version: 1,
      uiPhase,
      mode,
      level,
      selected,
      answers,
      plan,
      prepExtraByPoseIndex,
      clock,
      practicedSec,
      startedAt: startedAtRef.current,
    });
  }, [
    uiPhase,
    mode,
    level,
    selected,
    answers,
    plan,
    prepExtraByPoseIndex,
    clock,
    practicedSec,
  ]);

  useEffect(() => {
    if (uiPhase !== "practice" || !clock.playing) {
      lastTickRef.current = null;
      return;
    }
    let raf = 0;
    const loop = (now: number) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (delta > 0) {
        setPracticedSec((s) => s + delta);
      }
      setClock((prev) => {
        const next = advanceClock(prev, delta);
        if (next.timeSec >= timeline.totalSec) {
          return { ...next, timeSec: timeline.totalSec, playing: false };
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [uiPhase, clock.playing, timeline.totalSec]);

  const finishSession = useCallback(
    async (completedNaturally: boolean) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setClock((c) => pauseClock(c));
      setUiPhase("complete");

      const kind = classifyInstructorSave({
        completedNaturally,
        practicedSec,
      });

      if (kind === "too_brief") {
        setSaveStatus("too_brief");
        setSaveError(null);
        clearInstructorSession();
        finishingRef.current = false;
        return;
      }

      setSaveStatus("saving");
      setSaveError(null);

      if (practicedSec < 30) {
        setSaveStatus("too_brief");
        clearInstructorSession();
        finishingRef.current = false;
        return;
      }

      const minutes = Math.max(1, Math.round(practicedSec / 60));
      const poseNames = queuePoses.map((p) => p.english);
      const posesCompleted = completedNaturally
        ? poseNames.length
        : Math.min(poseNames.length, (current?.poseIndex ?? 0) + 1);
      const posesSkipped = Math.max(0, poseNames.length - posesCompleted);

      try {
        const result = await logPracticeSession({
          minutes,
          plannedMinutes: Math.max(1, Math.round(timeline.totalSec / 60)),
          poseNames,
          posesCompleted,
          posesSkipped,
          label: `Instructor ${mode === "learn" ? "Learn" : "Flow"}`,
          pathwaySlug: null,
          preMood: null,
          postMood: null,
          kind: "asana",
          journalTags: ["instructor-pilot", mode, level],
        });
        if (result.ok) {
          setSaveStatus("saved");
          if (result.journalId != null) setJournalId(result.journalId);
          clearInstructorSession();
        } else {
          setSaveStatus("failed");
          setSaveError(result.error ?? "Could not save session.");
        }
      } catch (e) {
        setSaveStatus("failed");
        setSaveError((e as Error).message || "Could not save session.");
      } finally {
        finishingRef.current = false;
      }
    },
    [practicedSec, queuePoses, mode, level, timeline.totalSec, current?.poseIndex],
  );

  useEffect(() => {
    if (uiPhase !== "practice") return;
    if (timeline.totalSec <= 0) return;
    if (clock.timeSec < timeline.totalSec) return;
    if (completedRef.current) return;
    completedRef.current = true;
    void finishSession(true);
  }, [clock.timeSec, timeline.totalSec, uiPhase, finishSession]);

  const mediaProgress = current
    ? Math.max(
        0,
        Math.min(1, (clock.timeSec - current.absStartSec) / Math.max(0.01, current.durationSec)),
      )
    : 0;

  const goSafety = () => {
    setAnswers(rules.map((r) => ({ ruleId: r.id, applies: null })));
    setPlan(EMPTY_PLAN);
    setUiPhase("safety");
  };

  const confirmSafety = () => {
    const next = evaluateSafetyPlan({
      poses: selectedPoses,
      answers,
      requestedLevel: level,
    });
    setPlan(next);
    if (!next.ready) return;
    clearInstructorSession();
    completedRef.current = false;
    finishingRef.current = false;
    startedAtRef.current = Date.now();
    setJournalId(null);
    setSaveError(null);
    setSaveStatus("idle");
    setPracticedSec(0);
    setPrepExtraByPoseIndex({});
    setClock({ timeSec: 0, playing: true, rate: mode === "learn" ? 0.9 : 1 });
    setUiPhase("practice");
  };

  const jumpPose = (delta: number) => {
    if (!current) return;
    const nextIndex = Math.max(0, Math.min(queuePoses.length - 1, current.poseIndex + delta));
    if (nextIndex === current.poseIndex) return;
    const target = timeline.flat.find((s) => s.poseIndex === nextIndex);
    if (!target) return;
    setClock((c) => seekClock(c, target.absStartSec));
  };

  const repeatCue = () => {
    if (!current) return;
    setClock((c) => seekClock(c, current.absStartSec));
  };

  const addPrepFive = () => {
    if (!current || current.phase !== "preparation") return;
    const flatBefore = timeline.flat;
    const poseIndex = current.poseIndex;
    const addedSec = 5;
    const nextExtras = {
      ...prepExtraByPoseIndex,
      [poseIndex]: (prepExtraByPoseIndex[poseIndex] ?? 0) + addedSec,
    };
    const after = buildSessionTimeline({
      poses: queuePoses,
      mode,
      level,
      levelByPoseId,
      adaptations: plan.forcedAdaptations,
      prepExtraByPoseIndex: nextExtras,
    });
    const remapped = remapClockAfterPrepExtend({
      flatBefore,
      flatAfter: after.flat,
      timeSec: clock.timeSec,
      prepSegmentId: current.id,
      addedSec,
    });
    setPrepExtraByPoseIndex(nextExtras);
    setClock((c) => seekClock(c, remapped));
  };

  const easierVariation = () => {
    setLevel((prev) => LEVELS[Math.max(0, LEVELS.indexOf(prev) - 1)]);
  };

  const replaceCurrentPose = (slug: string) => {
    if (!currentPose) return;
    setSelected((prev) => prev.map((s) => (s === currentPose.slug ? slug : s)));
    setReplaceOpen(false);
  };

  const resetToSetup = () => {
    clearInstructorSession();
    setUiPhase("setup");
    setClock({ timeSec: 0, playing: false, rate: 1 });
    setPlan(EMPTY_PLAN);
    setPrepExtraByPoseIndex({});
    setPracticedSec(0);
    setSaveStatus("idle");
    setSaveError(null);
    setJournalId(null);
    completedRef.current = false;
    finishingRef.current = false;
  };

  const showMissingAssets = uiPhase === "setup" || uiPhase === "complete" || uiPhase === "safety";
  const atFirstPose = !current || current.poseIndex === 0;
  const atLastPose = !current || current.poseIndex >= queuePoses.length - 1;
  const prepDisabled = !current || current.phase !== "preparation";

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-5 pb-28">
      <header className="space-y-2">
        <Badge variant="outline">Pilot · 5 poses</Badge>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Virtual instructor</h1>
        <p className="text-sm text-muted-foreground">
          Learn or Flow through Mountain, Child&apos;s Pose, Cat–Cow, Warrior II, and Plank.
          Media is labeled honestly — filmed instructor clips are not claimed.
        </p>
      </header>

      {uiPhase === "setup" ? (
        <div className="space-y-4" data-testid="instructor-setup">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Mode</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                variant={mode === "learn" ? "default" : "outline"}
                aria-pressed={mode === "learn"}
                onClick={() => setMode("learn")}
                data-testid="instructor-mode-learn"
              >
                Learn — slower setup & tips
              </Button>
              <Button
                className="min-h-11"
                variant={mode === "flow" ? "default" : "outline"}
                aria-pressed={mode === "flow"}
                onClick={() => setMode("flow")}
                data-testid="instructor-mode-flow"
              >
                Flow — brief cues, quieter holds
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Variation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <Button
                  key={l}
                  className="min-h-11 capitalize"
                  variant={level === l ? "default" : "outline"}
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                  data-testid={`instructor-level-${l}`}
                >
                  {l}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Poses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {INSTRUCTOR_PILOT_POSES.map((p) => {
                const on = selected.includes(p.slug);
                const media = p.variants[level].media;
                return (
                  <button
                    key={p.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(p.slug)
                          ? prev.filter((s) => s !== p.slug)
                          : [...prev, p.slug],
                      )
                    }
                    className={cn(
                      "flex w-full min-h-11 items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left",
                      on ? "border-primary bg-primary/5" : "border-border",
                    )}
                    data-testid={`instructor-pose-${p.slug}`}
                  >
                    <span>
                      <span className="block font-medium">{p.english}</span>
                      <span className="text-xs text-muted-foreground">{p.sanskrit}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {media.label}
                      </span>
                    </span>
                    <Badge variant="secondary">{on ? "On" : "Off"}</Badge>
                  </button>
                );
              })}
              <p className="text-sm text-muted-foreground" data-testid="instructor-duration-preview">
                Estimated duration: {formatClock(previewSec)} (setup, both sides when needed, holds,
                transitions)
              </p>
            </CardContent>
          </Card>

          <Button
            className="min-h-12 w-full"
            disabled={selected.length === 0}
            onClick={goSafety}
            data-testid="instructor-continue-safety"
          >
            Continue
          </Button>
        </div>
      ) : null}

      {uiPhase === "safety" ? (
        <Card
          data-testid="instructor-safety"
          role="dialog"
          aria-labelledby="instructor-safety-title"
          aria-describedby="instructor-safety-desc"
        >
          <CardHeader>
            <CardTitle id="instructor-safety-title" className="text-lg">
              Before we adapt anything
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p id="instructor-safety-desc" className="text-sm text-muted-foreground">
              Answer these catalog notes so we do not claim an adapted practice without your input.
              This is not medical clearance.
            </p>
            {rules.length === 0 ? (
              <p className="text-sm">No restriction prompts for this selection.</p>
            ) : (
              rules.map((r) => {
                const applies = answers.find((a) => a.ruleId === r.id)?.applies ?? null;
                return (
                  <div key={r.id} className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">{r.condition}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Area: {r.bodyArea} · Reviewed by catalog editor (not a clinician)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-11"
                        variant={applies === true ? "default" : "outline"}
                        aria-pressed={applies === true}
                        onClick={() =>
                          setAnswers((prev) =>
                            prev.map((a) =>
                              a.ruleId === r.id ? { ...a, applies: true } : a,
                            ),
                          )
                        }
                      >
                        Applies to me
                      </Button>
                      <Button
                        size="sm"
                        className="min-h-11"
                        variant={applies === false ? "default" : "outline"}
                        aria-pressed={applies === false}
                        onClick={() =>
                          setAnswers((prev) =>
                            prev.map((a) =>
                              a.ruleId === r.id ? { ...a, applies: false } : a,
                            ),
                          )
                        }
                      >
                        Does not apply
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            {!plan.ready && plan.missingRuleIds.length > 0 ? (
              <p className="text-sm text-destructive">Answer every prompt to continue.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setUiPhase("setup")}>
                Back
              </Button>
              <Button className="min-h-11" onClick={confirmSafety} data-testid="instructor-start">
                Start {mode === "learn" ? "Learn" : "Flow"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {uiPhase === "practice" && current && currentPose && currentVariant ? (
        <div className="space-y-3" data-testid="instructor-player">
          {plan.claimsAdapted ? (
            <p className="text-xs text-muted-foreground" data-testid="instructor-adapted-note">
              Practice adjusted from your answers
              {plan.warnings[0] ? ` — ${plan.warnings[0]}` : "."}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Standard pilot sequence (not medically adapted).
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-serif text-xl font-semibold">
                {adaptationDisplayName ?? currentPose.english}
              </p>
              <p className="text-xs text-muted-foreground">
                {adaptationDisplayName && adaptationDisplayName !== currentPose.english
                  ? `${currentPose.english} · `
                  : ""}
                {phaseLabel(current.phase)}
                {current.side !== "both" ? ` · ${current.side} side` : ""} · {currentPoseLevel}
              </p>
            </div>
            <div className="text-right text-sm tabular-nums" data-testid="instructor-clock">
              <div>{formatClock(clock.timeSec)}</div>
              <div className="text-xs text-muted-foreground">/ {formatClock(timeline.totalSec)}</div>
            </div>
          </div>

          {/* Mobile-friendly sticky stack: stage + caption + pause */}
          <div className="sticky top-0 z-30 -mx-1 space-y-2 bg-background/95 px-1 pb-2 pt-1 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <InstructorStage
              media={currentVariant.media}
              playing={clock.playing}
              mediaProgress={mediaProgress}
              mediaWindow={current.mediaWindow}
              className="aspect-[3/4] max-h-[40vh] w-full landscape:max-h-[55vh] sm:aspect-video sm:max-h-[50vh]"
            />

            {captionsOn ? (
              <div
                className="rounded-xl bg-foreground px-4 py-3 text-sm text-background"
                data-testid="instructor-caption"
                aria-live="polite"
              >
                {current.caption}
                {current.breathCue && !current.quiet ? (
                  <span className="mt-1 block text-xs opacity-80">{current.breathCue}</span>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-center">
              <Button
                className="min-h-12 min-w-24"
                aria-label={clock.playing ? "Pause" : "Resume"}
                onClick={() => setClock((c) => (c.playing ? pauseClock(c) : resumeClock(c)))}
                data-testid="instructor-play-pause"
              >
                {clock.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                <span className="ml-2">{clock.playing ? "Pause" : "Play"}</span>
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground" data-testid="instructor-cue">
            {current.cue}
          </p>
          <p className="text-xs text-muted-foreground">
            Props: {currentVariant.props.filter((p) => p !== "none").join(", ") || "none"}
          </p>

          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur md:static md:rounded-2xl md:border md:bg-card md:p-4"
            data-testid="instructor-controls"
          >
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
              <Button
                className="min-h-12 min-w-12"
                variant="outline"
                aria-label="Previous pose"
                disabled={atFirstPose}
                onClick={() => jumpPose(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                className="min-h-12 min-w-12"
                variant="outline"
                aria-label="Next pose"
                disabled={atLastPose}
                onClick={() => jumpPose(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Button
                className="min-h-12"
                variant="outline"
                onClick={repeatCue}
                data-testid="instructor-repeat"
              >
                <RotateCcw className="mr-1 h-4 w-4" /> Repeat
              </Button>
              <Button
                className="min-h-12"
                variant="outline"
                onClick={easierVariation}
                data-testid="instructor-easier"
              >
                Easier
              </Button>
              <Button
                className="min-h-12"
                variant="outline"
                disabled={prepDisabled}
                onClick={addPrepFive}
                data-testid="instructor-add-prep"
              >
                <Plus className="mr-1 h-4 w-4" /> Prep +5s
              </Button>
              <Button
                className="min-h-12"
                variant="outline"
                onClick={() => setReplaceOpen((v) => !v)}
                data-testid="instructor-replace"
              >
                <Replace className="mr-1 h-4 w-4" /> Replace
              </Button>
              <Button
                className="min-h-12"
                variant="outline"
                aria-pressed={captionsOn}
                onClick={() => setCaptionsOn((v) => !v)}
              >
                <Captions className="mr-1 h-4 w-4" />
                {captionsOn ? "Captions on" : "Captions off"}
              </Button>
              <Button
                className="min-h-12"
                variant="outline"
                aria-pressed={narrationOn}
                onClick={() => setNarrationOn((v) => !v)}
              >
                {narrationOn ? (
                  <Volume2 className="mr-1 h-4 w-4" />
                ) : (
                  <VolumeX className="mr-1 h-4 w-4" />
                )}
                {narrationOn ? "Narration on" : "Narration off"}
              </Button>
              <Button
                className="min-h-12"
                variant="ghost"
                onClick={() => void finishSession(false)}
              >
                End
              </Button>
            </div>
            {replaceOpen ? (
              <div className="mx-auto mt-3 flex max-w-3xl flex-wrap gap-2">
                {INSTRUCTOR_PILOT_POSES.map((p) => (
                  <Button
                    key={p.slug}
                    size="sm"
                    className="min-h-11"
                    variant="secondary"
                    disabled={p.slug === currentPose.slug}
                    onClick={() => replaceCurrentPose(p.slug)}
                  >
                    {p.english}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          {narrationOn && currentVariant.media.narrationUrl && !current.quiet ? (
            <audio
              key={`${current.id}-narration`}
              src={currentVariant.media.narrationUrl}
              autoPlay
              onError={(e) => {
                e.currentTarget.removeAttribute("src");
              }}
            />
          ) : null}
        </div>
      ) : null}

      {uiPhase === "complete" ? (
        <Card data-testid="instructor-complete">
          <CardHeader>
            <CardTitle
              className="font-serif text-2xl"
              data-testid="instructor-save-status"
            >
              {instructorSaveHeadline(saveStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {saveStatus === "saved" ? (
              <p className="text-sm text-muted-foreground">
                One practice record for this instructor pilot. Reflect attaches to the same journal
                entry — it does not create a duplicate.
              </p>
            ) : saveStatus === "too_brief" ? (
              <p className="text-sm text-muted-foreground">
                Practice a little longer next time so we can credit a session in your journal.
              </p>
            ) : saveStatus === "partial" || saveStatus === "saving" ? (
              <p className="text-sm text-muted-foreground">
                {saveStatus === "saving"
                  ? "Writing your practice to the journal…"
                  : "Partial practice — saving what you completed."}
              </p>
            ) : saveStatus === "failed" ? (
              <p className="text-sm text-muted-foreground">
                Your practice finished, but we could not write the journal entry.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Session ended.</p>
            )}
            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            <div className="flex flex-wrap gap-2">
              {saveStatus === "saved" ? (
                <Button
                  className="min-h-11"
                  onClick={() =>
                    navigate(
                      completionLeavePath("journal", {
                        title: `Instructor ${mode}`,
                        body: "",
                        editId: journalId,
                      }),
                    )
                  }
                  data-testid="instructor-reflect"
                >
                  Reflect in journal
                </Button>
              ) : null}
              <Button
                className="min-h-11"
                variant="outline"
                onClick={() => navigate(completionLeavePath("home"))}
              >
                Done
              </Button>
              <Button className="min-h-11" variant="ghost" onClick={resetToSetup}>
                Practice again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showMissingAssets ? (
        <details className="rounded-xl border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Media still needed (precise list)</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {INSTRUCTOR_PILOT_MISSING_ASSETS.map((a) => (
              <li key={a.id}>
                <code className="text-xs">{a.id}</code> — {a.need}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Implemented: structured timeline, Learn/Flow, variation sync, safety intake, shared
            clock, honest media fallback, session save + reflect-by-edit. Not implemented: filmed
            instructor video, human VO, validated pose analysis (camera is not scoring here).
          </p>
          <p className="mt-1 text-xs">
            Optional mirror only:{" "}
            <Link href="/pose-coach" className="underline underline-offset-2">
              Pose self-check (labeled mirror, not analysis)
            </Link>
            .
          </p>
        </details>
      ) : null}
    </FadeIn>
  );
}
