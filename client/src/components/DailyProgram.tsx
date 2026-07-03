import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MobilityCheckInCard } from "@/components/MobilityCheckIn";
import { useToast } from "@/hooks/use-toast";
import { asanaBySlug } from "@/data/content";
import type { Pathway, DailyPlan } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import type { Enrollment, Session } from "@shared/schema";
import { Clock, Play, Moon, Ruler, Sparkles } from "lucide-react";

const MS_PER_DAY = 86400000;
const CHECKIN_DAYS = new Set([1, 15, 30, 45, 60]);

function poseLabel(p: DailyPlan["poses"][number]): string {
  const secs = p.sides === "each" ? `${p.holdSeconds}s each` : `${p.holdSeconds}s`;
  return p.note ? `${secs} · ${p.note}` : secs;
}

function PoseRow({ p }: { p: DailyPlan["poses"][number] }) {
  const asana = asanaBySlug(p.asanaSlug);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent/30">
        <img
          src={`${import.meta.env.BASE_URL}poses/${p.asanaSlug}.png`}
          alt={asana?.english ?? p.asanaSlug}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{asana?.english ?? p.asanaSlug}</p>
        <p className="text-xs text-muted-foreground">{poseLabel(p)}</p>
      </div>
    </div>
  );
}

export function DailyProgram({
  pathway,
  enrollment,
  onEnroll,
  enrolling,
}: {
  pathway: Pathway;
  enrollment: Enrollment | undefined;
  onEnroll: () => void;
  enrolling: boolean;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { loadSession } = usePractice();
  const plan = pathway.dailyPlan ?? [];
  const [modalDay, setModalDay] = useState<number | null>(null);

  const { data: sessions = [] } = useQuery<Session[]>({ queryKey: ["/api/sessions"] });

  // Current day from enrollment start date.
  const currentDay = useMemo(() => {
    if (!enrollment) return 0;
    const start = new Date(enrollment.startDate.slice(0, 10) + "T00:00:00").getTime();
    const now = Date.now();
    return Math.min(60, Math.floor((now - start) / MS_PER_DAY) + 1);
  }, [enrollment]);

  // Which day-numbers have a logged session (pathway match + timestamp >= start + N-1 days).
  const completedDays = useMemo(() => {
    const done = new Set<number>();
    if (!enrollment) return done;
    const start = new Date(enrollment.startDate.slice(0, 10) + "T00:00:00").getTime();
    const pathwaySessions = sessions.filter((s) => s.pathwaySlug === pathway.slug);
    for (const s of pathwaySessions) {
      const t = new Date(s.date.length <= 10 ? s.date + "T00:00:00" : s.date).getTime();
      const dayN = Math.floor((t - start) / MS_PER_DAY) + 1;
      if (dayN >= 1 && dayN <= 60) done.add(dayN);
    }
    return done;
  }, [sessions, enrollment, pathway.slug]);

  const lastCompleted = completedDays.size ? Math.max(...completedDays) : 0;
  const behind = enrollment && currentDay - 1 > lastCompleted ? currentDay - 1 - lastCompleted : 0;

  const startDay = (d: DailyPlan) => {
    const poses = d.poses
      .map((p) => {
        const asana = asanaBySlug(p.asanaSlug);
        // Total hold per pose: for "each" we still queue a single timer entry with the per-side hold.
        return asana ? { asana, holdSeconds: p.holdSeconds } : null;
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } =>
          x != null,
      );
    loadSession(poses, {
      label: `${pathway.name} — Day ${d.day}`,
      pathwaySlug: pathway.slug,
    });
    toast({ title: `Day ${d.day} loaded`, description: `${d.theme} — ${d.poses.length} poses queued.` });
    navigate("/practice");
  };

  const today = enrollment ? plan.find((d) => d.day === currentDay) : plan[0];
  const showCheckinPrompt = enrollment != null && CHECKIN_DAYS.has(currentDay);

  return (
    <div className="space-y-8">
      {/* ---- Enroll CTA when not enrolled ---- */}
      {!enrollment && (
        <Card className="border-primary/40 bg-accent/30 shadow-soft">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Start tracking to unlock your day-by-day journey, progress grid, and mobility check-ins.
            </p>
            <Button onClick={onEnroll} disabled={enrolling} data-testid="button-start-pathway">
              <Play className="mr-1.5 h-4 w-4" /> Start the journey
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---- Today card ---- */}
      {today && (
        <section data-testid="section-today">
          {showCheckinPrompt && (
            <div
              className="mb-3 flex items-center gap-2 rounded-md border border-secondary/40 bg-secondary/10 px-4 py-2.5 text-sm text-secondary-foreground"
              data-testid="prompt-checkin"
            >
              <Ruler className="h-4 w-4 shrink-0 text-secondary" />
              Take a moment to record your mobility today — it's rewarding to see the change.
            </div>
          )}

          {today.restDay ? (
            <Card className="border-secondary/40 bg-secondary/10 shadow-soft" data-testid="card-rest-day">
              <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background">
                    <img
                      src={`${import.meta.env.BASE_URL}poses/balasana.png`}
                      alt="Child's pose"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                      {enrollment ? `Today · Day ${currentDay} of 60` : "Rest day"}
                    </p>
                    <h2 className="font-serif text-2xl">Rest day · your body is rebuilding</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{today.theme}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => startDay(today)}
                  data-testid="button-optional-recovery"
                >
                  <Moon className="mr-1.5 h-4 w-4" /> Optional 5-min recovery
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/40 shadow-soft" data-testid="card-today">
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      {enrollment ? `Today · Day ${currentDay} of 60` : `Day 1 preview`}
                    </p>
                    <h2 className="font-serif text-2xl">{today.theme}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" /> ~{today.totalMinutes} min
                    </Badge>
                    <Badge variant="outline">
                      {today.focus === "both" ? "Splits + backbend" : "Front splits"}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {today.poses.map((p, i) => (
                    <PoseRow key={`${p.asanaSlug}-${i}`} p={p} />
                  ))}
                </div>

                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => startDay(today)}
                  data-testid="button-start-today-session"
                >
                  <Play className="mr-1.5 h-5 w-5" /> Start today's session
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ---- 60-day journey grid ---- */}
      <section className="space-y-4" data-testid="section-journey">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl">Your 60-day journey</h2>
        </div>

        <div className="grid grid-cols-10 gap-1.5 sm:gap-2" data-testid="grid-journey">
          {plan.map((d) => {
            const isCompleted = completedDays.has(d.day);
            const isToday = enrollment != null && d.day === currentDay;
            const isFuture = enrollment == null || d.day > currentDay;
            let cls =
              "relative flex aspect-square items-center justify-center rounded-md text-[11px] font-medium transition-colors sm:text-xs ";
            if (isCompleted) {
              cls += "bg-secondary text-secondary-foreground";
            } else if (isToday) {
              cls += "border-2 border-primary text-primary animate-pulse";
            } else if (d.restDay) {
              cls += "border border-dashed border-border text-muted-foreground";
            } else if (isFuture) {
              cls += "border border-border text-muted-foreground hover:border-primary/50";
            } else {
              cls += "border border-border text-muted-foreground";
            }
            return (
              <Tooltip key={d.day}>
                <TooltipTrigger asChild>
                  <button
                    className={cls}
                    onClick={() => setModalDay(d.day)}
                    data-testid={`cell-day-${d.day}`}
                    aria-label={`Day ${d.day}: ${d.theme}`}
                  >
                    {d.restDay ? <Moon className="h-3 w-3" /> : d.day}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="text-xs">
                    Day {d.day} · {d.theme}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-secondary" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-primary" /> Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-border" /> Upcoming
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-sm border border-dashed border-border">
              <Moon className="h-2 w-2" />
            </span>{" "}
            Rest day
          </span>
        </div>

        {/* On track / behind indicator */}
        {enrollment && behind > 0 && (
          <p
            className="rounded-md bg-accent/40 px-4 py-2.5 text-sm text-muted-foreground"
            data-testid="text-behind"
          >
            You're {behind} {behind === 1 ? "day" : "days"} behind — small daily practice adds up.
          </p>
        )}
        {enrollment && behind === 0 && lastCompleted > 0 && (
          <p
            className="rounded-md bg-secondary/10 px-4 py-2.5 text-sm text-secondary-foreground"
            data-testid="text-on-track"
          >
            You're on track — keep the rhythm going.
          </p>
        )}
      </section>

      {/* ---- Mobility check-in ---- */}
      <MobilityCheckInCard pathwaySlug={pathway.slug} currentDay={currentDay} />

      {/* ---- Day modal ---- */}
      <Dialog open={modalDay != null} onOpenChange={(o) => !o && setModalDay(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {(() => {
            const d = plan.find((x) => x.day === modalDay);
            if (!d) return null;
            const canStart = enrollment == null || d.day <= currentDay || currentDay === 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">
                    Day {d.day} · {d.theme}
                  </DialogTitle>
                  <DialogDescription>
                    {d.restDay
                      ? "A gentle rest day — let your body rebuild."
                      : `~${d.totalMinutes} min · ${d.poses.length} poses`}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {d.poses.map((p, i) => (
                    <PoseRow key={`${p.asanaSlug}-${i}`} p={p} />
                  ))}
                </div>
                {canStart && (
                  <Button
                    onClick={() => {
                      setModalDay(null);
                      startDay(d);
                    }}
                    data-testid={`button-start-modal-day-${d.day}`}
                  >
                    <Play className="mr-1.5 h-4 w-4" />{" "}
                    {d.restDay ? "Start recovery" : `Start Day ${d.day} session`}
                  </Button>
                )}
                {!canStart && (
                  <p className="text-sm text-muted-foreground">
                    This day unlocks on Day {d.day} of your journey.
                  </p>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
