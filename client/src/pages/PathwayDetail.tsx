import { Link, useParams, useLocation } from "wouter";
import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PoseImage } from "@/components/PoseImage";
import { WarmupCard } from "@/components/WarmupCard";
import { EmptyState } from "@/components/EmptyState";
import { DailyProgram } from "@/components/DailyProgram";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pathwayBySlug, asanaBySlug } from "@/data/content";
import type { PathwayWeek } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import type { Enrollment, Session } from "@shared/schema";
import { todayISO, daysSince } from "@/lib/sadhana";
import { ArrowLeft, CalendarDays, Repeat, Clock, Play, X } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const MS_PER_DAY = 86400000;

/** Week numbers (1-based) that have at least one logged session for this pathway. */
function completedWeeksFromSessions(
  sessions: Session[],
  pathwaySlug: string,
  startDate: string,
  totalWeeks: number,
): Set<number> {
  const done = new Set<number>();
  const start = new Date(startDate.slice(0, 10) + "T00:00:00").getTime();
  for (const s of sessions) {
    if (s.pathwaySlug !== pathwaySlug) continue;
    const t = new Date(s.date.length <= 10 ? s.date + "T00:00:00" : s.date).getTime();
    const dayN = Math.floor((t - start) / MS_PER_DAY) + 1;
    if (dayN < 1) continue;
    const weekN = Math.min(totalWeeks, Math.ceil(dayN / 7));
    done.add(weekN);
  }
  return done;
}

function formatSeconds(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.round(total / 60);
  return `≈ ${m} minute${m === 1 ? "" : "s"}`;
}

export default function PathwayDetail() {
  const { slug } = useParams();
  const pathway = pathwayBySlug(slug || "");
  useDocumentTitle(pathway ? `${pathway.name} · Sadhana` : "Pathway · Sadhana");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });
  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"] });

  const enrollment = enrollments.find((e) => e.pathwaySlug === slug && e.active);

  const enroll = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/enrollments", {
        pathwaySlug: slug,
        startDate: todayISO(),
        active: 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] });
      toast({ title: "Pathway started", description: "Your progress is now being tracked." });
    },
  });

  const unenroll = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/enrollments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments"] });
      toast({ title: "Pathway ended", description: "You can start it again anytime." });
    },
  });

  // Progress is based on logged sessions, not calendar drift.
  const completedWeeks = useMemo(() => {
    if (!enrollment || !pathway) return new Set<number>();
    return completedWeeksFromSessions(
      sessions,
      pathway.slug,
      enrollment.startDate,
      pathway.weeks,
    );
  }, [enrollment, sessions, pathway]);

  if (!pathway) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="Pathway not found">
          <Button asChild><Link href="/pathways">Back to pathways</Link></Button>
        </EmptyState>
      </div>
    );
  }

  const weeksDone = completedWeeks.size;
  const pct = enrollment ? Math.round((weeksDone / pathway.weeks) * 100) : 0;
  // Next week to practice: first incomplete week, else last week.
  let currentWeek = 0;
  if (enrollment) {
    currentWeek = pathway.weeks;
    for (let w = 1; w <= pathway.weeks; w++) {
      if (!completedWeeks.has(w)) {
        currentWeek = w;
        break;
      }
    }
  }
  const calendarWeek = enrollment
    ? Math.min(Math.ceil((daysSince(enrollment.startDate) + 1) / 7), pathway.weeks)
    : 0;
  const behindByWeeks =
    enrollment && calendarWeek > weeksDone ? calendarWeek - weeksDone : 0;

  // Load a week's poses into the practice timer and jump to the timer screen.
  // We override each asana's holdSeconds with the week-specific target.
  const startWeek = (week: PathwayWeek) => {
    const poses = week.poses
      .map((p) => {
        const asana = asanaBySlug(p.asanaSlug);
        return asana ? { asana, holdSeconds: p.holdSeconds } : null;
      })
      .filter((x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } => x != null);
    loadSession(poses, {
      label: `${pathway.name} — Week ${week.weekNumber}`,
      pathwaySlug: pathway.slug,
    });
    toast({
      title: `Week ${week.weekNumber} loaded`,
      description: `${week.theme} — ${week.poses.length} poses queued.`,
    });
    navigate("/guided");
  };

  const startWeekOne = () => {
    const wk = pathway.weekPlan[0];
    if (wk) startWeek(wk);
  };

  // ---- Daily program branch (v3.5) ----
  if (pathway.kind === "daily") {
    return (
      <article className="animate-fade-in space-y-8">
        <Link href="/pathways">
          <span
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-back-pathways"
          >
            <ArrowLeft className="h-4 w-4" /> Pathways
          </span>
        </Link>

        <header className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
          <PoseImage
            slug={pathway.targetImgSlug}
            alt={pathway.target}
            rounded="rounded-xl"
            aspect="aspect-[4/3]"
            testId={`pathway-detail-hero-${pathway.slug}`}
          />
          <div className="space-y-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{pathway.name}</h1>
            <p className="text-muted-foreground">{pathway.tagline ?? pathway.summary}</p>
            {pathway.goalDescription && (
              <p className="text-sm text-muted-foreground" data-testid="text-goal-description">
                {pathway.goalDescription}
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="h-3 w-3" /> 60 days
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Repeat className="h-3 w-3" /> {pathway.sessionsPerWeek}x / week
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" /> {pathway.timePerSession}
              </Badge>
            </div>
            {enrollment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unenroll.mutate(enrollment.id)}
                data-testid="button-end-pathway"
              >
                <X className="mr-1 h-4 w-4" /> End tracking
              </Button>
            )}
          </div>
        </header>

        <WarmupCard />

        <DailyProgram
          pathway={pathway}
          enrollment={enrollment}
          onEnroll={() => enroll.mutate()}
          enrolling={enroll.isPending}
        />
      </article>
    );
  }

  return (
    <article className="animate-fade-in space-y-8">
      <Link href="/pathways">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-pathways">
          <ArrowLeft className="h-4 w-4" /> Pathways
        </span>
      </Link>

      <header className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
        <PoseImage
          slug={pathway.targetImgSlug}
          alt={pathway.target}
          rounded="rounded-xl"
          aspect="aspect-[4/3]"
          testId={`pathway-detail-hero-${pathway.slug}`}
        />
        <div className="space-y-3">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{pathway.name}</h1>
          <p className="text-muted-foreground">{pathway.tagline ?? pathway.summary}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1"><CalendarDays className="h-3 w-3" /> {pathway.weeks} weeks</Badge>
            <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> {pathway.sessionsPerWeek}x / week</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {pathway.timePerSession}</Badge>
          </div>

          {enrollment ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span data-testid="text-pathway-progress">
                  Week {currentWeek} of {pathway.weeks} · {weeksDone} week{weeksDone === 1 ? "" : "s"} practiced · {pct}%
                  {behindByWeeks > 0 ? ` · ${behindByWeeks} week${behindByWeeks === 1 ? "" : "s"} behind calendar` : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unenroll.mutate(enrollment.id)}
                  data-testid="button-end-pathway"
                >
                  <X className="mr-1 h-4 w-4" /> End
                </Button>
              </div>
              <Progress value={pct} data-testid="progress-pathway" />
              <Button
                onClick={() => {
                  const wk = pathway.weekPlan.find((w) => w.weekNumber === currentWeek) ?? pathway.weekPlan[0];
                  if (wk) startWeek(wk);
                }}
                className="w-full sm:w-auto"
                data-testid="button-start-current-week"
              >
                <Play className="mr-1.5 h-4 w-4" /> Start week {currentWeek}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => enroll.mutate()} disabled={enroll.isPending} data-testid="button-start-pathway">
                <CalendarDays className="mr-1.5 h-4 w-4" /> Track this pathway
              </Button>
              <Button variant="secondary" onClick={startWeekOne} data-testid="button-start-week-1">
                <Play className="mr-1.5 h-4 w-4" /> Start week 1
              </Button>
            </div>
          )}
        </div>
      </header>

      <WarmupCard />

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Week-by-week plan</h2>

        <ol className="relative space-y-4 border-l border-border pl-6">
          {pathway.weekPlan.map((week) => {
            const isCurrent = enrollment != null && currentWeek === week.weekNumber;
            const isDone = completedWeeks.has(week.weekNumber);
            const totalHold = week.poses.reduce((sum, p) => sum + p.holdSeconds, 0);
            const sessionsPerWeek = week.sessionsPerWeek ?? pathway.sessionsPerWeek;
            return (
              <li key={week.weekNumber} className="relative" data-testid={`week-${week.weekNumber}`}>
                <span
                  className={`absolute -left-[31px] flex h-8 w-8 items-center justify-center rounded-full font-serif text-sm ${
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-accent text-foreground/80"
                  }`}
                >
                  {week.weekNumber}
                </span>
                <Card className={`shadow-soft ${isCurrent ? "border-primary/50" : ""}`}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-lg">
                        Week {week.weekNumber} · {week.theme}
                      </h3>
                      {isDone && (
                        <Badge variant="secondary" data-testid={`badge-done-week-${week.weekNumber}`}>
                          Practiced
                        </Badge>
                      )}
                      {isCurrent && !isDone && (
                        <Badge data-testid={`badge-current-week-${week.weekNumber}`}>← Up next</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {week.poses.map((p, i) => {
                        const asana = asanaBySlug(p.asanaSlug);
                        return (
                          <div
                            key={`${p.asanaSlug}-${i}`}
                            className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-background p-2 text-center"
                          >
                            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-accent/30">
                              <img
                                src={`${import.meta.env.BASE_URL}poses/${p.asanaSlug}.png`}
                                alt={asana?.english ?? p.asanaSlug}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </span>
                            <p className="text-xs font-medium leading-tight">{asana?.english ?? p.asanaSlug}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.holdSeconds}s{p.note ? ` · ${p.note}` : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {formatSeconds(totalHold)} per session
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Repeat className="h-3.5 w-3.5" /> {sessionsPerWeek}x this week
                        </p>
                      </div>
                      <Button
                        onClick={() => startWeek(week)}
                        size="sm"
                        data-testid={`button-start-week-${week.weekNumber}`}
                      >
                        <Play className="mr-1.5 h-4 w-4" /> Start week {week.weekNumber} session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
}
