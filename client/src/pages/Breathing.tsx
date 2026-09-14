import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { BreathingVisualizer, type BreathConfig } from "@/components/BreathingVisualizer";
import { VoicePlayer } from "@/components/VoicePlayer";
import { BREATHING, breathOfTheDay, type BreathTechnique } from "@/data/content";
import { logPracticeSession } from "@/lib/logPracticeSession";
import { readUrlParam } from "@/lib/hashQuery";
import { Sparkles, ShieldAlert, Wind } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

function isHoldPhase(label: string): boolean {
  return /hold|retain|pause/i.test(label);
}

function initialBreathSlug(): string {
  const fromUrl = readUrlParam("slug") || readUrlParam("technique");
  if (fromUrl && BREATHING.some((b) => b.slug === fromUrl)) return fromUrl;
  return breathOfTheDay().slug;
}

export default function Breathing() {
  useDocumentTitle("Breathing · Sadhana");
  const { toast } = useToast();
  const [activeSlug, setActiveSlug] = useState(initialBreathSlug);
  const active: BreathTechnique = useMemo(
    () => BREATHING.find((b) => b.slug === activeSlug) ?? BREATHING[0],
    [activeSlug],
  );
  const [rounds, setRounds] = useState(active.defaultRounds);
  /** Skip hold phases — matches “shorten or skip holds” advice on Box Breathing. */
  const [skipHolds, setSkipHolds] = useState(false);
  /** Scale hold seconds (1 = full, 0.5 = half). Ignored when skipHolds. */
  const [holdScale, setHoldScale] = useState(1);

  useEffect(() => {
    const onChange = () => {
      const fromUrl = readUrlParam("slug") || readUrlParam("technique");
      if (fromUrl && BREATHING.some((b) => b.slug === fromUrl)) {
        setActiveSlug(fromUrl);
        setRounds(BREATHING.find((b) => b.slug === fromUrl)!.defaultRounds);
        setSkipHolds(false);
        setHoldScale(1);
      }
    };
    for (const e of ["pushState", "replaceState", "popstate", "hashchange"]) {
      window.addEventListener(e, onChange);
    }
    return () => {
      for (const e of ["pushState", "replaceState", "popstate", "hashchange"]) {
        window.removeEventListener(e, onChange);
      }
    };
  }, []);

  const selectTechnique = (slug: string) => {
    const t = BREATHING.find((b) => b.slug === slug)!;
    setActiveSlug(slug);
    setRounds(t.defaultRounds);
    setSkipHolds(false);
    setHoldScale(1);
    const next = `/breathing?slug=${encodeURIComponent(slug)}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, "", next);
    }
  };

  const hasHoldPhases = active.phases.some((p) => isHoldPhase(p.label));

  const phases = useMemo(() => {
    return active.phases
      .map((p) => {
        if (!isHoldPhase(p.label)) return p;
        if (skipHolds) return null;
        if (holdScale === 1) return p;
        return { ...p, seconds: Math.max(1, Math.round(p.seconds * holdScale)) };
      })
      .filter((p): p is (typeof active.phases)[number] => p != null);
  }, [active.phases, skipHolds, holdScale]);

  const totalSeconds = phases.reduce((s, p) => s + p.seconds, 0) * rounds;
  const totalLabel =
    totalSeconds < 60
      ? `${totalSeconds} sec`
      : `${Math.floor(totalSeconds / 60)} min${totalSeconds % 60 ? ` ${totalSeconds % 60} sec` : ""}`;

  const config: BreathConfig = {
    phases,
    rounds,
    alternateNostril: active.alternateNostril,
    rapid: active.rapid,
  };

  const onComplete = (elapsedSeconds: number) => {
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    void logPracticeSession({
      minutes,
      poseNames: [active.name],
      label: `Pranayama: ${active.name}`,
      pathwaySlug: null,
      preMood: null,
      postMood: null,
      kind: "breathing",
      journalTags: ["breathing", active.name],
      journalBody: `Pranayama — ${active.name} for ${minutes} min.`,
    }).then((result) => {
      if (!result.ok) {
        toast({
          title: "Could not save breath session",
          description: result.error ?? "Try again when you're back online.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Breath complete",
        description: result.milestone
          ? result.milestone.message
          : `${active.name} logged toward your streak.`,
      });
    });
  };

  return (
    <div className="animate-fade-in space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Breathing</h1>
        <p className="text-muted-foreground">
          Pranayama — guided breath practices. Choose a technique, set your rounds, and follow the
          animated guide. Each completed session counts toward your streak.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BREATHING.map((t) => {
          const isActive = t.slug === activeSlug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => selectTechnique(t.slug)}
              className="text-left"
              data-testid={`button-technique-${t.slug}`}
              aria-pressed={isActive}
            >
              <Card
                className={`h-full cursor-pointer shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate ${
                  isActive ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-1.5 font-serif text-lg leading-tight">
                        <Wind className="h-4 w-4 text-secondary" /> {t.name}
                      </h3>
                      {t.sanskrit && <p className="text-xs text-muted-foreground">{t.sanskrit}</p>}
                    </div>
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {t.pattern}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.tagline}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="shadow-soft" data-testid={`panel-technique-${active.slug}`}>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-2xl" data-testid="text-active-technique">
                {active.name}
              </h2>
              <Badge variant="outline" className="tabular-nums">
                {active.pattern}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>

          <div className="max-w-sm space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="rounds-slider">
                  Rounds
                </label>
                <span className="font-serif text-lg tabular-nums" data-testid="text-rounds-value">
                  {rounds}
                </span>
              </div>
              <Slider
                id="rounds-slider"
                min={1}
                max={12}
                step={1}
                value={[rounds]}
                onValueChange={(v) => setRounds(v[0])}
                data-testid="slider-rounds"
              />
            </div>

            {hasHoldPhases && (
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <p className="text-sm font-medium">Adapt holds</p>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={skipHolds}
                    onChange={(e) => setSkipHolds(e.target.checked)}
                    data-testid="checkbox-skip-holds"
                  />
                  Skip hold phases
                </label>
                {!skipHolds && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm" htmlFor="hold-scale-slider">
                        Hold length
                      </label>
                      <span className="text-sm tabular-nums" data-testid="text-hold-scale">
                        {holdScale === 1 ? "Full" : holdScale === 0.5 ? "Half" : `${holdScale}×`}
                      </span>
                    </div>
                    <Slider
                      id="hold-scale-slider"
                      min={0.5}
                      max={1}
                      step={0.25}
                      value={[holdScale]}
                      onValueChange={(v) => setHoldScale(v[0])}
                      data-testid="slider-hold-scale"
                    />
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground" data-testid="text-breath-duration">
              About {totalLabel} total · pattern {phases.map((p) => p.seconds).join("-")}
            </p>
          </div>

          <VoicePlayer
            src={`${import.meta.env.BASE_URL}audio/breath-${active.slug}.mp3`}
            slug={active.slug}
            label={`Guided audio — ${active.name}`}
          />

          <BreathingVisualizer
            key={`${active.slug}-${rounds}-${skipHolds}-${holdScale}`}
            config={config}
            onComplete={onComplete}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg bg-accent/40 p-4">
              <h3 className="flex items-center gap-2 font-serif text-base">
                <Sparkles className="h-4 w-4 text-secondary" /> Benefits
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {active.benefits.map((b, i) => (
                  <li key={i} data-testid={`benefit-${active.slug}-${i}`}>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2 rounded-lg border border-[hsl(20_45%_60%/0.45)] bg-[hsl(20_50%_88%/0.35)] p-4 dark:bg-[hsl(20_30%_24%/0.35)]">
              <h3 className="flex items-center gap-2 font-serif text-base">
                <ShieldAlert className="h-4 w-4 text-primary" /> Who should avoid
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`avoid-${active.slug}`}>
                {active.avoid}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
