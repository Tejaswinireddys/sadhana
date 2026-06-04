import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { type Level } from "@/components/AnimatedAsana";
import { StepMotion } from "@/components/StepMotion";
import { VoicePlayer } from "@/components/VoicePlayer";
import { DemoMode } from "@/components/DemoMode";
import { asanaBySlug, type Severity } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import { EmptyState } from "@/components/EmptyState";
import {
  ArrowLeft,
  Plus,
  Check,
  Wind,
  Clock,
  Sparkles,
  Settings2,
  AlertTriangle,
  Info,
  AlertCircle,
  Activity,
  NotebookPen,
  Check as CheckIcon,
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
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-serif text-lg">
            <NotebookPen className="h-5 w-5 text-secondary" /> My notes
          </h3>
          {saved && (
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              data-testid="text-notes-saved"
            >
              <CheckIcon className="h-3.5 w-3.5 text-secondary" /> Saved
            </span>
          )}
        </div>
        <Textarea
          placeholder="What works for me / what hurts / props I like…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          data-testid="input-pose-notes"
        />
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

export default function AsanaDetail() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const asana = asanaBySlug(slug || "");
  const { add, todays } = usePractice();
  const { toast } = useToast();
  const [level, setLevel] = useState<Level>("intermediate");

  if (!asana) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="Pose not found" description="That asana isn't in the library.">
          <Button asChild>
            <Link href="/asanas">Back to library</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const inToday = !!todays.find((x) => x.slug === asana.slug);
  const variation = asana.variations[level];

  const addToday = () => {
    add(asana);
    toast({
      title: "Added to today's practice",
      description: `${asana.english} is ready in your session.`,
    });
  };

  // group avoidIf rows by severity, in display order
  const grouped = SEVERITY_ORDER.map((sev) => ({
    sev,
    rows: asana.avoidIf.filter((r) => r.severity === sev),
  })).filter((g) => g.rows.length > 0);

  return (
    <article className="animate-fade-in space-y-8">
      <button
        onClick={() => navigate("/asanas")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        data-testid="link-back-asanas"
      >
        <ArrowLeft className="h-4 w-4" /> Library
      </button>

      {/* Instructor-led guided demo — the prominent hero experience */}
      <DemoMode slug={asana.slug} />

      <header className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{asana.category}</Badge>
            <Badge variant="outline">{asana.difficulty}</Badge>
          </div>
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight" data-testid="text-asana-sanskrit">
              {asana.sanskrit}
            </h1>
            <p className="text-lg text-muted-foreground">{asana.english}</p>
          </div>
          <p className="text-muted-foreground">{asana.summary}</p>
          <Button onClick={addToday} disabled={inToday} data-testid="button-add-today">
            {inToday ? <Check className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
            {inToday ? "In today's practice" : "Add to today's practice"}
          </Button>
        </div>
        {/* Quick "listen again" affordance below the headline */}
        <VoicePlayer
          src={`${import.meta.env.BASE_URL}voice/pose-${asana.slug}.mp3`}
          slug={asana.slug}
          label="Listen again — guided audio"
        />
      </header>

      {/* "You'll feel this in..." — body regions this pose stretches. */}
      {asana.stretchZones.length > 0 && (
        <Card className="border-secondary/30 shadow-soft" data-testid="card-stretch-zones">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg">
              <Activity className="h-5 w-5 text-secondary" />
              You'll feel this in…
            </h2>
            <ul className="divide-y divide-border/60">
              {asana.stretchZones.map((z, i) => {
                const filled = INTENSITY_DOTS[z.intensity];
                const dotColor = z.primary ? "bg-primary" : "bg-secondary";
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    data-testid={`stretch-zone-${i}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={cn(
                          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                          z.primary ? "bg-primary" : "bg-secondary",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="font-medium leading-snug" data-testid={`stretch-zone-region-${i}`}>
                          {z.region}
                          <span className="ml-2 align-middle text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                            {z.primary ? "Primary" : "Secondary"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">{z.sensation}</p>
                      </div>
                    </div>
                    {/* Intensity dots: 3 dots, filled by intensity. */}
                    <div
                      className="mt-1 flex shrink-0 items-center gap-1"
                      title={`Intensity: ${z.intensity}`}
                      aria-label={`Intensity: ${z.intensity}`}
                    >
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className={cn(
                            "h-2 w-2 rounded-full",
                            d < filled ? dotColor : "bg-muted",
                          )}
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

      {/* Difficulty paths */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl">Choose your path</h2>
        <Tabs value={level} onValueChange={(v) => setLevel(v as Level)}>
          <TabsList data-testid="tabs-level">
            <TabsTrigger value="beginner" data-testid="tab-beginner">
              Beginner
            </TabsTrigger>
            <TabsTrigger value="intermediate" data-testid="tab-intermediate">
              Intermediate
            </TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced">
              Advanced
            </TabsTrigger>
          </TabsList>
          {(["beginner", "intermediate", "advanced"] as Level[]).map((lv) => {
            const v = asana.variations[lv];
            return (
              <TabsContent key={lv} value={lv} className="mt-4">
                <Card className="shadow-soft" data-testid={`variation-${lv}`}>
                  <CardContent className="space-y-4 p-5">
                    <p className="text-sm">{v.description}</p>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Cues
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {v.cues.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {v.props
                            .filter((p) => p !== "none")
                            .map((p) => (
                              <Badge key={p} variant="outline" className="capitalize">
                                {p}
                              </Badge>
                            ))}
                          {v.props.every((p) => p === "none") && (
                            <Badge variant="outline">No props needed</Badge>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> Hold ~{v.holdSeconds}s
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </section>

      {/* Quick facts */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="shadow-soft">
          <CardContent className="flex items-start gap-3 p-4">
            <Wind className="mt-0.5 h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm font-medium">Breathing cue</p>
              <p className="text-sm text-muted-foreground">{asana.breathing}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="mt-0.5 h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm font-medium">Hold time</p>
              <p className="text-sm text-muted-foreground">
                {asana.hold} · {level} ~{variation.holdSeconds}s
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Steps with animated mini-clips */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl">Step by step</h2>
        <ol className="space-y-3">
          {asana.steps.map((step, i) => (
            <li key={i}>
              <Card className="shadow-soft" data-testid={`step-${asana.slug}-${i}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                    {i + 1}
                  </span>
                  {step.stepMotion && (
                    <span
                      className="hidden shrink-0 rounded-lg bg-accent/40 p-1 text-foreground/75 sm:block"
                      data-testid={`step-motion-${asana.slug}-${i}`}
                    >
                      <StepMotion motion={step.stepMotion} size={64} />
                    </span>
                  )}
                  <p className="text-sm">{step.text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Benefits */}
      <Card className="shadow-soft">
        <CardContent className="space-y-2 p-5">
          <h3 className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="h-5 w-5 text-secondary" /> Benefits
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {asana.benefits.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Who should approach with care — soft callout, grouped by severity */}
      {grouped.length > 0 && (
        <Card
          className="border-[hsl(20_45%_60%/0.45)] bg-[hsl(20_50%_88%/0.35)] shadow-soft dark:bg-[hsl(20_30%_24%/0.35)]"
          data-testid="callout-avoid-if"
        >
          <CardContent className="space-y-4 p-5">
            <h3 className="font-serif text-lg">Who should approach with care</h3>
            <div className="space-y-4">
              {grouped.map(({ sev, rows }) => {
                const meta = SEVERITY_META[sev];
                const Icon = meta.icon;
                return (
                  <div key={sev} className="space-y-1.5" data-testid={`avoid-group-${sev}`}>
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

      {/* Modifications */}
      <Card className="bg-accent/40 shadow-soft">
        <CardContent className="flex items-start gap-3 p-5">
          <Settings2 className="mt-0.5 h-5 w-5 text-secondary" />
          <div>
            <h3 className="font-serif text-lg">Modifications</h3>
            <p className="text-sm text-muted-foreground">{asana.modifications}</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal notes (v3.4) */}
      <PersonalNotes slug={asana.slug} />
    </article>
  );
}
