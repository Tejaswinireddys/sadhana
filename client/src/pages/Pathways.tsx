import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoseImage } from "@/components/PoseImage";
import { WarmupCard } from "@/components/WarmupCard";
import { PATHWAYS, asanaBySlug } from "@/data/content";
import type { Pathway } from "@/data/content";
import type { Enrollment } from "@shared/schema";
import { usePractice } from "@/context/PracticeContext";
import { CalendarDays, Repeat, Clock, Sparkles, Play, Zap, Flower2, Trophy } from "lucide-react";

// Build the ordered pose queue for a quick flow from its single week plan.
// A "each side" note flags a bilateral hold so guided mode re-narrates side 2.
function flowPoses(p: Pathway) {
  const week = p.weekPlan[0];
  if (!week) return [];
  return week.poses
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
}

// Pick up to three representative pose slugs spread across the program so the
// card previews the journey (start → middle → goal) rather than a single pose.
function representativeSlugs(p: Pathway): string[] {
  // Daily programs: sample days across the plan.
  const daily = p.dailyPlan;
  if (p.kind === "daily" && daily && daily.length) {
    const picks = [daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]];
    const slugs: string[] = [];
    for (const d of picks) {
      const pose = d.poses[d.poses.length - 2] ?? d.poses[0];
      if (pose && !slugs.includes(pose.asanaSlug)) slugs.push(pose.asanaSlug);
    }
    return slugs.slice(0, 3);
  }
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

// Compact card for a quick flow — illustration, name, duration, and a Start
// button that launches the guided session directly (no detail page).
function FlowCard({ p, onStart }: { p: Pathway; onStart: (p: Pathway) => void }) {
  const poseCount = p.weekPlan[0]?.poses.length ?? 0;
  return (
    <Card
      className="group flex h-full flex-col overflow-hidden shadow-soft transition-shadow hover:shadow-soft-lg"
      data-testid={`card-flow-${p.slug}`}
    >
      <PoseImage
        slug={p.targetImgSlug}
        alt={p.target}
        rounded="rounded-none"
        aspect="aspect-[4/3]"
        shadow={false}
        testId={`flow-hero-${p.slug}`}
      />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-serif text-lg leading-tight">{p.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {p.minutesPerSession ?? p.timePerSession} min · {poseCount} poses
          </p>
        </div>
        <Button
          className="mt-auto w-full gap-1.5"
          onClick={() => onStart(p)}
          data-testid={`button-start-flow-${p.slug}`}
        >
          <Play className="h-4 w-4" /> Start
        </Button>
      </CardContent>
    </Card>
  );
}

function PathwayCard({ p, enrolled }: { p: Pathway; enrolled: boolean }) {
  const thumbs = representativeSlugs(p);
  const isDaily = p.kind === "daily";
  return (
    <Link href={`/pathways/${p.slug}`}>
      <Card
        className="group flex h-full cursor-pointer flex-col shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate"
        data-testid={`card-pathway-${p.slug}`}
      >
        <div className="relative transition-transform group-hover:scale-[1.02]">
          <PoseImage
            slug={p.targetImgSlug}
            alt={p.target}
            rounded="rounded-xl"
            aspect="aspect-[4/3]"
            shadow={false}
            testId={`pathway-hero-${p.slug}`}
          />
          {isDaily && (
            <Badge
              className="absolute left-3 top-3 z-10 gap-1 bg-primary"
              data-testid={`badge-daily-${p.slug}`}
            >
              <Sparkles className="h-3 w-3" /> Daily program
            </Badge>
          )}
          {enrolled && (
            <Badge className="absolute right-3 top-3 z-10" data-testid={`badge-enrolled-${p.slug}`}>
              Enrolled
            </Badge>
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div>
            <h3 className="font-serif text-xl">{p.name}</h3>
            {p.tagline && <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>}
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
              <span className="text-xs text-muted-foreground">Goal: {p.target}</span>
            </div>
          )}

          <div className="mt-auto space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />{" "}
              {isDaily ? `${p.dailyPlan?.length ?? 0} days` : `${p.weeks} weeks`}
            </p>
            <p className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" /> {p.sessionsPerWeek} sessions / week
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {p.timePerSession}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Pathways() {
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();

  // Quick flows launch straight into a guided session — skip the detail page.
  const startFlow = (p: Pathway) => {
    const poses = flowPoses(p);
    if (!poses.length) return;
    loadSession(poses, { label: p.name, pathwaySlug: p.slug });
    navigate("/guided");
  };

  // Four ordered sections (v5.1).
  // Quick Flows: flows without the salutation/goddess section tag.
  const quickFlows = PATHWAYS.filter(
    (p) => p.kind === "flow" && p.section !== "salutation-goddess",
  );
  // Salutations & Goddess Flows: the new salutation + goddess flows.
  const salutationGoddess = PATHWAYS.filter(
    (p) => p.kind === "flow" && p.section === "salutation-goddess",
  );
  // 7-Day Challenges: daily programs tagged as seven-day.
  const sevenDay = PATHWAYS.filter((p) => p.kind === "daily" && p.section === "seven-day");
  // Multi-Week Programs: everything else (weekly programs + longer daily programs).
  const programs = PATHWAYS.filter(
    (p) => p.kind !== "flow" && p.section !== "seven-day",
  );

  return (
    <div className="animate-fade-in space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Pathways</h1>
        <p className="text-muted-foreground">
          Short quick flows for right now, or multi-week programs that build toward a goal.
        </p>
      </header>

      <WarmupCard />

      {/* ---- 1. Quick Flows ---- */}
      {quickFlows.length > 0 && (
        <section className="space-y-3" data-testid="section-quick-flows">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">Quick Flows</h2>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">
            Ready-to-go sessions for common needs
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {quickFlows.map((p) => (
              <FlowCard key={p.slug} p={p} onStart={startFlow} />
            ))}
          </div>
        </section>
      )}

      {/* ---- 2. Salutations & Goddess Flows ---- */}
      {salutationGoddess.length > 0 && (
        <section className="space-y-3" data-testid="section-salutation-goddess">
          <div className="flex items-center gap-2">
            <Flower2 className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">Salutations &amp; Goddess Flows</h2>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">
            Traditional sequences and empowering flows
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {salutationGoddess.map((p) => (
              <FlowCard key={p.slug} p={p} onStart={startFlow} />
            ))}
          </div>
        </section>
      )}

      {/* ---- 3. 7-Day Challenges ---- */}
      {sevenDay.length > 0 && (
        <section className="space-y-3" data-testid="section-seven-day">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">7-Day Challenges</h2>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">Build a habit in a week</p>
          <div className="grid gap-4 md:grid-cols-3">
            {sevenDay.map((p) => (
              <PathwayCard
                key={p.slug}
                p={p}
                enrolled={!!enrollments.find((e) => e.pathwaySlug === p.slug && e.active)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- 4. Multi-Week Programs ---- */}
      {programs.length > 0 && (
        <section className="space-y-3" data-testid="section-programs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">Multi-Week Programs</h2>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">
            Structured journeys toward a goal
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {programs.map((p) => (
              <PathwayCard
                key={p.slug}
                p={p}
                enrolled={!!enrollments.find((e) => e.pathwaySlug === p.slug && e.active)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
