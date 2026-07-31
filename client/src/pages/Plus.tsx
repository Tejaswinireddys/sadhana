import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, readPreferredPlan, writePreferredPlan, type PlanId } from "@/lib/plans";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

type BillingConfig = { enabled: boolean; note: string; cancelUrl?: string };

export default function Plus() {
  useDocumentTitle("Sadhana Plus · Plans");
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanId>(() => readPreferredPlan());
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [billing, setBilling] = useState<BillingConfig>({ enabled: false, note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/billing/config")
      .then((r) => r.json())
      .then((c: BillingConfig) => setBilling(c))
      .catch(() => setBilling({ enabled: false, note: "Billing unavailable right now." }));
  }, []);

  const selectPlan = async (id: PlanId) => {
    writePreferredPlan(id);
    setPlan(id);
    if (id === "free") {
      toast({
        title: "Staying on Free",
        description: "Safety library, captions, and guest practice stay free forever.",
      });
      return;
    }
    if (!billing.enabled) {
      toast({
        title: `${PLANS.find((p) => p.id === id)?.name} preference saved`,
        description:
          "Checkout turns on when Stripe keys are configured — no charge and no dark patterns today.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: id, interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string; hint?: string };
      if (!res.ok || !data.url) {
        toast({
          title: "Checkout unavailable",
          description: data.hint || data.error || "Try again later.",
          variant: "destructive",
        });
        return;
      }
      window.location.href = data.url;
    } catch {
      toast({ title: "Network error", description: "Could not start checkout.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6 py-2">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="text-muted-foreground">
          Transparent tiers. Clear cancel path. Safety library, captions, and basic modifications stay
          free forever — we refuse the category&apos;s dark-pattern billing playbook.
        </p>
        <p className="text-xs text-muted-foreground" data-testid="billing-status">
          {billing.note || (billing.enabled ? "Checkout is live." : "Billing keys not set — preference only.")}
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Billing interval">
        <Button
          size="sm"
          className="min-h-11"
          variant={interval === "month" ? "default" : "outline"}
          onClick={() => setInterval("month")}
        >
          Monthly
        </Button>
        <Button
          size="sm"
          className="min-h-11"
          variant={interval === "year" ? "default" : "outline"}
          onClick={() => setInterval("year")}
        >
          Yearly
        </Button>
      </div>

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
                  : interval === "year"
                    ? `$${p.yearlyUsd}/yr`
                    : `$${p.monthlyUsd}/mo`}
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
                disabled={busy}
                onClick={() => void selectPlan(p.id)}
                data-testid={`plan-select-${p.id}`}
              >
                {p.id === "free"
                  ? plan === "free"
                    ? "Selected"
                    : "Continue free"
                  : billing.enabled
                    ? `Subscribe · ${p.name}`
                    : plan === p.id
                      ? "Preference saved"
                      : "Notify me"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {billing.enabled && billing.cancelUrl && (
        <p className="text-sm text-muted-foreground">
          Cancel anytime via the{" "}
          <a href={billing.cancelUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Stripe customer portal
          </a>
          .
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        See{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        .
      </p>
    </FadeIn>
  );
}
