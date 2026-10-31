import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import { poseImageWithheld } from "@/data/poseImageAccuracy";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ds";
import { Button } from "@/components/ds";
import { Tag } from "@/components/ds";
import { PoseImage } from "@/components/PoseImage";
import { PlusLock } from "@/components/PlusLock";
import { ScrollRow } from "@/components/ScrollRow";
import { SessionSpec } from "@/components/SessionSpec";
import { Input } from "@/components/ui/input";
import { PATHWAYS } from "@/data/content";
import type { Pathway } from "@/data/content";
import { poseImageAlt } from "@/data/poseImageAlts";
import type { Enrollment } from "@shared/schema";
import { usePractice } from "@/context/PracticeContext";
import { CalendarDays, Repeat, Clock, Sparkles, Play, Zap, Flower2, Trophy, Search } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { countOf } from "@/lib/plural";
import {
  CLASS_FOCUSES,
  CLASS_LEVELS,
  CLASS_STYLES,
  DURATION_BUCKETS,
  classListings,
  filterClasses,
  filtersAreActive,
  isPlusClass,
  type ClassFilters,
  type ClassFocus,
  type ClassLevel,
  type ClassStyle,
  type DurationBucketId,
} from "@/lib/classCatalog";
import {
  catalogPreflight,
  flowPoses,
  sessionPreparation,
  flowSessionLabel,
  flowSessionMinutes,
  pathwaySessionRangeLabel,
  queueCatalogPoses,
} from "@/lib/pathwayTiming";

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
  // One source of truth: the same preflight the player shows before Begin.
  const preflight = catalogPreflight(flowPoses(p));
  const prep = sessionPreparation(flowPoses(p));
  return (
    <Card
      className="group flex h-full flex-col overflow-hidden shadow-soft transition-shadow hover:shadow-soft-lg"
      data-testid={`card-flow-${p.slug}`}
      data-flow-label={flowSessionLabel(p)}
    >
      <PoseImage
        slug={p.targetImgSlug}
        rounded="rounded-none"
        aspect="aspect-[4/3]"
        shadow={false}
        testId={`flow-hero-${p.slug}`}
      />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-serif text-lg leading-tight">{p.name}</h3>
          {p.tagline && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.tagline}</p>
          )}
          <SessionSpec preflight={preflight} className="mt-2" testId={`spec-flow-${p.slug}`} />
          <p className="mt-1 text-xs text-muted-foreground" data-testid={`prep-flow-${p.slug}`}>
            {prep
              ? `Opens with ${prep.label} of preparation (${prep.names.join(", ")}).`
              : "Gentle throughout — no separate warm-up needed."}
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
  const plus = isPlusClass(p);
  return (
    <Link href={`/pathways/${p.slug}`}>
      <Card
        className="group flex h-full cursor-pointer flex-col shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate"
        data-testid={`card-pathway-${p.slug}`}
      >
        <div className="relative transition-transform group-hover:scale-[1.02]">
          <PoseImage
            slug={p.targetImgSlug}
            rounded="rounded-xl"
            aspect="aspect-[4/3]"
            shadow={false}
            testId={`pathway-hero-${p.slug}`}
          />
          {isDaily && (
            <Tag
              tone="sage"
              className="absolute left-3 top-3 z-10 gap-1"
              data-testid={`badge-daily-${p.slug}`}
            >
              <Sparkles className="h-3 w-3" /> Daily program
            </Tag>
          )}
          {enrolled && (
            <Tag tone="leaf" className="absolute right-3 top-3 z-10" data-testid={`badge-enrolled-${p.slug}`}>
              Enrolled
            </Tag>
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-serif text-xl">{p.name}</h3>
            {plus && <PlusLock slug={p.slug} />}
          </div>
          {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}

          {thumbs.length > 0 && (
            <div className="flex items-center gap-2" data-testid={`thumbs-pathway-${p.slug}`}>
              {thumbs.map((slug) => (
                <span
                  key={slug}
                  className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-border bg-background"
                >
                  {poseImageWithheld(slug) ? (
                    <WithheldPoseImage slug={slug} compact />
                  ) : (
                    <img width={600} height={1200}
                    src={`${import.meta.env.BASE_URL}poses/${slug}.webp`}
                    alt={poseImageAlt(slug)}
                    decoding="async"
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                  )}
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
              <Clock className="h-3.5 w-3.5" /> {pathwaySessionRangeLabel(p)}
            </p>
            {p.goalDescription && (
              <p className="pt-1 text-foreground/80">{p.goalDescription}</p>
            )}
            <p>Voice-guided · Safety notes on every pose · Guest-friendly</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const EMPTY_FILTERS: ClassFilters = {
  query: "",
  style: "all",
  level: "all",
  duration: "all",
  focus: "all",
};

function FilterChip({
  pressed,
  onClick,
  children,
  testId,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
  testId: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className="shrink-0 snap-start"
    >
      {children}
    </Button>
  );
}

export default function Pathways() {
  useDocumentTitle("Classes · Sadhana");
  const { data: enrollments = [] } = useQuery<Enrollment[]>({ queryKey: ["/api/enrollments"] });
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const [filters, setFilters] = useState<ClassFilters>(EMPTY_FILTERS);

  const listings = useMemo(() => classListings(PATHWAYS), []);
  const filtering = filtersAreActive(filters);
  const results = useMemo(() => filterClasses(listings, filters), [listings, filters]);
  const focusOptions = useMemo(() => {
    const present = new Set(listings.map((item) => item.focus));
    return CLASS_FOCUSES.filter((focus) => present.has(focus));
  }, [listings]);

  // Quick flows launch straight into a guided session — skip the detail page.
  const startFlow = (p: Pathway) => {
    const poses = queueCatalogPoses(flowPoses(p));
    if (!poses.length) return;
    loadSession(poses, {
      label: p.name,
      pathwaySlug: p.slug,
      plannedMinutes: flowSessionMinutes(p),
    });
    navigate("/guided");
  };

  // Four ordered sections (v5.1). Shown when no filter is narrowing the list.
  const quickFlows = PATHWAYS.filter(
    (p) => p.kind === "flow" && p.section !== "salutation-goddess",
  );
  const salutationGoddess = PATHWAYS.filter(
    (p) => p.kind === "flow" && p.section === "salutation-goddess",
  );
  const sevenDay = PATHWAYS.filter((p) => p.kind === "daily" && p.section === "seven-day");
  const programs = PATHWAYS.filter(
    (p) => p.kind !== "flow" && p.section !== "seven-day",
  );

  const enrolled = (slug: string) => !!enrollments.find((e) => e.pathwaySlug === slug && e.active);

  const setStyle = (style: ClassStyle | "all") => setFilters((f) => ({ ...f, style }));
  const setLevel = (level: ClassLevel | "all") => setFilters((f) => ({ ...f, level }));
  const setDuration = (duration: DurationBucketId | "all") => setFilters((f) => ({ ...f, duration }));
  const setFocus = (focus: ClassFocus | "all") => setFilters((f) => ({ ...f, focus }));

  return (
    <div className="animate-fade-in space-y-8" data-testid="classes-catalog">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Classes</h1>
        <p className="text-muted-foreground">
          Short sessions for right now, or programs that build toward a goal. A lock marks Plus
          programs — you can still open them.
        </p>
      </header>

      <div className="space-y-4" data-testid="classes-filters">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={filters.query ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="Search classes"
            aria-label="Search classes"
            className="h-11 min-h-11 pl-9"
            data-testid="classes-search"
          />
        </div>

        <fieldset className="space-y-2" data-testid="classes-filter-style">
          <legend className="text-sm font-medium">Style</legend>
          <ScrollRow label="Style" testId="classes-style-scroll">
            <FilterChip pressed={(filters.style ?? "all") === "all"} onClick={() => setStyle("all")} testId="classes-style-all">
              All
            </FilterChip>
            {CLASS_STYLES.map((style) => (
              <FilterChip
                key={style}
                pressed={filters.style === style}
                onClick={() => setStyle(style)}
                testId={`classes-style-${style.toLowerCase()}`}
              >
                {style}
              </FilterChip>
            ))}
          </ScrollRow>
        </fieldset>

        <fieldset className="space-y-2" data-testid="classes-filter-level">
          <legend className="text-sm font-medium">Level</legend>
          <ScrollRow label="Level" testId="classes-level-scroll">
            <FilterChip pressed={(filters.level ?? "all") === "all"} onClick={() => setLevel("all")} testId="classes-level-all">
              All
            </FilterChip>
            {CLASS_LEVELS.map((level) => (
              <FilterChip
                key={level}
                pressed={filters.level === level}
                onClick={() => setLevel(level)}
                testId={`classes-level-${level.toLowerCase()}`}
              >
                {level}
              </FilterChip>
            ))}
          </ScrollRow>
        </fieldset>

        <fieldset className="space-y-2" data-testid="classes-filter-duration">
          <legend className="text-sm font-medium">Duration</legend>
          <ScrollRow label="Duration" testId="classes-duration-scroll">
            <FilterChip
              pressed={(filters.duration ?? "all") === "all"}
              onClick={() => setDuration("all")}
              testId="classes-duration-all"
            >
              All
            </FilterChip>
            {DURATION_BUCKETS.map((bucket) => (
              <FilterChip
                key={bucket.id}
                pressed={filters.duration === bucket.id}
                onClick={() => setDuration(bucket.id)}
                testId={`classes-duration-${bucket.id}`}
              >
                {bucket.label}
              </FilterChip>
            ))}
          </ScrollRow>
        </fieldset>

        <fieldset className="space-y-2" data-testid="classes-filter-focus">
          <legend className="text-sm font-medium">Focus area</legend>
          <ScrollRow label="Focus area" testId="classes-focus-scroll">
            <FilterChip pressed={(filters.focus ?? "all") === "all"} onClick={() => setFocus("all")} testId="classes-focus-all">
              All
            </FilterChip>
            {focusOptions.map((focus) => (
              <FilterChip
                key={focus}
                pressed={filters.focus === focus}
                onClick={() => setFocus(focus)}
                testId={`classes-focus-${focus.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                {focus}
              </FilterChip>
            ))}
          </ScrollRow>
        </fieldset>
      </div>

      {filtering ? (
        <section className="space-y-3" data-testid="classes-results" aria-live="polite">
          <h2 className="font-serif text-xl">
            {results.length === 0 ? "No classes match" : countOf(results.length, "class", "classes")}
          </h2>
          {results.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground" data-testid="classes-empty">
                Nothing matches that search. Clear the filters to see every class.
              </p>
              <Button type="button" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)} data-testid="classes-clear">
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {results.map((item) =>
                item.pathway.kind === "flow" ? (
                  <FlowCard key={item.pathway.slug} p={item.pathway} onStart={startFlow} />
                ) : (
                  <PathwayCard key={item.pathway.slug} p={item.pathway} enrolled={enrolled(item.pathway.slug)} />
                ),
              )}
            </div>
          )}
        </section>
      ) : (
        <>
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

          {sevenDay.length > 0 && (
            <section className="space-y-3" data-testid="section-seven-day">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h2 className="font-serif text-xl">7-Day Challenges</h2>
              </div>
              <p className="-mt-1 text-sm text-muted-foreground">Build a habit in a week</p>
              <div className="grid gap-4 md:grid-cols-3">
                {sevenDay.map((p) => (
                  <PathwayCard key={p.slug} p={p} enrolled={enrolled(p.slug)} />
                ))}
              </div>
            </section>
          )}

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
                  <PathwayCard key={p.slug} p={p} enrolled={enrolled(p.slug)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
