import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoseSvg } from "@/components/PoseSvg";
import { WarmupCard } from "@/components/WarmupCard";
import { PATHWAYS } from "@/data/content";
import type { Pathway } from "@/data/content";
import type { Enrollment } from "@shared/schema";
import { CalendarDays, Repeat, Clock } from "lucide-react";

// Pick up to three representative pose slugs spread across the program so the
// card previews the journey (start → middle → goal) rather than a single pose.
function representativeSlugs(p: Pathway): string[] {
  const weeks = p.weekPlan;
  if (!weeks.length) return [];
  const picks: typeof weeks = [weeks[0]];
  if (weeks.length > 2) picks.push(weeks[Math.floor(weeks.length / 2)]);
  if (weeks.length > 1) picks.push(weeks[weeks.length - 1]);
  const slugs: string[] = [];
  for (const wk of picks) {
    // prefer the last (usually peak) pose of the week, fall back to the first
    const pose = wk.poses[wk.poses.length - 1] ?? wk.poses[0];
    if (pose && !slugs.includes(pose.asanaSlug)) slugs.push(pose.asanaSlug);
  }
  return slugs.slice(0, 3);
}

export default function Pathways() {
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Goal Pathways</h1>
        <p className="text-muted-foreground">
          Multi-week programs that build toward a goal — like getting your first split.
        </p>
      </header>

      <WarmupCard />

      <div className="grid gap-4 md:grid-cols-3">
        {PATHWAYS.map((p) => {
          const enrolled = enrollments.find((e) => e.pathwaySlug === p.slug && e.active);
          const thumbs = representativeSlugs(p);
          return (
            <Link key={p.slug} href={`/pathways/${p.slug}`}>
              <Card
                className="group flex h-full cursor-pointer flex-col shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate"
                data-testid={`card-pathway-${p.slug}`}
              >
                <div className="relative flex items-center justify-center bg-accent/40 py-6 text-foreground/80 transition-transform group-hover:scale-105">
                  <PoseSvg pose={p.targetPose} size={110} />
                  {enrolled && (
                    <Badge className="absolute right-3 top-3" data-testid={`badge-enrolled-${p.slug}`}>
                      Enrolled
                    </Badge>
                  )}
                </div>
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <h3 className="font-serif text-xl">{p.name}</h3>
                    {p.tagline && (
                      <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                    )}
                  </div>

                  {thumbs.length > 0 && (
                    <div className="flex items-center gap-2" data-testid={`thumbs-pathway-${p.slug}`}>
                      {thumbs.map((slug) => (
                        <span
                          key={slug}
                          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-border bg-background"
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}poses/${slug}.png`}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">→ {p.target}</span>
                    </div>
                  )}

                  <div className="mt-auto space-y-1 text-xs text-muted-foreground">
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
