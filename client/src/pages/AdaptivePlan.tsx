import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateAdaptiveSession, pickEasierSwap, swapPose } from "@/lib/adaptiveGenerator";
import { adviseNextSession, readOutcomes } from "@/lib/adaptiveRecovery";
import { usePractice } from "@/context/PracticeContext";
import { asanaBySlug } from "@/data/content";
import { track } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import type { Journal, Session } from "@shared/schema";

function poseKey(slugs: string[]): string {
  return slugs.join(",");
}

export default function AdaptivePlan() {
  useDocumentTitle("Today's adaptive plan · Sadhana");
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const { toast } = useToast();
  const { data: sessions, isPending: sessionsPending } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });
  const { data: journal, isPending: journalPending } = useQuery<Journal[]>({
    queryKey: ["/api/journal"],
  });
  const historyReady = !sessionsPending && !journalPending;
  const sessionIds = (sessions ?? []).map((s) => s.id).join(",");
  const journalIds = (journal ?? []).map((j) => j.id).join(",");

  const [minutes, setMinutes] = useState(20);
  const [variant, setVariant] = useState(0);
  const [locked, setLocked] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof generateAdaptiveSession> | null>(null);
  // Number, not a boolean — a stale `minutes` closure in the history effect
  // was rebuilding the 15-minute suggestion while the chip stayed on 20/25.
  const pickedMinutesRef = useRef<number | null>(null);

  const build = (mins: number, v: number, lockSlugs = locked) => {
    const advice = adviseNextSession(readOutcomes(), {
      sessions: sessions ?? [],
      journal: journal ?? [],
    });
    return generateAdaptiveSession({
      intentMinutes: mins,
      lockSlugs,
      variant: v,
      adviceOverride: advice,
      soreParts: advice.soreParts,
      energy: advice.energy,
    });
  };

  const pickMinutes = (m: number) => {
    pickedMinutesRef.current = m;
    setMinutes(m);
    setVariant(0);
    setResult(build(m, 0));
  };

  useEffect(() => {
    if (!historyReady) return;
    const advice = adviseNextSession(readOutcomes(), {
      sessions: sessions ?? [],
      journal: journal ?? [],
    });
    const mins = pickedMinutesRef.current ?? advice.maxMinutes;
    if (pickedMinutesRef.current == null) setMinutes(advice.maxMinutes);
    setVariant(0);
    setResult(
      generateAdaptiveSession({
        intentMinutes: mins,
        variant: 0,
        adviceOverride: advice,
        soreParts: advice.soreParts,
        energy: advice.energy,
      }),
    );
  }, [historyReady, sessionIds, journalIds]);

  const regenerate = () => {
    if (!result) return;
    const current = poseKey(result.session.poses.map((p) => p.slug));
    let nextVariant = variant + 1;
    let next = build(minutes, nextVariant);
    for (let i = 0; i < 8 && poseKey(next.session.poses.map((p) => p.slug)) === current; i++) {
      nextVariant += 1;
      next = build(minutes, nextVariant);
    }
    setVariant(nextVariant);
    setResult(next);
    const changed = poseKey(next.session.poses.map((p) => p.slug)) !== current;
    toast({
      title: changed ? "New sequence" : "That's the only safe sequence at this length",
    });
    track("practice_start", { source: "adaptive_regenerate" });
  };

  const start = () => {
    if (!result) return;
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

  if (!result) {
    return (
      <FadeIn className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <Badge variant="outline">Explainable · safety-first</Badge>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Today's adaptive plan</h1>
          <p className="text-muted-foreground">Reading your recent practice and journal…</p>
        </header>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Badge variant="outline">Explainable · safety-first</Badge>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{result.advice.headline}</h1>
        <p className="text-muted-foreground">
          Hard contraindications always win. Lock keeps a pose when you regenerate. Unlock it
          before swapping to an easier pose.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Why this plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground" data-testid="adaptive-reasons">
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
            data-testid={`adaptive-minutes-${m}`}
            onClick={() => pickMinutes(m)}
          >
            {m} min
          </Button>
        ))}
        <Button
          variant="outline"
          className="min-h-11"
          onClick={regenerate}
          data-testid="adaptive-regenerate"
        >
          Regenerate
        </Button>
      </div>
      {(result.advice.intensity === "easy" || result.advice.intensity === "recover") &&
        minutes <= result.advice.maxMinutes &&
        result.advice.maxMinutes < 25 && (
          <p className="text-sm text-muted-foreground" data-testid="adaptive-duration-override">
            Easing today after some skipped poses — suggested {result.advice.maxMinutes} min.{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => pickMinutes(25)}
              data-testid="adaptive-use-longer"
            >
              Use 25 anyway?
            </button>
          </p>
        )}

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
                      data-testid={`adaptive-lock-${p.slug}`}
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
                      disabled={isLocked}
                      title={
                        isLocked
                          ? "Unlock this pose to swap it. Lock only keeps it when you regenerate."
                          : "Replace with an easier pose that is not already in this plan"
                      }
                      data-testid={`adaptive-swap-${p.slug}`}
                      onClick={() => {
                        if (isLocked) {
                          toast({
                            title: "Unlock this pose first",
                            description: "Lock only keeps the pose when you regenerate.",
                          });
                          return;
                        }
                        const used = result.session.poses.map((x) => x.slug);
                        const alt = pickEasierSwap(p.slug, used);
                        if (!alt) {
                          toast({
                            title: "No unused easier pose",
                            description: "Every restful swap is already in this plan.",
                          });
                          return;
                        }
                        const swapped = swapPose(result.session, p.slug, alt);
                        if (swapped) {
                          setResult((r) =>
                            r
                              ? {
                                  ...r,
                                  session: swapped.session,
                                  explanations: [...r.explanations, swapped.explanation],
                                }
                              : r,
                          );
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
