/**
 * Today — one decision, then the things that support it.
 *
 * What this page used to be: a directory. Mood sessions, curated sequences, the
 * Trainer, the Adaptive Plan, a profile card, a splits banner, affirmations,
 * breath of the day and a twenty-link shortcut grid, all weighted the same, all
 * under a header that said "One clear next step below" while showing nine.
 *
 * The order here is deliberate and it is the whole design:
 *
 *   1. Today's practice     — one card, one Start, truthful about what it is
 *   2. Quick adjustments    — time, gentler, focus (on that card)
 *   3. Continue             — an unfinished session or the program you joined
 *   4. This week            — four numbers, compact
 *   5. Three alternatives   — genuinely different, not a shelf
 *   6. One thing to learn   — a single pose or breath, not a reading list
 *   7. Where your data is   — quiet, one card, no duplicate nags
 *
 * Comprehensive discovery moved to Practice (`ExploreDirectory`).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/Heatmap";
import { usePractice } from "@/context/PracticeContext";
import {
  asanaBySlug,
  breathBySlug,
  breathOfTheDay,
  pathwayBySlug,
  WARMUP,
} from "@/data/content";
import type { Pathway } from "@/data/content";
import { profileById } from "@/data/profiles";
import { formatDate, todayISO, type Stats } from "@/lib/sadhana";
import { homeProgressTiles, weeklyProgress } from "@shared/practiceStats";
import { KEYS, readJson, readString, type ReminderPrefs } from "@/lib/localPrefs";
import {
  readPracticePreferences,
  writePracticePreferences,
} from "@/lib/practicePreferences";
import { readQuizPlan } from "@/data/quizPlan";
import { readHabitPlan } from "@/lib/habitPlan";
import type { UserProfile, Enrollment, Journal, Session } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { catalogSessionMinutes, warmupSessionMinutes } from "@/lib/pathwayTiming";
import {
  adjustedPractice,
  alternativePractices,
  recommendPractice,
  type HomeContext,
  type PracticeRecommendation,
} from "@/lib/homeRecommendation";
import { buildSessionPreflight } from "@/lib/sessionPreflight";
import { HomeWelcomeHeader } from "@/components/home/HomeWelcomeHeader";
import {
  TodayPracticeCard,
  TodayPracticeCardSkeleton,
} from "@/components/home/TodayPracticeCard";
import { SavePracticeBanner } from "@/components/SavePracticePrompt";
import { CancelAccessBanner } from "@/components/CancelAccessBanner";
import { dismissBanner, savePromptLevel, shouldShowSaveBanner } from "@/lib/savePracticePrompt";
import { Reveal } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  ArrowRight,
  CalendarDays,
  CloudDownload,
  NotebookPen,
  Play,
  Sparkles,
  UserRound,
  Wind,
} from "lucide-react";

const MS_PER_DAY = 86400000;

/** Tap 1 of cancel — always one hop from Home to the confirmation screen. */
function HomeCancelSubscriptionCta() {
  const { data } = useQuery<{
    plan: string;
    cancelAtPeriodEnd?: boolean;
    status?: string;
  }>({
    queryKey: ["/api/billing/entitlement"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const paid =
    data &&
    data.plan !== "free" &&
    data.status !== "refunded" &&
    (data.status === "active" || data.status === "trialing" || data.cancelAtPeriodEnd);
  if (!paid) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
      data-testid="home-cancel-cta"
    >
      <p className="text-sm text-muted-foreground">
        {data.cancelAtPeriodEnd
          ? "Subscription canceled — review your access end date."
          : "Need to leave? Cancel in one more tap. No chat, phone, or retention screen."}
      </p>
      <Button asChild variant="outline" className="min-h-11 shrink-0" data-testid="button-home-cancel">
        <Link href="/cancel/confirm">
          {data.cancelAtPeriodEnd ? "Cancellation details" : "Cancel subscription"}
        </Link>
      </Button>
    </div>
  );
}

export default function Home() {
  useDocumentTitle("Today · Sadhana");
  const [, navigate] = useLocation();
  const { todays, loadSession, progress } = usePractice();
  const { user, isSignedIn } = useAuth();

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<Stats>({ queryKey: ["/api/sessions/stats", todayISO()] });
  const { data: activeProfileRow, isLoading: profileLoading } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile/active"],
  });
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments"],
  });
  const { data: journalEntries = [] } = useQuery<Journal[]>({ queryKey: ["/api/journal"] });
  // "This week" needs the sessions themselves: the stats endpoint returns
  // lifetime totals and an 84-day heatmap, neither of which is a week.
  const {
    data: sessionRows = [],
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } = useQuery<Session[]>({ queryKey: ["/api/sessions"] });

  /**
   * Everything the recommendation depends on has to be in hand before we can
   * name a practice. Rendering a newcomer card for half a second and then
   * replacing it with someone's program is worse than a skeleton.
   */
  const bootstrapping =
    statsLoading || profileLoading || enrollmentsLoading || sessionsLoading;

  const [savePromptDismissed, setSavePromptDismissed] = useState(false);
  /** Overrides from the card's "Change time" / "Change focus" controls. */
  const [adjust, setAdjust] = useState<{ minutes: number | null; need: string | null }>(() => {
    const saved = readPracticePreferences();
    return { minutes: saved.minutes, need: saved.need };
  });

  const profile = profileById(activeProfileRow?.profileId) ?? null;
  const practitionerName = readString(KEYS.practitionerName)?.trim() || null;
  const quizPlan = readQuizPlan();
  const habitPlan = readHabitPlan();
  const reminderPrefs = readJson<ReminderPrefs>(KEYS.reminder, {
    enabled: true,
    hour: 18,
    notifications: false,
  });
  // Goal, ability, time and focus come from one store, so a length chosen in
  // the Trainer is the length Today opens with, and vice versa.
  const prefs = readPracticePreferences();
  const { intent, experience } = prefs;
  const breath = breathOfTheDay();

  const hasPracticed = !!stats && stats.totalSessions > 0;
  const showResume =
    todays.length > 0 &&
    !!progress?.started &&
    (progress.mode === "guided" || progress.mode === "practice");

  const activeEnrollments = useMemo(
    () =>
      enrollments
        .filter((e) => e.active)
        .map((e) => ({ enrollment: e, pathway: pathwayBySlug(e.pathwaySlug) }))
        .filter((x): x is { enrollment: Enrollment; pathway: Pathway } => !!x.pathway),
    [enrollments],
  );

  /** Today's day of the first active day-by-day program, when there is one. */
  const programDay = useMemo(() => {
    for (const { enrollment, pathway } of activeEnrollments) {
      if (!pathway.dailyPlan?.length) continue;
      const started = new Date(enrollment.startDate.slice(0, 10) + "T00:00:00").getTime();
      const dayNumber = Math.min(
        pathway.dailyPlan.length,
        Math.floor((Date.now() - started) / MS_PER_DAY) + 1,
      );
      const day = pathway.dailyPlan.find((d) => d.day === dayNumber);
      if (!day) continue;
      const poses = day.poses
        .map((p) => {
          const asana = asanaBySlug(p.asanaSlug);
          return asana
            ? {
                slug: asana.slug,
                holdSeconds: p.holdSeconds,
                sides: (p.sides === "each" ? "each" : "once") as "each" | "once",
              }
            : null;
        })
        .filter((x): x is { slug: string; holdSeconds: number; sides: "each" | "once" } => !!x);
      if (!poses.length) continue;
      return {
        pathwaySlug: pathway.slug,
        pathwayName: pathway.name,
        day: dayNumber,
        theme: day.theme,
        poses,
        minutes: catalogSessionMinutes(day.poses),
      };
    }
    return null;
  }, [activeEnrollments]);

  const warmupPoses = useMemo(
    () =>
      WARMUP.steps
        .map((s) => {
          const asana = asanaBySlug(s.asanaSlug);
          return asana
            ? { slug: asana.slug, holdSeconds: s.holdSeconds, sides: s.sides ?? "once" }
            : null;
        })
        .filter((x): x is { slug: string; holdSeconds: number; sides: "once" | "each" } => !!x),
    [],
  );

  const context: HomeContext = {
    programDay,
    quizPlan,
    profile,
    intent,
    experience,
    hour: new Date().getHours(),
    preferredMinutes: adjust.minutes ?? prefs.minutes,
    preferredNeed: adjust.need ?? prefs.need,
    hasPracticed,
    warmup: { title: WARMUP.title, poses: warmupPoses },
  };

  const recommendation: PracticeRecommendation | null = useMemo(() => {
    if (bootstrapping) return null;
    // An explicit adjustment replaces the recommendation with exactly what was
    // asked for. Treating it as a hint meant tapping "30 min" on a first visit
    // changed nothing at all — the warm-up branch won either way.
    if (adjust.need || adjust.minutes) return adjustedPractice(context, adjust);
    return recommendPractice(context);
    // `context` is rebuilt every render (it carries the clock), so the inputs
    // that can actually change the answer are listed instead of the object.
  }, [bootstrapping, adjust.need, adjust.minutes, programDay, quizPlan?.title, profile?.id, intent, experience, hasPracticed]);

  const alternatives = useMemo(
    () => (bootstrapping ? [] : alternativePractices(context, recommendation)),
    // Same reason as above: composing three sequences on every render would be
    // wasteful, and only these inputs change what they are.
    [bootstrapping, recommendation?.id, adjust.minutes, adjust.need, intent],
  );

  const startRecommendation = (
    rec: PracticeRecommendation,
    instructionMode?: "guided" | "brief" | "timer",
  ) => {
    const poses = rec.poses
      .map((p) => {
        const asana = asanaBySlug(p.slug);
        return asana
          ? { asana, holdSeconds: p.holdSeconds, ...(p.sides ? { sides: p.sides } : {}) }
          : null;
      })
      .filter(
        (x): x is {
          asana: NonNullable<ReturnType<typeof asanaBySlug>>;
          holdSeconds: number;
          sides?: "once" | "each";
        } => x != null,
      );
    if (!poses.length) return;
    const preflightPoses = poses.map((p) => ({
      ...p.asana,
      holdSeconds: p.holdSeconds,
      sides: p.sides,
    }));
    loadSession(poses, {
      label: rec.meta.label,
      pathwaySlug: rec.meta.pathwaySlug ?? null,
      breathSlug: rec.meta.breathSlug ?? null,
      introPoseSlug: rec.meta.introPoseSlug ?? null,
      preMood: rec.meta.preMood ?? null,
      // The length the player will run, not the length that was asked for.
      plannedMinutes: buildSessionPreflight({
        poses: preflightPoses,
        mode: instructionMode ?? "guided",
      }).minutes,
      ...(instructionMode ? { instructionMode } : {}),
    });
    navigate("/guided");
  };

  const todayEntry = stats?.heatmap?.find((h) => h.date === todayISO());
  const todayMinutes = todayEntry?.minutes ?? 0;
  const practicedToday = todayMinutes > 0;

  const savePrompt = savePromptDismissed
    ? "none"
    : savePromptLevel({ isSignedIn, totalSessions: stats?.totalSessions ?? 0 });
  const showSaveBanner = shouldShowSaveBanner({
    level: savePrompt,
    totalSessions: stats?.totalSessions ?? 0,
    daysPracticed: stats?.daysPracticed ?? 0,
  });

  const progressTiles = stats
    ? homeProgressTiles(stats, { compassionateRecovery: habitPlan.compassionateRecovery })
    : null;

  /**
   * The current week, in this browser's timezone. `todayISO()` is already the
   * local calendar date, and session rows carry local dates, so the comparison
   * never crosses a UTC boundary.
   */
  const thisWeek = useMemo(
    () =>
      weeklyProgress(
        sessionRows.map((row) => ({
          date: row.date,
          durationMinutes: row.durationMinutes,
          kind: (row.kind as "asana" | "breathing" | undefined) ?? "asana",
        })),
        todayISO(),
      ),
    [sessionRows],
  );

  const recentJournal = journalEntries.slice(0, 1);
  const learnPose = useMemo(() => {
    const slug = recommendation?.poses[Math.floor(recommendation.poses.length / 2)]?.slug;
    return slug ? asanaBySlug(slug) : null;
  }, [recommendation]);

  return (
    <div className="space-y-10">
      <HomeWelcomeHeader
        dateLabel={formatDate(todayISO())}
        hasCompletedSessions={hasPracticed}
        displayName={practitionerName}
        practicedToday={practicedToday}
        reminderHour={reminderPrefs.hour ?? 18}
        loading={bootstrapping}
      />

      <CancelAccessBanner />
      <HomeCancelSubscriptionCta />

      {/* ── 1 + 2. Today's practice, and the ways to adjust it ───────────── */}
      <Reveal className="space-y-4" aria-labelledby="primary-practice-heading">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          <h2 id="primary-practice-heading" className="font-serif text-xl">
            {practicedToday ? "Practise again" : "Today's practice"}
          </h2>
        </div>

        {/*
          A day that is already done gets an acknowledgement, a way to reflect
          on it, and one next step — not a second identical Start button
          pretending nothing happened.
        */}
        {!bootstrapping && practicedToday && (
          <Card className="surface-banner-soft" data-testid="banner-practiced-today">
            <CardContent className="flex flex-col gap-3 p-5">
              <div>
                <p className="font-serif text-lg leading-tight">You practised today</p>
                <p className="text-sm text-muted-foreground">
                  {todayMinutes > 0
                    ? `${todayMinutes} ${todayMinutes === 1 ? "minute" : "minutes"} logged. Rest is part of the practice.`
                    : "Rest is part of the practice."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 cursor-pointer"
                  data-testid="button-practiced-reflect"
                >
                  <Link href="/journal">
                    <NotebookPen className="mr-1.5 h-4 w-4" /> Write a reflection
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="min-h-11 cursor-pointer"
                  data-testid="button-practiced-breath"
                >
                  <Link href={`/breathing?slug=${encodeURIComponent(breath.slug)}`}>
                    <Wind className="mr-1.5 h-4 w-4" /> Or a few quiet breaths
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {bootstrapping ? (
          <TodayPracticeCardSkeleton />
        ) : recommendation ? (
          <TodayPracticeCard
            recommendation={recommendation}
            onStart={startRecommendation}
            onChangeMinutes={(minutes) => {
              writePracticePreferences({ minutes });
              setAdjust((a) => ({ ...a, minutes }));
            }}
            onChangeFocus={(need) => {
              writePracticePreferences({ need });
              setAdjust((a) => ({ ...a, need }));
            }}
            currentMinutes={adjust.minutes}
            currentNeed={adjust.need}
          />
        ) : (
          <Card className="surface-banner border-primary/30" data-testid="today-practice-empty">
            <CardContent className="space-y-3 p-5">
              <p className="font-serif text-xl">Let's find you a practice</p>
              <p className="text-sm text-muted-foreground">
                A two-minute quiz builds a plan around your goal, your time and your body.
              </p>
              <Button asChild className="min-h-11" data-testid="button-new-here-quiz">
                <Link href="/start">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Get my plan
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!bootstrapping && !quizPlan && !profile && !programDay && (
          <p className="text-sm text-muted-foreground">
            Want this tailored?{" "}
            <Link href="/start" className="text-primary hover:underline" data-testid="link-take-quiz">
              Take the two-minute quiz
            </Link>{" "}
            or{" "}
            <Link href="/profiles" className="text-primary hover:underline" data-testid="link-pick-path">
              pick a path
            </Link>
            .
          </p>
        )}
      </Reveal>

      {/* ── 3. Continue what's already going ─────────────────────────────── */}
      {(showResume || (programDay && recommendation?.source !== "program")) && (
        <section className="space-y-3" aria-labelledby="continue-heading">
          <h2 id="continue-heading" className="font-serif text-xl">
            Continue
          </h2>
          {showResume && (
            <Card className="surface-banner border-primary/30" data-testid="banner-resume">
              <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="font-serif text-lg leading-tight">An unfinished session</p>
                  <p className="text-sm text-muted-foreground">
                    {todays.length} pose{todays.length === 1 ? "" : "s"} queued
                    {progress?.mode === "guided" ? " (guided)" : ""} — pick up where you left off.
                  </p>
                </div>
                <Button
                  className="min-h-11 cursor-pointer"
                  onClick={() => navigate(progress?.mode === "practice" ? "/practice" : "/guided")}
                  data-testid="button-resume-session"
                >
                  <Play className="mr-1.5 h-4 w-4" /> Resume session
                </Button>
              </CardContent>
            </Card>
          )}
          {programDay && recommendation?.source !== "program" && (
            <Link
              href={`/pathways/${programDay.pathwaySlug}`}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`home-program-${programDay.pathwaySlug}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{programDay.pathwayName}</span>
                <span className="block text-xs text-muted-foreground">
                  Day {programDay.day} · {programDay.minutes} min
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          )}
        </section>
      )}

      {/* ── 4. This week, compactly ──────────────────────────────────────── */}
      <section className="space-y-3" aria-labelledby="progress-heading" data-testid="section-progress">
        <div className="flex items-center justify-between gap-2">
          <h2 id="progress-heading" className="font-serif text-xl">
            This week
          </h2>
          <Link
            href="/journal"
            className="text-sm text-primary hover:underline"
            data-testid="link-all-progress"
          >
            See all progress
          </Link>
        </div>
        {statsError || sessionsError ? (
          <Card className="border-destructive/40 bg-destructive/5 shadow-soft" data-testid="banner-stats-error">
            <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">
                Couldn't load your practice summary. Your practice itself is safe — this is only the
                count.
              </p>
              <Button
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={() => {
                  void refetchStats();
                  void refetchSessions();
                }}
                data-testid="button-retry-stats"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : statsLoading || sessionsLoading || !progressTiles ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !hasPracticed ? (
          <Card className="shadow-soft" data-testid="progress-empty">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Nothing here yet. Your first finished practice starts the count — skipping through
              one deliberately doesn't, so the number stays honest.
            </CardContent>
          </Card>
        ) : (
          <>
            {/*
              Three numbers about THIS week, from sessions dated inside it.
              These tiles used to show lifetime totals under this heading: 8
              days practised and 17 sessions, in a week that has seven days.
            */}
            <div className="grid grid-cols-3 gap-3" data-testid="week-tiles">
              {[
                {
                  testId: "stat-week-days",
                  value: thisWeek.daysPracticed,
                  label: thisWeek.daysPracticed === 1 ? "day this week" : "days this week",
                },
                {
                  testId: "stat-week-sessions",
                  value: thisWeek.sessions,
                  label: thisWeek.sessions === 1 ? "session" : "sessions",
                },
                {
                  testId: "stat-week-minutes",
                  value: thisWeek.minutes,
                  label: thisWeek.minutes === 1 ? "minute" : "minutes",
                },
              ].map((tile) => (
                <Card key={tile.testId} className="shadow-soft">
                  <CardContent className="p-4">
                    <p className="font-serif text-2xl leading-none" data-testid={tile.testId}>
                      {tile.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{tile.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {thisWeek.sessions === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="week-empty">
                Nothing yet this week — the week started {formatDate(thisWeek.weekStart)}.
              </p>
            )}

            {/*
              Lifetime figures and the 84-day map are worth keeping, but they
              are a different question and now say so.
            */}
            <details className="group pt-1" data-testid="all-time-progress">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>All time</span>
                <span className="text-xs text-primary group-open:hidden">Show</span>
                <span className="hidden text-xs text-primary group-open:inline">Hide</span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    progressTiles.daysPracticed,
                    progressTiles.longestStretch,
                    progressTiles.totalSessions,
                    progressTiles.minutesPracticed,
                  ].map((tile) => (
                    <Card key={tile.testId} className="shadow-soft">
                      <CardContent className="p-4">
                        <p className="font-serif text-2xl leading-none" data-testid={tile.testId}>
                          {tile.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{tile.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Practice consistency — last 12 weeks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Heatmap data={stats?.heatmap ?? []} />
                  </CardContent>
                </Card>
              </div>
            </details>
          </>
        )}
        {recentJournal.length > 0 && (
          <Link
            href="/journal"
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
            data-testid={`home-journal-${recentJournal[0]!.id}`}
          >
            <NotebookPen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">
                {formatDate(recentJournal[0]!.date.slice(0, 10))}
                {recentJournal[0]!.mood ? ` · ${recentJournal[0]!.mood}` : ""}
              </span>
              <span className="block truncate text-sm">
                {recentJournal[0]!.title || recentJournal[0]!.body || "Untitled entry"}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </section>

      {/* ── 5. Three alternatives ────────────────────────────────────────── */}
      {alternatives.length > 0 && (
        <section className="space-y-3" aria-labelledby="alternatives-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="alternatives-heading" className="font-serif text-xl">
              Or something else
            </h2>
            <Link
              href="/guided"
              className="text-sm text-primary hover:underline"
              data-testid="link-browse-practice"
            >
              Browse all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {alternatives.map((alt) => (
              <AlternativeCard key={alt.id} alt={alt} onStart={startRecommendation} />
            ))}
          </div>
        </section>
      )}

      {/* ── 6. One thing to learn ────────────────────────────────────────── */}
      {learnPose ? (
        <section className="space-y-3" aria-labelledby="learn-heading">
          <h2 id="learn-heading" className="font-serif text-xl">
            One thing to learn
          </h2>
          <Link
            href={`/asanas/${learnPose.slug}`}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
            data-testid="home-learn-item"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{learnPose.english}</span>
              <span className="block truncate text-xs text-muted-foreground">
                In today's practice · {learnPose.difficulty} · {learnPose.category}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </section>
      ) : (
        <section className="space-y-3" aria-labelledby="learn-heading">
          <h2 id="learn-heading" className="font-serif text-xl">
            One thing to learn
          </h2>
          <Link
            href={`/breathing?slug=${encodeURIComponent(breath.slug)}`}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
            data-testid="home-learn-item"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
              <Wind className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{breath.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {breath.pattern} · {breath.tagline}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </section>
      )}

      {/* ── 7. Where your practice is stored ─────────────────────────────── */}
      {showSaveBanner ? (
        <SavePracticeBanner
          totalSessions={stats?.totalSessions ?? 0}
          currentStreak={stats?.currentStreak ?? 0}
          onDismiss={() => {
            dismissBanner();
            setSavePromptDismissed(true);
          }}
        />
      ) : (
        <Card className="surface-inset" data-testid="home-account">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {isSignedIn ? <UserRound className="h-5 w-5" /> : <CloudDownload className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                {/*
                  This card is about where the data lives. "Keep your practice
                  safe" read as a safety warning about the yoga.
                */}
                <p className="font-serif text-lg leading-tight">
                  {isSignedIn
                    ? `Signed in as ${user?.displayName || user?.email}`
                    : "Your practice is saved on this device only"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isSignedIn
                    ? "Your history, journal and sequences sync to any browser you sign in from."
                    : "Clearing this browser's data would erase your history. A free account backs it up and syncs it."}
                </p>
              </div>
            </div>
            <Button
              asChild
              variant={isSignedIn ? "ghost" : "default"}
              className="min-h-11 shrink-0 cursor-pointer"
              data-testid="home-account-cta"
            >
              <Link href="/account">{isSignedIn ? "Manage account" : "Back up my practice"}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** One of the three alternatives: enough to choose by, nothing more. */
function AlternativeCard({
  alt,
  onStart,
}: {
  alt: PracticeRecommendation;
  onStart: (rec: PracticeRecommendation) => void;
}) {
  const poses = alt.poses
    .map((p) => {
      const a = asanaBySlug(p.slug);
      return a ? { ...a, holdSeconds: p.holdSeconds, sides: p.sides } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const preflight = buildSessionPreflight({ poses });
  return (
    <Card className="flex flex-col border-border shadow-soft" data-testid={`home-alt-${alt.id}`}>
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-serif text-lg leading-tight">{alt.title}</p>
        <p className="text-xs text-muted-foreground">
          {preflight.timeLabel} · {preflight.difficulty.level} · {preflight.intensity.level}
        </p>
        <p className="text-sm text-muted-foreground">{alt.reason}</p>
        {preflight.equipmentSentence && (
          <p className="text-xs text-muted-foreground">Needs {preflight.equipmentSentence}.</p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-auto min-h-11 w-full cursor-pointer"
          onClick={() => onStart(alt)}
          data-testid={`button-start-alt-${alt.id}`}
        >
          <Play className="mr-1.5 h-4 w-4" /> Start {preflight.timeLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
