import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PoseImage } from "@/components/PoseImage";
import { WARMUP, asanaBySlug } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import { Flame, Play } from "lucide-react";

export function WarmupCard() {
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();

  const startWarmup = () => {
    const poses = WARMUP.steps
      .map((s) => {
        const asana = asanaBySlug(s.asanaSlug);
        if (!asana) return null;
        return { asana, holdSeconds: s.holdSeconds, sides: s.sides };
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
          x != null,
      );
    if (!poses.length) return;
    loadSession(poses, { label: WARMUP.title, pathwaySlug: null });
    navigate("/guided");
  };

  return (
    <Card className="border-primary/30 bg-accent/40 shadow-soft" data-testid="card-warmup">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              <h3 className="font-serif text-lg">{WARMUP.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{WARMUP.description}</p>
          </div>
          <Button
            className="shrink-0 gap-1.5"
            onClick={startWarmup}
            data-testid="button-start-warmup"
          >
            <Play className="h-4 w-4" /> Start warm-up
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WARMUP.steps.map((s) => (
            <div
              key={s.asanaSlug}
              className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
            >
              <span className="h-12 w-12 shrink-0">
                <PoseImage
                  slug={s.asanaSlug}
                  alt={s.name}
                  rounded="rounded-lg"
                  aspect="aspect-square"
                  breath={false}
                  shadow={false}
                  testId={`warmup-img-${s.asanaSlug}`}
                />
              </span>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
