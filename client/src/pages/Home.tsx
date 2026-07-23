import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/Heatmap";
import { PoseSvg } from "@/components/PoseSvg";
import { usePractice } from "@/context/PracticeContext";
import {
  asanaBySlug,
  breathBySlug,
  dailyAffirmation,
  breathOfTheDay,
  pathwayBySlug,
  PATHWAYS,
  PROFILE_AFFIRMATION_TAG_MAP,
} from "@/data/content";
import type { Pathway } from "@/data/content";
import { profileById } from "@/data/profiles";
import { resolveIcon } from "@/lib/icons";
import { formatDate, todayISO, type Stats } from "@/lib/sadhana";
import { KEYS, readJson, writeString, readString, type ReminderPrefs } from "@/lib/localPrefs";
import type { UserProfile, Enrollment, FavoriteAsana } from "@shared/schema";
import { QUICK_SESSIONS } from "@/data/quickSessions";
import { EmptyState } from "@/components/EmptyState";
import { ScrollRow } from "@/components/ScrollRow";
import { ResponsiveDetails } from "@/components/ResponsiveDetails";
import { HomeWelcomeHeader } from "@/components/home/HomeWelcomeHeader";
import { Reveal } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  Flame,
  Trophy,
  CalendarCheck,
  Clock,
  Play,
  Volume2,
  X,
  Wind,
  ArrowRight,
  Compass,
  Sparkles,
  Moon,
  CalendarDays,
  Zap,
  Heart,
} from "lucide-react";

const MS_PER_DAY = 86400000;
const SPLITS_SLUG = "sixty-day-splits";

// Three quick flows featured on Home for users who haven't enrolled in a
// program yet — a light, one-tap on-ramp mirroring the Quick Start row.
const FEATURED_FLOW_SLUGS = ["feel-good-reset", "sleep-wind-down", "morning-wake-up", "desk-break"];

function StatCard({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: any;
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-serif text-2xl leading-none" data-testid={testId}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  useDocumentTitle("Home · Sadhana");
  const [, navigate] = useLocation();
  const { todays, remove, loadSession, progress } = usePractice();
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [splitsBannerDismissed, setSplitsBannerDismissed] = useState(false);
  const showResume =
    todays.length > 0 &&
    !!progress?.started &&
    (progress.mode === "guided" || progress.mode === "practice");
  const {
    data: stats,
    isLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<Stats>({ queryKey: ["/api/sessions/stats", todayISO()] });
  const { data: activeProfileRow } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile/active"],
  });
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });
  const { data: favoriteAsanas = [] } = useQuery<FavoriteAsana[]>({
    queryKey: ["/api/favorites/asanas"],
  });
  const breath = breathOfTheDay();
  const reminderPrefs = readJson<ReminderPrefs>(KEYS.reminder, {
    enabled: true,
    hour: 18,
    notifications: false,
  });

  const profile = profileById(activeProfileRow?.profileId);
  const affirmation = dailyAffirmation(new Date(), profile?.recommendedAffirmationsTag);
  const profileAffirmationTheme = profile?.recommendedAffirmationsTag
    ? PROFILE_AFFIRMATION_TAG_MAP[profile.recommendedAffirmationsTag]
    : undefined;
  const recommendedAsanas = profile
    ? profile.recommendedAsanas.map((s) => asanaBySlug(s)).filter(Boolean)
    : [];
  const recommendedBreath = profile
    ? profile.recommendedBreathing.map((s) => breathBySlug(s)).filter(Boolean)
    : [];

  const readAloud = () => {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(affirmation);
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  };

  // Load the active profile's recommended asanas into today's practice and go.
  const startProfileSession = () => {
    loadSession(
      recommendedAsanas.filter(Boolean).map((a) => ({ asana: a! })),
      { label: profile ? `${profile.name} session` : "Profile session" },
    );
    navigate("/guided");
  };

  // Launch a Quick Start mood-based session into the Practice timer.
  const startQuickSession = (q: (typeof QUICK_SESSIONS)[number]) => {
    const poses = q.poses
      .map((p) => {
        const asana = asanaBySlug(p.slug);
        return asana ? { asana, holdSeconds: p.holdSeconds } : null;
      })
      .filter((x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } => x != null);
    loadSession(poses, { label: `${q.time} · ${q.label}`, breathSlug: q.breathSlug ?? null });
    navigate("/guided");
  };

  const scrollToQuickStart = () => {
    document.getElementById("quick-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- 60-Day Full Splits Program awareness (v3.5) ----
  const splitsEnrollment = enrollments.find(
    (e) => e.pathwaySlug === SPLITS_SLUG && e.active,
  );
  const splitsPathway = pathwayBySlug(SPLITS_SLUG);
  const splitsCurrentDay = splitsEnrollment
    ? Math.min(
        60,
        Math.floor(
          (Date.now() -
            new Date(splitsEnrollment.startDate.slice(0, 10) + "T00:00:00").getTime()) /
            MS_PER_DAY,
        ) + 1,
      )
    : 0;
  const splitsToday =
    splitsEnrollment && splitsPathway?.dailyPlan
      ? splitsPathway.dailyPlan.find((d) => d.day === splitsCurrentDay)
      : undefined;

  const startSplitsDay = () => {
    if (!splitsToday || !splitsPathway) return;
    const poses = splitsToday.poses
      .map((p) => {
        const asana = asanaBySlug(p.asanaSlug);
        return asana ? { asana, holdSeconds: p.holdSeconds, sides: p.sides } : null;
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
          x != null,
      );
    loadSession(poses, {
      label: `${splitsPathway.name} — Day ${splitsToday.day}`,
      pathwaySlug: splitsPathway.slug,
    });
    navigate("/guided");
  };

  // Launch a quick flow straight into the guided session (no detail page).
  // A "each side" note flags a bilateral hold so guided mode re-narrates side 2.
  const startFlow = (p: Pathway) => {
    const week = p.weekPlan[0];
    if (!week) return;
    const poses = week.poses
      .map((pose) => {
        const asana = asanaBySlug(pose.asanaSlug);
        if (!asana) return null;
        const sides: "once" | "each" = /each side/i.test(pose.note ?? "") ? "each" : "once";
        return { asana, holdSeconds: pose.holdSeconds, sides };
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
          x != null,
      );
    if (!poses.length) return;
    loadSession(poses, { label: p.name, pathwaySlug: p.slug });
    navigate("/guided");
  };

  // Show the Quick Flows on-ramp only when the user has no active enrollment.
  const hasAnyEnrollment = enrollments.some((e) => e.active);
  const featuredFlows = FEATURED_FLOW_SLUGS.map((s) => PATHWAYS.find((p) => p.slug === s)).filter(
    (p): p is Pathway => !!p,
  );

  const hasPracticed = stats && stats.totalSessions > 0;
  const ProfileIcon = profile ? resolveIcon(profile.icon) : Compass;

  // Daily reminder banner: show if not practiced today AND it's past 6 PM local.
  const practicedToday = (() => {
    const today = todayISO();
    const todayEntry = stats?.heatmap?.find((h) => h.date === today);
    return !!todayEntry && todayEntry.minutes > 0;
  })();
  const pastReminderHour = new Date().getHours() >= (reminderPrefs.hour ?? 18);
  const reminderDismissedToday = readString(KEYS.reminderDismissedDay) === todayISO();
  const showReminder =
    reminderPrefs.enabled &&
    !reminderDismissed &&
    !reminderDismissedToday &&
    !practicedToday &&
    pastReminderHour &&
    !isLoading;

  // Optional browser notification when the tab is open past the reminder hour.
  useEffect(() => {
    if (!showReminder || !reminderPrefs.notifications) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      new Notification("Time for Sadhana", {
        body: "A few mindful minutes will meet you where you are.",
        tag: `sadhana-reminder-${todayISO()}`,
      });
    } catch {
      /* ignore */
    }
  }, [showReminder, reminderPrefs.notifications]);

  return (
    <div className="space-y-10">
      <HomeWelcomeHeader
        dateLabel={formatDate(todayISO())}
        title={profile ? `Welcome back to your ${profile.name} practice` : "Welcome to your practice"}
      />

      <Reveal className="space-y-4" aria-labelledby="primary-practice-heading">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          <h2 id="primary-practice-heading" className="font-serif text-xl">
            Practice now
          </h2>
        </div>

      {/* Resume an in-progress session after refresh / navigation away */}
      {showResume && (
        <Card className="surface-banner border-primary/30" data-testid="banner-resume">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-serif text-lg leading-tight">Continue your practice?</p>
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

      {/* Daily reminder banner (v3.4) — evening nudge, dismissable for the session */}
      {showReminder && (
        <Card
          className="surface-banner-soft"
          data-testid="banner-reminder"
        >
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/25 text-secondary">
                <Moon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-serif text-lg leading-tight">
                  Five minutes of practice before sleep?
                </p>
                <p className="text-sm text-muted-foreground">
                  Even just Child's Pose counts. Your body will thank you.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button className="min-h-11 cursor-pointer" onClick={scrollToQuickStart} data-testid="button-reminder-begin">
                Start a mood session
              </Button>
              <button
                onClick={() => {
                  setReminderDismissed(true);
                  writeString(KEYS.reminderDismissedDay, todayISO());
                }}
                className="min-h-11 min-w-11 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Dismiss reminder"
                data-testid="button-dismiss-reminder"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No-profile prompt */}
      {!profile && (
        <EmptyState
          variant="profile"
          title="Pick a path that fits your life"
          description="Busy mom, better sleep, splits, desk relief, men, women, pregnancy — tailor practice in one tap."
          testId="banner-pick-path"
        >
          <Button asChild className="min-h-11 cursor-pointer" data-testid="button-go-profiles">
            <Link href="/profiles">
              Choose a path <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </EmptyState>
      )}

      {/* Soft acknowledgment when today's practice is already done */}
      {practicedToday && !showReminder && (
        <Card className="surface-banner-soft" data-testid="banner-practiced-today">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-serif text-lg leading-tight">You've practiced today</p>
              <p className="text-sm text-muted-foreground">
                Rest is part of the practice — or take a few quiet breaths if you like.
              </p>
            </div>
            <Button asChild variant="outline" className="min-h-11 cursor-pointer" data-testid="button-practiced-breath">
              <Link href="/breathing">
                <Wind className="mr-1.5 h-4 w-4" /> Breath of the day
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's guided session from profile or enrolled splits program */}
      {splitsEnrollment && splitsToday ? (
        <Card className="surface-banner border-primary/30" data-testid="card-splits-today">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <CalendarDays className="h-5 w-5 text-primary" /> Day {splitsCurrentDay} of 60 ·{" "}
                {splitsToday.theme}
              </CardTitle>
              <div className="flex gap-1.5">
                <Badge variant="outline" className="gap-1 tabular-nums">
                  <Clock className="h-3 w-3" /> ~{splitsToday.totalMinutes} min
                </Badge>
                <Badge variant="outline">
                  {splitsToday.restDay
                    ? "Rest day"
                    : splitsToday.focus === "both"
                      ? "Splits + backbend"
                      : "Front splits"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {splitsToday.restDay
                ? "Rest day — let your body rebuild. An optional gentle recovery is available."
                : `${splitsPathway?.name} · ${splitsToday.poses.length} poses queued for today.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="min-h-11 flex-1 cursor-pointer sm:flex-none"
                onClick={startSplitsDay}
                data-testid="button-start-splits-today"
              >
                <Play className="mr-1.5 h-4 w-4" />{" "}
                {splitsToday.restDay ? "Start optional recovery" : "Start today's session"}
              </Button>
              <Button variant="outline" className="min-h-11 cursor-pointer" asChild data-testid="link-splits-pathway">
                <Link href={`/pathways/${SPLITS_SLUG}`}>View journey</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : profile ? (
        <Card className="surface-banner border-primary/25" data-testid="card-profile-session">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <ProfileIcon className="h-5 w-5 text-primary" /> Your {profile.name} session today
              </CardTitle>
              <div className="flex gap-1.5">
                <Badge variant="outline" className="tabular-nums">
                  {profile.minutesPerSession} min
                </Badge>
                <Badge variant="outline">
                  {profile.daysPerWeek === 7 ? "daily" : `${profile.daysPerWeek}x / wk`}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{profile.tagline}</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="list-profile-asanas">
              {recommendedAsanas.map(
                (a) =>
                  a && (
                    <li key={a.slug}>
                      <Link href={`/asanas/${a.slug}`}>
                        <div
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background p-2 transition-shadow hover:shadow-soft hover-elevate"
                          data-testid={`profile-asana-${a.slug}`}
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}poses/${a.slug}.png`}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                            draggable={false}
                          />
                          <span className="text-xs leading-tight">{a.english}</span>
                        </div>
                      </Link>
                    </li>
                  ),
              )}
            </ul>
            {recommendedBreath.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Breath
                </span>
                {recommendedBreath.map(
                  (b) =>
                    b && (
                      <Link key={b.slug} href="/breathing">
                        <Badge variant="outline" className="cursor-pointer gap-1 hover-elevate">
                          <Wind className="h-3 w-3 text-secondary" /> {b.name}
                        </Badge>
                      </Link>
                    ),
                )}
              </div>
            )}
            <Button
              className="min-h-11 w-full cursor-pointer"
              onClick={startProfileSession}
              disabled={recommendedAsanas.length === 0}
              data-testid="button-start-today-session"
            >
              <Play className="mr-1.5 h-4 w-4" /> Start today's session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-banner border-primary/25" data-testid="card-trainer-cta">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-serif text-xl">Build a session for right now</p>
              <p className="text-sm text-muted-foreground">
                Yoga Trainer asks how your body feels and composes a guided practice.
              </p>
            </div>
            <Button asChild className="min-h-11 cursor-pointer" data-testid="button-home-trainer">
              <Link href="/trainer">Open Yoga Trainer</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      </Reveal>

      {/* Favorited poses — one-tap practice */}
      {favoriteAsanas.length > 0 ? (
        <section className="space-y-3" data-testid="section-favorite-poses">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 fill-primary text-primary" />
              <h2 className="font-serif text-xl">Your poses</h2>
            </div>
            <Button
              size="sm"
              className="min-h-11 cursor-pointer"
              onClick={() => {
                const poses = favoriteAsanas
                  .map((f) => {
                    const asana = asanaBySlug(f.slug);
                    return asana ? { asana } : null;
                  })
                  .filter(
                    (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>> } => x != null,
                  );
                if (!poses.length) return;
                loadSession(poses, { label: "Favorite poses" });
                navigate("/guided");
              }}
              data-testid="button-practice-favorites"
            >
              <Play className="mr-1.5 h-4 w-4" /> Practice all favorites
            </Button>
          </div>
          <ScrollRow label="Favorite poses" testId="scroll-favorite-poses">
            {favoriteAsanas.slice(0, 12).map((f) => {
              const a = asanaBySlug(f.slug);
              if (!a) return null;
              return (
                <button
                  key={f.slug}
                  type="button"
                  className="flex w-36 shrink-0 snap-start cursor-pointer flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center shadow-soft hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    loadSession([{ asana: a }], { label: a.english });
                    navigate("/guided");
                  }}
                  data-testid={`favorite-pose-${f.slug}`}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}poses/${f.slug}.png`}
                    alt=""
                    className="h-20 w-20 rounded-md object-cover"
                    loading="lazy"
                  />
                  <span className="text-xs font-medium leading-tight">{a.english}</span>
                </button>
              );
            })}
          </ScrollRow>
        </section>
      ) : (
        !isLoading &&
        !hasPracticed && (
          <EmptyState
            variant="firstSession"
            title="Your first session is waiting"
            description="Start with Yoga Trainer or a mood session — favorites will appear here after you heart a pose."
            testId="empty-home-first-session"
          >
            <Button asChild className="min-h-11 cursor-pointer">
              <Link href="/trainer">Open Yoga Trainer</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 cursor-pointer">
              <Link href="/asanas">Browse the library</Link>
            </Button>
          </EmptyState>
        )
      )}

      <section className="space-y-6" aria-labelledby="more-ways-heading">
        <div className="space-y-1">
          <h2 id="more-ways-heading" className="font-serif text-xl">
            More ways to practice
          </h2>
          <p className="text-sm text-muted-foreground">
            Mood sessions are short and feeling-based. Sequences are curated flows you can open anytime.
          </p>
        </div>

      {profile && (
        <Card className="surface-inset" data-testid="card-trainer-secondary">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-serif text-lg">Need something different today?</p>
              <p className="text-sm text-muted-foreground">
                Skip your path session and build from how your body feels.
              </p>
            </div>
            <Button asChild variant="outline" className="min-h-11 cursor-pointer" data-testid="button-home-trainer">
              <Link href="/trainer">Open Yoga Trainer</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Start — mood-based sessions (v3.4) */}
      <section id="quick-start" className="space-y-3" data-testid="section-quick-start">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg">Mood sessions</h3>
          <span className="text-sm text-muted-foreground">— how you feel right now</span>
        </div>
        <ScrollRow label="Mood sessions" testId="scroll-mood-sessions">
          {QUICK_SESSIONS.map((q) => {
            const QIcon = q.icon;
            return (
              <Card
                key={q.id}
                className="flex w-56 shrink-0 snap-start flex-col border-border shadow-soft"
                data-testid={`quick-session-${q.id}`}
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <QIcon className="h-5 w-5" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-serif text-lg leading-tight">{q.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.time} · {q.intent}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-auto min-h-11 w-full cursor-pointer"
                    onClick={() => startQuickSession(q)}
                    data-testid={`button-begin-quick-${q.id}`}
                  >
                    <Play className="mr-1.5 h-4 w-4" /> Start mood session
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </ScrollRow>
      </section>

      {/* Quick Flows on-ramp (v5) — only for users not enrolled in any program */}
      {!hasAnyEnrollment && featuredFlows.length > 0 && (
        <section id="quick-flows" className="space-y-3" data-testid="section-quick-flows">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="font-serif text-lg">Curated sequences</h3>
            <span className="text-sm text-muted-foreground">— short flows</span>
            <Link
              href="/pathways"
              className="ml-auto text-sm text-primary hover:underline"
              data-testid="link-all-flows"
            >
              See all
            </Link>
          </div>
          <ScrollRow label="Curated sequences" testId="scroll-quick-flows">
            {featuredFlows.map((p) => (
              <Card
                key={p.slug}
                className="flex w-56 shrink-0 snap-start flex-col border-border shadow-soft"
                data-testid={`quick-flow-${p.slug}`}
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-serif text-lg leading-tight">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.minutesPerSession ?? p.timePerSession} min · {p.weekPlan[0]?.poses.length ?? 0} poses
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto min-h-11 w-full cursor-pointer"
                    onClick={() => startFlow(p)}
                    data-testid={`button-start-flow-${p.slug}`}
                  >
                    <Play className="mr-1.5 h-4 w-4" /> Open sequence
                  </Button>
                </CardContent>
              </Card>
            ))}
          </ScrollRow>
        </section>
      )}
      </section>

      <ResponsiveDetails
        title="Your progress"
        description="Streaks, session totals, and consistency when you want them."
        summaryId="progress-heading"
        testId="section-progress"
      >
      {/* Stats — after the practice loop so zeros don't bury the start CTA */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : statsError ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-soft" data-testid="banner-stats-error">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load your practice stats. Check your connection and try again.
            </p>
            <Button variant="outline" className="min-h-11 cursor-pointer" onClick={() => refetchStats()} data-testid="button-retry-stats">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Flame} label="Current streak (days)" value={stats?.currentStreak ?? 0} testId="stat-current-streak" />
          <StatCard icon={Trophy} label="Longest streak (days)" value={stats?.longestStreak ?? 0} testId="stat-longest-streak" />
          <StatCard icon={CalendarCheck} label="Total sessions" value={stats?.totalSessions ?? 0} testId="stat-total-sessions" />
          <StatCard icon={Clock} label="Minutes practiced" value={stats?.totalMinutes ?? 0} testId="stat-total-minutes" />
        </div>
      )}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Practice consistency — last 12 weeks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap data={stats?.heatmap ?? []} />
          {!hasPracticed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Complete a session to start filling in your practice map.
            </p>
          )}
        </CardContent>
      </Card>
      </ResponsiveDetails>

      {/* 60-Day Splits discovery banner (v3.5) — shown when NOT enrolled */}
      {!splitsEnrollment && !splitsBannerDismissed && (
        <Card
          className="surface-banner border-primary/30"
          data-testid="banner-splits-discover"
        >
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="font-serif text-lg leading-tight">
                  Discover the 60-Day Splits Program
                </p>
                <p className="text-sm text-muted-foreground">
                  A gentle, day-by-day journey to your front splits — one short session at a time.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild className="min-h-11 cursor-pointer" data-testid="button-splits-start-journey">
                <Link href={`/pathways/${SPLITS_SLUG}`}>
                  Explore program <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <button
                onClick={() => setSplitsBannerDismissed(true)}
                className="min-h-11 min-w-11 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
                data-testid="button-dismiss-splits-banner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <ResponsiveDetails
        title="Nourish"
        description="Affirmation, custom practice queue, and breath of the day."
        summaryId="nourish-heading"
        testId="section-nourish"
      >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily affirmation */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's affirmation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-serif text-xl leading-snug" data-testid="text-daily-affirmation">
              "{affirmation}"
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="min-h-11 cursor-pointer" onClick={readAloud} data-testid="button-read-affirmation">
                <Volume2 className="mr-1.5 h-4 w-4" /> Read aloud
              </Button>
              <Button variant="ghost" size="sm" className="min-h-11 cursor-pointer" asChild data-testid="link-more-affirmations">
                <Link
                  href={
                    profileAffirmationTheme
                      ? `/affirmations?theme=${profileAffirmationTheme}`
                      : "/affirmations"
                  }
                >
                  More affirmations
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's hand-picked practice (manual additions) */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your custom practice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todays.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Build your own session — add any poses from the library to practice them in any order.
                </p>
                <Button asChild variant="outline" className="min-h-11 w-full cursor-pointer" data-testid="button-add-custom-poses">
                  <Link href="/asanas">
                    Add poses from library <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <ul className="space-y-2" data-testid="list-todays-practice">
                  {todays.map((a) => (
                    <li
                      key={a.slug}
                      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                      data-testid={`todays-item-${a.slug}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-primary">
                          <PoseSvg pose={a.pose} size={28} />
                        </span>
                        {a.english}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(a.slug)}
                        className="min-h-11 min-w-11 cursor-pointer text-muted-foreground hover:text-destructive"
                        data-testid={`button-remove-${a.slug}`}
                        aria-label={`Remove ${a.english}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  className="min-h-11 w-full cursor-pointer"
                  onClick={() => navigate("/guided")}
                  data-testid="button-start-practice"
                >
                  <Play className="mr-1.5 h-4 w-4" /> Start custom practice
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breath of the day */}
      <Card className="shadow-soft" data-testid="card-breath-of-the-day">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Breath of the day</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/breathing" aria-label={`Breath of the day: ${breath.name}`}>
            <div className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-accent/40 p-4 transition-shadow hover:shadow-soft hover-elevate">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
                  <Wind className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-serif text-lg leading-tight" data-testid="text-breath-of-the-day">
                    {breath.name}
                    <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                      {breath.pattern}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{breath.tagline}</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </div>
          </Link>
        </CardContent>
      </Card>
      </ResponsiveDetails>
    </div>
  );
}
