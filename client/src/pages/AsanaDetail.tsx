import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ds/Tag";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ds/Tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Level } from "@/components/AnimatedAsana";
import { StepMotion } from "@/components/StepMotion";
import { VoicePlayer } from "@/components/VoicePlayer";
import { PoseExplanation, PoseTeachRail } from "@/components/PoseExplanation";
import { PoseImage } from "@/components/PoseImage";
import { ScrollRow } from "@/components/ScrollRow";
import {
  ASANAS,
  asanaBySlug,
  type Asana,
  type Difficulty,
  type Severity,
} from "@/data/content";
import { BENEFIT_REVIEW_NOTE, poseHasUnreviewedClaims } from "@/lib/benefitClaims";
import { buildPoseExplanation } from "@/lib/poseExplanation";
import { stepsForVariation } from "@/lib/poseLesson";
import { difficultyBadgeClass } from "@/lib/difficultyBadge";
import { CONTENT_REVIEW } from "@/data/contentProvenance";
import { manifestAudioUrl, usePoseMedia } from "@/lib/poseMediaApi";
import { pronunciationFor, shouldShowPronunciation } from "@/lib/sanskritPronunciation";
import { usagesForAsana } from "@/data/asanaUsage";
import { KEYS, poseLevelFromExperience, readString } from "@/lib/localPrefs";
import { QUICK_SESSIONS, quickSessionMeta } from "@/data/quickSessions";
import { catalogSessionMinutes } from "@/lib/pathwayTiming";
import { usePractice } from "@/context/PracticeContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  ArrowLeft,
  Plus,
  Check,
  Clock,
  Sparkles,
  Settings2,
  AlertTriangle,
  Info,
  AlertCircle,
  Activity,
  NotebookPen,
  Check as CheckIcon,
  Heart,
  Play,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PoseNote } from "@shared/schema";

// Personal notes section with debounced (800ms) auto-save. Persisted per pose
// via the backend pose_notes table (v3.4).
function PersonalNotes({ slug }: { slug: string }) {
  const { data: note, isLoading } = useQuery<PoseNote | null>({
    queryKey: ["/api/notes", slug],
  });
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate the textarea once when the note loads.
  useEffect(() => {
    if (!isLoading && !hydrated.current) {
      setValue(note?.body ?? "");
      hydrated.current = true;
    }
  }, [isLoading, note]);

  const onChange = (next: string) => {
    setValue(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      apiRequest("PUT", `/api/notes/${slug}`, { body: next })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/notes", slug] });
          setSaved(true);
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSaved(false), 2000);
        })
        .catch(() => {});
    }, 800);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  return (
    <Card className="shadow-soft" data-testid="card-pose-notes">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-serif text-base">
            <NotebookPen className="h-4 w-4 text-secondary" aria-hidden />{" "}
            <label htmlFor="pose-notes">My notes</label>
          </h3>
          {saved && (
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
              data-testid="text-notes-saved"
            >
              <CheckIcon className="h-3.5 w-3.5 text-secondary" aria-hidden /> Saved
            </span>
          )}
        </div>
        <Textarea
          id="pose-notes"
          placeholder="What works for me / what hurts / props I like…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          className="min-h-11 py-2"
          aria-describedby="pose-notes-help"
          data-testid="input-pose-notes"
        />
        <p id="pose-notes-help" className="text-xs text-muted-foreground">
          Private notes for this pose — saved to your practice data on this device or account.
        </p>
      </CardContent>
    </Card>
  );
}

// Intensity → number of filled dots for the "You'll feel this in..." card.
const INTENSITY_DOTS: Record<"low" | "medium" | "strong", number> = {
  low: 1,
  medium: 2,
  strong: 3,
};

const SEVERITY_META: Record<
  Severity,
  { label: string; icon: typeof AlertTriangle; tone: string }
> = {
  avoid: { label: "Avoid", icon: AlertTriangle, tone: "text-primary" },
  modify: { label: "Modify", icon: Info, tone: "text-secondary" },
  caution: { label: "Caution", icon: AlertCircle, tone: "text-primary/80" },
};

const SEVERITY_ORDER: Severity[] = ["avoid", "modify", "caution"];

/** Same category, same difficulty first, never the pose itself. */
function relatedPoses(asana: Asana, limit = 8): Asana[] {
  const others = ASANAS.filter((a) => a.slug !== asana.slug && a.category === asana.category);
  const sameDifficulty = others.filter((a) => a.difficulty === asana.difficulty);
  const rest = others.filter((a) => a.difficulty !== asana.difficulty);
  return [...sameDifficulty, ...rest].slice(0, limit);
}

export default function AsanaDetail() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const asana = asanaBySlug(slug || "");
  const { data: poseMedia } = usePoseMedia(slug || undefined);
  const { add, todays, loadSession } = usePractice();
  const { toast } = useToast();
  const [level, setLevel] = useState<Level>(() =>
    poseLevelFromExperience(readString(KEYS.experienceLevel)),
  );
  /** True while a lesson is running, so the page can stand down competing CTAs. */
  const [training, setTraining] = useState(false);
  useDocumentTitle(asana ? `${asana.english} · Sadhana` : "Pose · Sadhana");

  if (!asana) {
    return (
      <div className="animate-fade-in mx-auto max-w-xl space-y-4 py-10 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Pose not found</h1>
        <p className="text-muted-foreground">
          That asana isn't in the library. Try searching, or browse all poses.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/asanas">Back to library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/search">Search poses</Link>
          </Button>
        </div>
      </div>
    );
  }

  const inToday = !!todays.find((x) => x.slug === asana.slug);
  const variation = asana.variations[level];
  const adaptedSteps = stepsForVariation(asana, level);
  const howToSteps = adaptedSteps.map((s, idx) => ({
    text: s.text,
    pose: s.pose ?? asana.steps[idx]?.pose ?? asana.pose,
    stepMotion: variation.steps?.length ? (undefined as undefined) : asana.steps[idx]?.stepMotion,
  }));
  const usages = usagesForAsana(asana.slug);
  const related = relatedPoses(asana);
  const difficulty: Difficulty =
    level === "beginner" ? "Beginner" : level === "advanced" ? "Advanced" : "Intermediate";
  const teaching = buildPoseExplanation(asana, difficulty);
  const primaryRegion =
    asana.stretchZones.find((z) => z.primary)?.region ?? asana.stretchZones[0]?.region;
  const focus = primaryRegion ? `${primaryRegion} · ${asana.category}` : asana.category;
  const durationLabel =
    level === "intermediate" && !variation.steps
      ? asana.hold
      : `About ${variation.holdSeconds} seconds (${level})`;
  const propList = variation.props.filter((p) => p !== "none");

  const addToday = () => {
    add(asana);
    toast({
      title: "Added to today's practice",
      description: `${asana.english} is ready in your session.`,
    });
  };

  const practiceNow = () => {
    const hold = asana.variations[level]?.holdSeconds ?? asana.holdSeconds;
    loadSession([{ asana, holdSeconds: hold }], {
      label: `${asana.english} · practice now`,
      plannedMinutes: catalogSessionMinutes([{ slug: asana.slug, holdSeconds: hold }]),
    });
    navigate("/guided");
  };

  const startMood = (id: string) => {
    const q = QUICK_SESSIONS.find((s) => s.id === id);
    if (!q) return;
    const poses = q.poses
      .map((p) => {
        const a = asanaBySlug(p.slug);
        return a ? { asana: a, holdSeconds: p.holdSeconds } : null;
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } =>
          x != null,
      );
    loadSession(poses, quickSessionMeta(q));
    navigate("/guided");
  };

  // group avoidIf rows by severity, in display order
  const grouped = SEVERITY_ORDER.map((sev) => ({
    sev,
    rows: asana.avoidIf.filter((r) => r.severity === sev),
  })).filter((g) => g.rows.length > 0);

  return (
    <article className="animate-fade-in space-y-1">
      <button
        type="button"
        onClick={() => navigate("/asanas")}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Back to Poses"
        data-testid="link-back-asanas"
      >
        <ArrowLeft className="h-4 w-4" /> Poses
      </button>

      {/*
        Media slot. Today this is the still reference inside the lesson.
        A reviewed movement demo mounts in the same slot later; generated
        crossfade clips stay out of teaching.
      */}
      <div data-testid="pose-media-slot" data-media-kind="image">
        <PoseExplanation slug={asana.slug} level={level} onTrainingChange={setTraining} hero showRail={false} hideSteps />
      </div>

      <header className="space-y-2">
        <div>
          <h1
            className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
            data-testid="text-asana-english"
          >
            {asana.english}
          </h1>
          <p className="text-base italic text-muted-foreground" data-testid="text-asana-sanskrit">
            {asana.sanskrit}
          </p>
          {(() => {
            if (!shouldShowPronunciation(asana.english, asana.sanskrit)) return null;
            const pron = pronunciationFor(asana.slug, asana.sanskrit);
            return (
              <p className="text-sm text-muted-foreground" data-testid="text-asana-pronunciation">
                <span className="not-italic">Pronounce:</span>{" "}
                <span className="font-medium text-foreground">{pron.approx}</span>
                <span className="mx-1.5 text-border">·</span>
                <span className="not-italic">{pron.transliteration}</span>
                <span className="mt-0.5 block text-xs">{pron.tip}</span>
              </p>
            );
          })()}
        </div>
        <p className="text-sm leading-snug text-foreground/90">{asana.summary}</p>
        <div className="hidden gap-2 lg:flex">
          <Button
            size="lg"
            onClick={practiceNow}
            className="min-h-11 w-full cursor-pointer sm:w-auto"
            data-testid="button-practice-now"
          >
            <Play className="mr-1.5 h-4 w-4" />
            Practice now
          </Button>
          <Button
            onClick={addToday}
            disabled={inToday}
            variant="outline"
            className="min-h-11 w-full cursor-pointer sm:w-auto"
            data-testid="button-add-today"
          >
            {inToday ? <Check className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
            {inToday ? "In today's practice" : "Add to today's practice"}
          </Button>
        </div>
        <details className="rounded-xl border border-border bg-card px-3 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            Listen again — calm guided audio
          </summary>
          <div className="pb-2">
            <VoicePlayer
              src={manifestAudioUrl(asana.slug, poseMedia)}
              slug={asana.slug}
              compact
            />
          </div>
        </details>
      </header>

      <section aria-label="Quick facts" data-testid="pose-quick-facts">
        <Card className="shadow-soft">
          <CardContent className="space-y-2 p-3">
            <div className="space-y-1.5" data-testid="pose-path-selector">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Level
                </p>
                <Tag className={cn("capitalize", difficultyBadgeClass(asana.difficulty))}>
                  {asana.difficulty}
                </Tag>
              </div>
              <div
                className="flex flex-wrap gap-1.5"
                role="radiogroup"
                aria-label="Difficulty path for pose training"
              >
                {(["beginner", "intermediate", "advanced"] as Level[]).map((lv) => {
                  const selected = level === lv;
                  return (
                    <button
                      key={lv}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${lv} path${selected ? ", selected" : ""}`}
                      onClick={() => setLevel(lv)}
                      className={cn(
                        "min-h-11 rounded-full px-3 text-xs font-medium capitalize transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                      data-testid={`path-chip-${lv}`}
                    >
                      {lv}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-2">
              <div>
                <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> Duration
                </p>
                <p className="mt-0.5 text-sm leading-snug" data-testid="pose-fact-duration">
                  {durationLabel}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5" aria-hidden /> Focus
                </p>
                <p className="mt-0.5 text-sm leading-snug" data-testid="pose-fact-focus">
                  {focus}
                </p>
              </div>
            </div>
            <div className="border-t border-border/70 pt-2">
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Benefits
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-snug text-foreground/90">
                {asana.benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {poseHasUnreviewedClaims(asana) && (
                <p className="mt-1 text-xs leading-snug text-muted-foreground" data-testid="benefit-review-note">
                  {BENEFIT_REVIEW_NOTE}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-serif text-lg">
          How to practice
          {variation.steps && variation.steps.length > 0 ? (
            <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
              ({level} variation)
            </span>
          ) : null}
        </h2>
        <ol className="space-y-1.5">
          {howToSteps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5"
              data-testid={`step-${asana.slug}-${i}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-sm text-primary-foreground">
                {i + 1}
              </span>
              {step.stepMotion && (
                <span
                  className="hidden shrink-0 rounded-lg bg-accent/40 p-1 text-foreground/75 sm:block"
                  data-testid={`step-motion-${asana.slug}-${i}`}
                  aria-hidden
                >
                  <StepMotion motion={step.stepMotion} size={64} decorative label={step.text} />
                </span>
              )}
              <p className="pt-0.5 text-xs leading-snug">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Tabs defaultValue="cues">
        <TabsList className="grid w-full grid-cols-2" aria-label="Cues and cautions">
          <TabsTrigger value="cues" data-testid="tab-cues">
            Cues
          </TabsTrigger>
          <TabsTrigger value="cautions" data-testid="tab-cautions">
            Cautions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cues" className="space-y-2" data-testid="panel-cues">
          {variation.description.trim() !== asana.summary.trim() ? (
            <p className="text-sm leading-snug" data-testid={`variation-${level}`}>
              {variation.description}
            </p>
          ) : (
            <p className="sr-only" data-testid={`variation-${level}`}>
              {variation.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {propList.length > 0 ? (
              propList.map((p) => (
                <Tag key={p} tone="outline" className="capitalize">
                  {p}
                </Tag>
              ))
            ) : (
              <Tag tone="outline">No props needed</Tag>
            )}
          </div>
          <PoseTeachRail slug={asana.slug} level={level} includeWatch={false} />
        </TabsContent>
        <TabsContent value="cautions" className="space-y-3" data-testid="panel-cautions">
          {grouped.length > 0 && (
            <Card className="surface-banner-soft border-primary/20 shadow-none" data-testid="callout-avoid-if">
              <CardContent className="space-y-3 p-3">
                <h2 className="font-serif text-base">Care & caution</h2>
                <div className="space-y-3">
                  {grouped.map(({ sev, rows }) => {
                    const meta = SEVERITY_META[sev];
                    const Icon = meta.icon;
                    return (
                      <div key={sev} className="space-y-1" data-testid={`avoid-group-${sev}`}>
                        <p className={`flex items-center gap-1.5 text-sm font-medium ${meta.tone}`}>
                          <Icon className="h-4 w-4" /> {meta.label}
                        </p>
                        <ul className="space-y-1 pl-6 text-sm text-muted-foreground">
                          {rows.map((r, i) => (
                            <li key={i} className="list-disc">
                              {r.condition}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-1.5" data-testid="pose-watch-outs">
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Watch outs
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-snug text-muted-foreground">
              {teaching.watchOuts.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <Card className="bg-accent/40 shadow-none">
            <CardContent className="flex items-start gap-2 p-3">
              <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
              <div>
                <h3 className="font-serif text-base">Modifications</h3>
                <p className="text-sm leading-snug text-muted-foreground">{asana.modifications}</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs leading-tight text-muted-foreground" data-testid="content-review-note">
            Safety guidance version {CONTENT_REVIEW.version} · reviewed {CONTENT_REVIEW.reviewedAt}.{" "}
            {CONTENT_REVIEW.note}{" "}
            <Link href="/health-disclaimer" className="underline underline-offset-2">
              Health disclaimer
            </Link>
            .
          </p>
        </TabsContent>
      </Tabs>

      {asana.bestFor.length > 0 && (
        <Card className="border-primary/20 shadow-soft" data-testid="card-best-for">
          <CardContent className="space-y-2 p-3">
            <h2 className="flex items-center gap-2 font-serif text-base">
              <Heart className="h-4 w-4 text-primary" aria-hidden />
              Why practice it
            </h2>
            <ScrollRow label={`Why practice ${asana.english}`} testId="best-for-row">
              {asana.bestFor.map((item, i) => (
                <Link
                  key={i}
                  href={`/search?q=${encodeURIComponent(item)}`}
                  className="inline-flex min-h-11 shrink-0 items-center"
                >
                  <Tag
                    tone="leaf"
                    className="cursor-pointer px-3 py-2 text-sm font-normal"
                    data-testid={`best-for-${i}`}
                  >
                    {item}
                  </Tag>
                </Link>
              ))}
            </ScrollRow>
          </CardContent>
        </Card>
      )}

      {usages.length > 0 && (
        <Card className="shadow-soft" data-testid="card-practice-it-in">
          <CardContent className="space-y-2 p-3">
            <h2 className="flex items-center gap-2 font-serif text-base">
              <Play className="h-4 w-4 text-secondary" aria-hidden />
              Practice it in
            </h2>
            <ScrollRow label="Sessions that include this pose" testId="practice-it-in-row">
              {usages.map((u, i) => {
                if (u.kind === "mood") {
                  return (
                    <Button
                      key={`mood-${u.id}-${i}`}
                      variant="outline"
                      className="h-auto min-h-11 shrink-0 whitespace-nowrap px-3"
                      onClick={() => startMood(u.id)}
                      data-testid={`usage-mood-${u.id}`}
                    >
                      <span className="font-medium">{u.label}</span>
                      <span className="text-muted-foreground">· {u.time} mood session</span>
                    </Button>
                  );
                }
                if (u.kind === "flow") {
                  return (
                    <Button
                      key={`flow-${u.slug}-${i}`}
                      variant="outline"
                      className="h-auto min-h-11 shrink-0 whitespace-nowrap px-3"
                      asChild
                    >
                      <Link href={`/pathways/${u.slug}`} data-testid={`usage-flow-${u.slug}`}>
                        <span className="font-medium">{u.name}</span>
                        <span className="text-muted-foreground">· {u.minutes} min flow</span>
                      </Link>
                    </Button>
                  );
                }
                return (
                  <Button
                    key={`profile-${u.id}-${i}`}
                    variant="outline"
                    className="h-auto min-h-11 shrink-0 whitespace-nowrap px-3"
                    asChild
                  >
                    <Link href="/profiles" data-testid={`usage-profile-${u.id}`}>
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground">· practice profile</span>
                    </Link>
                  </Button>
                );
              })}
            </ScrollRow>
          </CardContent>
        </Card>
      )}

      {asana.stretchZones.length > 0 && (
        <Card className="border-secondary/30 shadow-soft" data-testid="card-stretch-zones">
          <CardContent className="space-y-2 p-3">
            <h2 className="flex items-center gap-2 font-serif text-base">
              <Activity className="h-4 w-4 text-secondary" aria-hidden />
              You'll feel this in…
            </h2>
            <ul className="divide-y divide-border/60">
              {asana.stretchZones.map((z, i) => {
                const filled = INTENSITY_DOTS[z.intensity];
                const dotColor = z.primary ? "bg-primary" : "bg-secondary";
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 py-1 first:pt-0 last:pb-0"
                    data-testid={`stretch-zone-${i}`}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          z.primary ? "bg-primary" : "bg-secondary",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug" data-testid={`stretch-zone-region-${i}`}>
                          {z.region}
                          <span className="ml-2 align-middle text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                            {z.primary ? "Primary" : "Secondary"}
                          </span>
                        </p>
                        <p className="text-[11px] leading-tight text-muted-foreground">{z.sensation}</p>
                      </div>
                    </div>
                    <div
                      className="mt-1 flex shrink-0 items-center gap-1"
                      title={`Intensity: ${z.intensity}`}
                      aria-label={`Intensity: ${z.intensity}`}
                    >
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className={cn("h-2 w-2 rounded-full", d < filled ? dotColor : "bg-muted")}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <PersonalNotes slug={asana.slug} />

      {related.length > 0 && (
        <section className="space-y-2" aria-labelledby="related-poses-heading">
          <h2 id="related-poses-heading" className="font-serif text-base">
            Related poses
          </h2>
          <ScrollRow label={`More ${asana.category} poses`} testId="related-poses">
            {related.map((rel) => (
              <Link
                key={rel.slug}
                href={`/asanas/${rel.slug}`}
                className="w-16 shrink-0 snap-start"
                data-testid={`related-pose-${rel.slug}`}
              >
                <PoseImage
                  slug={rel.slug}
                  thumb
                  breath={false}
                  shadow={false}
                  rounded="rounded-xl"
                  fit="cover"
                  aspect="aspect-[4/3]"
                  sizes="64px"
                />
                <span className="mt-1 line-clamp-2 text-xs leading-snug">{rel.english}</span>
              </Link>
            ))}
          </ScrollRow>
        </section>
      )}

      {/*
        Mobile sticky practice actions — stays above bottom nav, and stays out
        of the way entirely during a lesson. A competing "Practice now" button
        under an active lesson is a second primary action for the same intent.
      */}
      <div
        className={cn(
          "fixed inset-x-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden",
          training && "hidden",
        )}
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
        data-testid="sticky-practice-actions"
      >
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button
            size="lg"
            onClick={practiceNow}
            className="min-h-12 flex-1 cursor-pointer"
            data-testid="button-practice-now-sticky"
          >
            <Play className="mr-1.5 h-4 w-4" />
            Practice now
          </Button>
          <Button
            onClick={addToday}
            disabled={inToday}
            variant="outline"
            className="min-h-12 cursor-pointer px-3"
            aria-label={inToday ? "Already in today's practice" : "Add to today's practice"}
            data-testid="button-add-today-sticky"
          >
            {inToday ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="h-6 lg:hidden" aria-hidden />
    </article>
  );
}
