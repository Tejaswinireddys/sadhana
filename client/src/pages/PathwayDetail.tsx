import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PoseSvg } from "@/components/PoseSvg";
import { WarmupCard } from "@/components/WarmupCard";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pathwayBySlug } from "@/data/content";
import type { Enrollment } from "@shared/schema";
import { todayISO, daysSince } from "@/lib/sadhana";
import { ArrowLeft, CalendarDays, Repeat, Clock, Play, X } from "lucide-react";

export default function PathwayDetail() {
  const { slug } = useParams();
  const pathway = pathwayBySlug(slug || "");
  const { toast } = useToast();
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });

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

  if (!pathway) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="Pathway not found">
          <Button asChild><Link href="/pathways">Back to pathways</Link></Button>
        </EmptyState>
      </div>
    );
  }

  const totalDays = pathway.weeks * 7;
  const elapsed = enrollment ? Math.min(daysSince(enrollment.startDate) + 1, totalDays) : 0;
  const pct = enrollment ? Math.round((elapsed / totalDays) * 100) : 0;
  const currentWeek = enrollment ? Math.min(Math.ceil(elapsed / 7), pathway.weeks) : 0;

  return (
    <article className="animate-fade-in space-y-8">
      <Link href="/pathways">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-pathways">
          <ArrowLeft className="h-4 w-4" /> Pathways
        </span>
      </Link>

      <header className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
        <div className="flex items-center justify-center rounded-xl bg-accent/40 py-6 text-foreground/85">
          <PoseSvg pose={pathway.targetPose} size={150} />
        </div>
        <div className="space-y-3">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{pathway.name}</h1>
          <p className="text-muted-foreground">{pathway.summary}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1"><CalendarDays className="h-3 w-3" /> {pathway.weeks} weeks</Badge>
            <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> {pathway.sessionsPerWeek}x / week</Badge>
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {pathway.timePerSession}</Badge>
          </div>
          {enrollment ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span data-testid="text-pathway-progress">Week {currentWeek} of {pathway.weeks} · {pct}% complete</span>
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
            </div>
          ) : (
            <Button onClick={() => enroll.mutate()} disabled={enroll.isPending} data-testid="button-start-pathway">
              <Play className="mr-1.5 h-4 w-4" /> Start pathway
            </Button>
          )}
        </div>
      </header>

      <WarmupCard />

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Week-by-week plan</h2>
        <Accordion type="single" collapsible className="space-y-2" defaultValue={enrollment ? `week-${currentWeek}` : undefined}>
          {pathway.schedule.map((wk) => (
            <AccordionItem
              key={wk.week}
              value={`week-${wk.week}`}
              className="rounded-lg border border-border bg-card px-4"
              data-testid={`week-${wk.week}`}
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-serif text-sm text-primary-foreground">
                    {wk.week}
                  </span>
                  <div>
                    <p className="text-sm font-medium">Week {wk.week}</p>
                    <p className="text-xs text-muted-foreground">{wk.focus}</p>
                  </div>
                  {currentWeek === wk.week && <Badge className="ml-2">Current</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Warm-up: </span>{wk.warmup}
                </p>
                <ul className="space-y-1.5">
                  {wk.asanas.map((a, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <span>{a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.hold}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </article>
  );
}
