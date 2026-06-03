import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PoseSvg } from "@/components/PoseSvg";
import { asanaBySlug } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Plus, Check, Wind, Clock, Sparkles, ShieldAlert, Settings2 } from "lucide-react";

export default function AsanaDetail() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const asana = asanaBySlug(slug || "");
  const { add, todays } = usePractice();
  const { toast } = useToast();

  if (!asana) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="Pose not found" description="That asana isn't in the library.">
          <Button asChild><Link href="/asanas">Back to library</Link></Button>
        </EmptyState>
      </div>
    );
  }

  const inToday = !!todays.find((x) => x.slug === asana.slug);

  const addToday = () => {
    add(asana);
    toast({
      title: "Added to today's practice",
      description: `${asana.english} is ready in your session.`,
    });
  };

  return (
    <article className="animate-fade-in space-y-8">
      <button
        onClick={() => navigate("/asanas")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        data-testid="link-back-asanas"
      >
        <ArrowLeft className="h-4 w-4" /> Library
      </button>

      <header className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
        <div className="flex items-center justify-center rounded-xl bg-accent/40 py-6 text-foreground/85">
          <PoseSvg pose={asana.pose} size={150} />
        </div>
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
      </header>

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
              <p className="text-sm text-muted-foreground">{asana.hold}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Steps */}
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
                  {step.pose && (
                    <span className="hidden shrink-0 text-foreground/70 sm:block">
                      <PoseSvg pose={step.pose} size={56} />
                    </span>
                  )}
                  <p className="text-sm">{step.text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Benefits + contraindications */}
      <div className="grid gap-4 md:grid-cols-2">
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
        <Card className="border-destructive/30 shadow-soft">
          <CardContent className="space-y-2 p-5">
            <h3 className="flex items-center gap-2 font-serif text-lg">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Contraindications
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {asana.contraindications.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

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
    </article>
  );
}
