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
  intakePrompts,
  revalidateReplacement,
  type IntakePrompt,
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
  formatPracticedSummary,
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
  activeBodyAreas: [],
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
  const [saveKind, setSaveKind] = useState<"partial" | "complete" | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const finishingRef = useRef(false);
  const narrationRef = useRef<HTMLAudioElement | null>(null);

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
  const prompts = useMemo(() => intakePrompts(selectedPoses), [selectedPoses]);
  const [replacePending, setReplacePending] = useState<{
    slug: string;
    missing: IntakePrompt[];
  } | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

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
    if (isSafetyPlan(saved.plan)) {
      const restored = saved.plan as SafetyPlan;
      setPlan({
        ...restored,
        activeBodyAreas: Array.isArray(restored.activeBodyAreas)
          ? restored.activeBodyAreas
          : [],
      });
    }
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

  // Keep narration paused when the shared clock is paused (next/prev/repeat).
  useEffect(() => {
    const a = narrationRef.current;
    if (!a) return;
    if (!clock.playing || !narrationOn) {
      a.pause();
      return;
    }
    void a.play().catch(() => undefined);
  }, [clock.playing, narrationOn, current?.id]);

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
        setSaveKind(null);
        setSaveError(null);
        clearInstructorSession();
        finishingRef.current = false;
        return;
      }

      setSaveKind(kind === "partial" ? "partial" : "complete");
      setSaveStatus(kind === "partial" ? "partial" : "saving");
      setSaveError(null);

      // Yield so "partial" / "saving" can paint before the network write.
      await new Promise((r) => setTimeout(r, 0));
      setSaveStatus("saving");

      const minutes = Math.max(1, Math.round(practicedSec / 60));
      const poseNames = queuePoses.map((p) => {
        const adaptId = plan.forcedAdaptations[p.poseId];
        if (adaptId && p.adaptations[adaptId]?.displayName) {
          return p.adaptations[adaptId]!.displayName;
        }
        return p.english;
      });
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
          journalTags: [
            "instructor-pilot",
            mode,
            level,
            ...Object.values(plan.forcedAdaptations),
          ],
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
    [practicedSec, queuePoses, mode, level, timeline.totalSec, current?.poseIndex, plan.forcedAdaptations],
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
    setAnswers(prompts.map((p) => ({ ruleId: p.id, applies: null })));
    setPlan(EMPTY_PLAN);
    setUiPhase("safety");
  };

  const setAreaAnswer = (promptId: string, applies: boolean) => {
    setAnswers((prev) => {
      const has = prev.some((a) => a.ruleId === promptId);
      if (!has) return [...prev, { ruleId: promptId, applies }];
      return prev.map((a) => (a.ruleId === promptId ? { ...a, applies } : a));
    });
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
    setSaveKind(null);
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
    const replacement = instructorPoseBySlug(slug);
    if (!replacement) return;
    setReplaceError(null);

    const result = revalidateReplacement({
      currentPoses: selectedPoses,
      replacement,
      replaceSlug: currentPose.slug,
      answers,
      requestedLevel: level,
    });

    if (result.missingPrompts.length > 0) {
      setReplacePending({ slug, missing: result.missingPrompts });
      setAnswers((prev) => {
        const next = [...prev];
        for (const p of result.missingPrompts) {
          if (!next.some((a) => a.ruleId === p.id)) {
            next.push({ ruleId: p.id, applies: null });
          }
        }
        return next;
      });
      return;
    }

    if (result.blockedReason) {
      setReplaceError(result.blockedReason);
      return;
    }

    setSelected(result.nextSelected);
    setPlan(result.plan);
    setReplaceOpen(false);
    setReplacePending(null);
    // Stay on the same clock index — timeline rebuilds for the new pose list.
    setClock((c) => seekClock(c, c.timeSec));
  };

  const confirmReplaceAfterAnswers = () => {
    if (!replacePending || !currentPose) return;
    const replacement = instructorPoseBySlug(replacePending.slug);
    if (!replacement) return;
    const result = revalidateReplacement({
      currentPoses: selectedPoses,
      replacement,
      replaceSlug: currentPose.slug,
      answers,
      requestedLevel: level,
    });
    if (!result.plan.ready || result.missingPrompts.length > 0) {
      setReplaceError("Answer the new restriction prompts to continue.");
      return;
    }
    if (result.blockedReason) {
      setReplaceError(result.blockedReason);
      return;
    }
    setSelected(result.nextSelected);
    setPlan(result.plan);
    setReplaceOpen(false);
    setReplacePending(null);
    setReplaceError(null);
  };

  const resetToSetup = () => {
    clearInstructorSession();
    setUiPhase("setup");
    setClock({ timeSec: 0, playing: false, rate: 1 });
    setPlan(EMPTY_PLAN);
    setPrepExtraByPoseIndex({});
    setPracticedSec(0);
    setSaveStatus("idle");
    setSaveKind(null);
    setSaveError(null);
    setJournalId(null);
    completedRef.current = false;
    finishingRef.current = false;
  };

  const atFirstPose = !current || current.poseIndex === 0;
  const atLastPose = !current || current.poseIndex >= queuePoses.length - 1;
  const prepDisabled = !current || current.phase !== "preparation";

  return (
    <FadeIn
      className={cn(
        "mx-auto max-w-3xl space-y-5",
        uiPhase === "practice"
          ? "flex min-h-0 flex-col pb-4 landscape:h-[calc(100dvh-6.75rem)] landscape:max-h-[calc(100dvh-6.75rem)] landscape:overflow-hidden landscape:space-y-2 landscape:pb-0 md:pb-10"
          : "pb-28",
      )}
    >
      {uiPhase !== "practice" ? (
        <header className="space-y-2">
          <Badge variant="outline">Pilot · 5 poses</Badge>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Virtual instructor</h1>
          <p className="text-sm text-muted-foreground">
            Learn or Flow through Mountain, Child&apos;s Pose, Cat–Cow, Warrior II, and Plank.
            Media is labeled honestly — filmed instructor clips are not claimed.
          </p>
        </header>
      ) : (
        <header className="flex shrink-0 items-center justify-between gap-2 landscape:py-0">
          <Badge variant="outline">Pilot · 5 poses</Badge>
          <p className="text-xs text-muted-foreground">Virtual instructor</p>
        </header>
      )}

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
              Tell us which body areas need care today. We reuse these answers if you replace a
              pose mid-session. This is not medical clearance.
            </p>
            {prompts.length === 0 ? (
              <p className="text-sm">No restriction prompts for this selection.</p>
            ) : (
              prompts.map((p) => {
                const applies = answers.find((a) => a.ruleId === p.id)?.applies ?? null;
                return (
                  <div key={p.id} className="space-y-2 rounded-xl border p-3" data-testid={`instructor-intake-${p.bodyArea}`}>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.detail}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-11"
                        variant={applies === true ? "default" : "outline"}
                        aria-pressed={applies === true}
                        onClick={() => setAreaAnswer(p.id, true)}
                      >
                        Applies to me
                      </Button>
                      <Button
                        size="sm"
                        className="min-h-11"
                        variant={applies === false ? "default" : "outline"}
                        aria-pressed={applies === false}
                        onClick={() => setAreaAnswer(p.id, false)}
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
        <div
          className="flex min-h-0 flex-1 flex-col gap-2 max-md:pb-[calc(7.5rem+env(safe-area-inset-bottom))] landscape:max-h-none landscape:overflow-hidden landscape:pb-0 md:pb-0"
          data-testid="instructor-player"
        >
          {plan.claimsAdapted ? (
            <p className="shrink-0 text-xs text-muted-foreground landscape:hidden" data-testid="instructor-adapted-note">
              Practice adjusted from your answers
              {plan.warnings[0] ? ` — ${plan.warnings[0]}` : "."}
            </p>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground landscape:hidden">
              Standard pilot sequence (not medically adapted).
            </p>
          )}

          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-serif text-lg font-semibold landscape:text-base sm:text-xl">
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
            <div className="shrink-0 text-right text-sm tabular-nums" data-testid="instructor-clock">
              <div>{formatClock(clock.timeSec)}</div>
              <div className="text-xs text-muted-foreground">/ {formatClock(timeline.totalSec)}</div>
            </div>
          </div>

          {/* Demo + cue use remaining height; Play lives in the reserved control chrome. */}
          <div
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto landscape:min-h-0 landscape:flex-1 landscape:flex-row landscape:items-stretch landscape:overflow-hidden"
            data-testid="instructor-focus-stack"
          >
            <InstructorStage
              media={currentVariant.media}
              playing={clock.playing}
              mediaProgress={mediaProgress}
              mediaWindow={current.mediaWindow}
              className="aspect-[3/4] max-h-[min(42vh,calc(100dvh-22rem))] w-full shrink-0 landscape:aspect-auto landscape:h-auto landscape:max-h-full landscape:min-h-0 landscape:flex-1 landscape:shrink landscape:basis-0 landscape:w-[46%] landscape:max-w-[46%] sm:aspect-video sm:max-h-[min(48vh,calc(100dvh-18rem))] sm:landscape:w-[50%] sm:landscape:max-w-[50%]"
              compactLabel
            />

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 landscape:min-h-0 landscape:overflow-hidden landscape:py-0">
              {captionsOn ? (
                <div
                  className="rounded-xl bg-foreground px-3 py-2 text-sm text-background landscape:max-h-[4.5rem] landscape:overflow-hidden landscape:px-3 landscape:py-1.5 landscape:text-xs"
                  data-testid="instructor-caption"
                  aria-live="polite"
                >
                  {current.caption}
                  {current.breathCue && !current.quiet ? (
                    <span className="mt-1 block text-xs opacity-80 landscape:hidden">{current.breathCue}</span>
                  ) : null}
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground landscape:line-clamp-2 landscape:text-xs" data-testid="instructor-cue">
                {current.cue}
              </p>
              <p className="text-xs text-muted-foreground landscape:hidden">
                Props: {currentVariant.props.filter((p) => p !== "none").join(", ") || "none"}
              </p>
              <p
                className="text-[11px] text-muted-foreground landscape:line-clamp-1"
                data-testid="instructor-media-status"
              >
                {currentVariant.media.label}
              </p>
            </div>
          </div>

          <div
            className="fixed inset-x-0 bottom-14 z-40 border-t bg-background/95 p-2 backdrop-blur landscape:static landscape:bottom-auto landscape:z-auto landscape:mt-1 landscape:shrink-0 landscape:rounded-xl landscape:border landscape:bg-card landscape:p-1.5 md:static md:bottom-auto md:z-auto md:mt-1 md:rounded-2xl md:border md:bg-card md:p-3"
            data-testid="instructor-controls"
          >
            <div className="mx-auto flex max-w-3xl flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:justify-center lg:gap-2 lg:overflow-visible">
              <Button
                className="min-h-12 min-w-[5.5rem] shrink-0"
                aria-label={clock.playing ? "Pause" : "Resume"}
                onClick={() => setClock((c) => (c.playing ? pauseClock(c) : resumeClock(c)))}
                data-testid="instructor-play-pause"
              >
                {clock.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                <span className="ml-2">{clock.playing ? "Pause" : "Play"}</span>
              </Button>
              <Button
                className="min-h-11 min-w-11 shrink-0 landscape:min-h-10 landscape:min-w-10"
                variant="outline"
                aria-label="Previous pose"
                disabled={atFirstPose}
                onClick={() => jumpPose(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                className="min-h-11 min-w-11 shrink-0 landscape:min-h-10 landscape:min-w-10"
                variant="outline"
                aria-label="Next pose"
                disabled={atLastPose}
                onClick={() => jumpPose(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Button
                className="min-h-11 shrink-0 landscape:min-h-10"
                variant="outline"
                onClick={repeatCue}
                data-testid="instructor-repeat"
              >
                <RotateCcw className="mr-1 h-4 w-4" /> Repeat
              </Button>
              <Button
                className="min-h-11 shrink-0 landscape:min-h-10"
                variant="outline"
                onClick={easierVariation}
                data-testid="instructor-easier"
              >
                Easier
              </Button>
              <Button
                className="min-h-11 shrink-0 landscape:min-h-10"
                variant="outline"
                disabled={prepDisabled}
                onClick={addPrepFive}
                data-testid="instructor-add-prep"
              >
                <Plus className="mr-1 h-4 w-4" /> Prep +5s
              </Button>
              <Button
                className="min-h-11 shrink-0 landscape:min-h-10"
                variant="outline"
                onClick={() => {
                  setReplaceOpen((v) => !v);
                  setReplacePending(null);
                  setReplaceError(null);
                }}
                data-testid="instructor-replace"
              >
                <Replace className="mr-1 h-4 w-4" /> Replace
              </Button>
              <Button
                className="min-h-11 shrink-0"
                variant="outline"
                aria-pressed={captionsOn}
                onClick={() => setCaptionsOn((v) => !v)}
              >
                <Captions className="mr-1 h-4 w-4" />
                {captionsOn ? "Captions on" : "Captions off"}
              </Button>
              <Button
                className="min-h-11 shrink-0"
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
                className="min-h-11 shrink-0"
                variant="ghost"
                onClick={() => void finishSession(false)}
              >
                End
              </Button>
            </div>
            {replaceOpen ? (
              <div className="mx-auto mt-3 max-w-3xl space-y-3" data-testid="instructor-replace-panel">
                {replaceError ? (
                  <p className="text-sm text-destructive" data-testid="instructor-replace-error">
                    {replaceError}
                  </p>
                ) : null}
                {replacePending ? (
                  <div className="space-y-2 rounded-xl border p-3" data-testid="instructor-replace-intake">
                    <p className="text-sm font-medium">
                      Answer these areas before switching to{" "}
                      {instructorPoseBySlug(replacePending.slug)?.english ?? "that pose"}:
                    </p>
                    {replacePending.missing.map((p) => {
                      const applies = answers.find((a) => a.ruleId === p.id)?.applies ?? null;
                      return (
                        <div key={p.id} className="space-y-2">
                          <p className="text-sm">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.detail}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="min-h-11"
                              variant={applies === true ? "default" : "outline"}
                              aria-pressed={applies === true}
                              onClick={() => setAreaAnswer(p.id, true)}
                            >
                              Applies to me
                            </Button>
                            <Button
                              size="sm"
                              className="min-h-11"
                              variant={applies === false ? "default" : "outline"}
                              aria-pressed={applies === false}
                              onClick={() => setAreaAnswer(p.id, false)}
                            >
                              Does not apply
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      className="min-h-11"
                      onClick={confirmReplaceAfterAnswers}
                      data-testid="instructor-replace-confirm"
                    >
                      Confirm replacement
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {INSTRUCTOR_PILOT_POSES.map((p) => (
                      <Button
                        key={p.slug}
                        size="sm"
                        className="min-h-11"
                        variant="secondary"
                        disabled={p.slug === currentPose.slug}
                        onClick={() => replaceCurrentPose(p.slug)}
                        data-testid={`instructor-replace-${p.slug}`}
                      >
                        {p.english}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {narrationOn && currentVariant.media.narrationUrl && !current.quiet ? (
            <audio
              key={`${current.id}-narration`}
              ref={narrationRef}
              src={currentVariant.media.narrationUrl}
              autoPlay={clock.playing}
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
              {instructorSaveHeadline(saveStatus, { wasPartial: saveKind === "partial" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground" data-testid="instructor-practiced-time">
              {formatPracticedSummary(practicedSec, { plannedSec: timeline.totalSec })}
            </p>
            {saveStatus === "saved" && Object.keys(plan.forcedAdaptations).length > 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="instructor-saved-variants">
                Saved shapes:{" "}
                {queuePoses
                  .map((p) => {
                    const id = plan.forcedAdaptations[p.poseId];
                    return id && p.adaptations[id]?.displayName
                      ? p.adaptations[id]!.displayName
                      : p.english;
                  })
                  .join(", ")}
              </p>
            ) : null}
            {saveStatus === "saved" ? (
              <p className="text-sm text-muted-foreground">
                {saveKind === "partial"
                  ? "Partial practice was written to your journal. Reflect attaches to the same entry."
                  : "One practice record for this instructor pilot. Reflect attaches to the same journal entry — it does not create a duplicate."}
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

      {uiPhase === "setup" ? (
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
            Filmed instructor prep/entry/hold/exit clips and human VO are not shipped. Presentation
            animations are labeled honestly in practice — they are not complete instructor media.
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
