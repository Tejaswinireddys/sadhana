import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateAdaptiveSession, swapPose } from "@/lib/adaptiveGenerator";
import { adviseNextSession } from "@/lib/adaptiveRecovery";
import { usePractice } from "@/context/PracticeContext";
import { asanaBySlug } from "@/data/content";
import { track } from "@/lib/analytics";

export default function AdaptivePlan() {
  useDocumentTitle("Today's adaptive plan · Sadhana");
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const advice = useMemo(() => adviseNextSession(), []);
  const [minutes, setMinutes] = useState(advice.maxMinutes);
  const [result, setResult] = useState(() =>
    generateAdaptiveSession({ intentMinutes: advice.maxMinutes }),
  );
  const [locked, setLocked] = useState<string[]>([]);

  const regenerate = (mins = minutes) => {
    const next = generateAdaptiveSession({
      intentMinutes: mins,
      lockSlugs: locked,
    });
    setResult(next);
    track("practice_start", { source: "adaptive_preview" });
  };

  const start = () => {
    const poses = result.session.poses
      .map((p) => {
        const asana = asanaBySlug(p.slug);
        return asana
          ? { asana, holdSeconds: p.holdSeconds, sides: p.sides }
          : null;
      })
      .filter(
        (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
          x != null,
      );
    loadSession(poses, {
      label: result.advice.headline,
      pathwaySlug: null,
    });
    navigate("/guided");
  };

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Badge variant="outline">Explainable · safety-first</Badge>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{result.advice.headline}</h1>
        <p className="text-muted-foreground">
          Hard contraindications always win. You can swap or lock poses before starting.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Why this plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.explanations.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {result.safetyExclusions.length > 0 && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">Excluded for safety / preference</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {result.safetyExclusions.map((x) => (
                  <li key={x.slug}>
                    {x.slug}: {x.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {[10, 15, 20, 25].map((m) => (
          <Button
            key={m}
            size="sm"
            className="min-h-11"
            variant={minutes === m ? "default" : "outline"}
            onClick={() => {
              setMinutes(m);
              regenerate(m);
            }}
          >
            {m} min
          </Button>
        ))}
        <Button variant="outline" className="min-h-11" onClick={() => regenerate()}>
          Regenerate
        </Button>
      </div>

      <ul className="space-y-3">
        {result.session.poses.map((p) => {
          const asana = asanaBySlug(p.slug);
          const isLocked = locked.includes(p.slug);
          return (
            <li key={p.slug}>
              <Card className="shadow-soft">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{asana?.english ?? p.slug}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.holdSeconds}s · {p.sides} · {p.why}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="min-h-11"
                      variant={isLocked ? "default" : "outline"}
                      onClick={() =>
                        setLocked((L) =>
                          isLocked ? L.filter((s) => s !== p.slug) : [...L, p.slug],
                        )
                      }
                    >
                      {isLocked ? "Locked" : "Lock"}
                    </Button>
                    <Button
                      size="sm"
                      className="min-h-11"
                      variant="outline"
                      asChild
                    >
                      <Link href={`/asanas/${p.slug}`}>Details</Link>
                    </Button>
                    <Button
                      size="sm"
                      className="min-h-11"
                      variant="ghost"
                      onClick={() => {
                        const alt = "balasana";
                        const swapped = swapPose(result.session, p.slug, alt);
                        if (swapped) {
                          setResult((r) => ({
                            ...r,
                            session: swapped.session,
                            explanations: [...r.explanations, swapped.explanation],
                          }));
                        }
                      }}
                    >
                      Swap easier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Button className="min-h-11 w-full" onClick={start} data-testid="adaptive-start">
        Begin this practice
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/pose-coach" className="underline underline-offset-2">
          Optional pose self-check
        </Link>{" "}
        · not medical care
      </p>
    </FadeIn>
  );
}
