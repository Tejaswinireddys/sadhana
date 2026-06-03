import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoseSvg } from "@/components/PoseSvg";
import { WarmupCard } from "@/components/WarmupCard";
import { PATHWAYS } from "@/data/content";
import type { Enrollment } from "@shared/schema";
import { CalendarDays, Repeat, Clock } from "lucide-react";

export default function Pathways() {
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Goal Pathways</h1>
        <p className="text-muted-foreground">
          Structured, progressive flexibility programs. Pick a goal and follow the week-by-week plan.
        </p>
      </header>

      <WarmupCard />

      <div className="grid gap-4 md:grid-cols-3">
        {PATHWAYS.map((p) => {
          const enrolled = enrollments.find((e) => e.pathwaySlug === p.slug && e.active);
          return (
            <Link key={p.slug} href={`/pathways/${p.slug}`}>
              <Card
                className="group h-full cursor-pointer shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate"
                data-testid={`card-pathway-${p.slug}`}
              >
                <div className="flex items-center justify-center bg-accent/40 py-6 text-foreground/80 transition-transform group-hover:scale-105">
                  <PoseSvg pose={p.targetPose} size={110} />
                </div>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-serif text-xl">{p.name}</h3>
                    {enrolled && <Badge>Enrolled</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">Target: {p.target}</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {p.weeks} weeks</p>
                    <p className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> {p.sessionsPerWeek} sessions / week</p>
                    <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {p.timePerSession}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
