import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, readPreferredPlan, writePreferredPlan, type PlanId } from "@/lib/plans";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

export default function Plus() {
  useDocumentTitle("Sadhana Plus · Plans");
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanId>(() => readPreferredPlan());

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6 py-2">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="text-muted-foreground">
          Transparent tiers. Payments are not connected yet — choose a preference so we know what to
          build next. Safety library, captions, and basic modifications stay free forever.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card
            key={p.id}
            className={plan === p.id ? "border-primary shadow-soft" : "shadow-soft"}
            data-testid={`plan-card-${p.id}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-xl">{p.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {p.monthlyUsd === 0
                  ? "Free"
                  : `$${p.monthlyUsd}/mo or $${p.yearlyUsd}/yr`}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="min-h-11 w-full"
                variant={plan === p.id ? "default" : "outline"}
                onClick={() => {
                  writePreferredPlan(p.id);
                  setPlan(p.id);
                  toast({
                    title: p.id === "free" ? "Staying on Free" : `${p.name} preference saved`,
                    description:
                      p.id === "free"
                        ? "You can keep practising with the full safety library."
                        : "Checkout will appear here when billing is enabled — no charge today.",
                  });
                }}
                data-testid={`plan-select-${p.id}`}
              >
                {plan === p.id ? "Selected" : p.id === "free" ? "Continue free" : "Notify me"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        See{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        . Cancel anytime once paid billing ships — no dark patterns.
      </p>
    </FadeIn>
  );
}
