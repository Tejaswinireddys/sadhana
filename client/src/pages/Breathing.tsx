import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { todayISO } from "@/lib/sadhana";
import { BreathingVisualizer, type BreathConfig } from "@/components/BreathingVisualizer";
import { VoicePlayer } from "@/components/VoicePlayer";
import { BREATHING, breathOfTheDay, type BreathTechnique } from "@/data/content";
import { Sparkles, ShieldAlert, Wind } from "lucide-react";

export default function Breathing() {
  const { toast } = useToast();
  const [activeSlug, setActiveSlug] = useState<string>(() => breathOfTheDay().slug);
  const active: BreathTechnique = useMemo(
    () => BREATHING.find((b) => b.slug === activeSlug) ?? BREATHING[0],
    [activeSlug],
  );
  const [rounds, setRounds] = useState<number>(active.defaultRounds);

  const selectTechnique = (slug: string) => {
    const t = BREATHING.find((b) => b.slug === slug)!;
    setActiveSlug(slug);
    setRounds(t.defaultRounds);
  };

  const config: BreathConfig = {
    phases: active.phases,
    rounds,
    alternateNostril: active.alternateNostril,
    rapid: active.rapid,
  };

  const onComplete = (totalSeconds: number) => {
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    apiRequest("POST", "/api/sessions", {
      date: todayISO(),
      durationMinutes: minutes,
      asanas: JSON.stringify([active.name]),
      pathwaySlug: null,
      notes: `Pranayama: ${active.name}`,
      kind: "breathing",
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      })
      .catch(() => {});
    toast({
      title: "Breath complete 🌬️",
      description: `${active.name} logged toward your streak.`,
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

      {/* Technique selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BREATHING.map((t) => {
          const isActive = t.slug === activeSlug;
          return (
            <button
              key={t.slug}
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
                      {t.sanskrit && (
                        <p className="text-xs text-muted-foreground">{t.sanskrit}</p>
                      )}
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

      {/* Active technique */}
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

          {/* Rounds control */}
          <div className="max-w-sm space-y-2">
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

          {/* Guided audio for this technique */}
          <VoicePlayer
            src={`/voice/breath-${active.slug}.mp3`}
            slug={active.slug}
            label={`Guided audio — ${active.name}`}
          />

          {/* Visualizer (key forces a clean reset when technique/rounds change) */}
          <BreathingVisualizer
            key={`${active.slug}-${rounds}`}
            config={config}
            onComplete={onComplete}
          />

          {/* Benefits + who should avoid */}
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
