import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, readPreferredPlan, writePreferredPlan, type PlanId } from "@/lib/plans";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

type BillingConfig = {
  enabled: boolean;
  note: string;
  portalAvailable?: boolean;
};

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
        title: `${PLANS.find((p) => p.id === id)?.name} selected`,
        description:
          "Paid checkout is not active on this deployment yet. Free practice continues — you will not be charged.",
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

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string; hint?: string };
      if (!res.ok || !data.url) {
        toast({
          title: "Manage subscription",
          description: data.hint || data.error || "Subscribe once to unlock the cancel portal.",
          variant: "destructive",
        });
        return;
      }
      window.location.href = data.url;
    } catch {
      toast({ title: "Network error", description: "Could not open the billing portal." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6 py-2">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="text-muted-foreground">
          The privacy-first yoga app that never shames you for missing a day — with billing that
          matches that promise. Transparent tiers. Cancel anytime. Safety library, captions, and
          guest practice stay free forever.
        </p>
        <p className="text-xs text-muted-foreground" data-testid="billing-status">
          {billing.note ||
            (billing.enabled
              ? "Checkout is live."
              : "Free forever on this deployment until paid checkout is configured.")}
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
                      ? "Selected"
                      : `Choose ${p.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {billing.enabled && billing.portalAvailable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void openPortal()}
            data-testid="billing-portal"
          >
            Manage subscription / cancel
          </Button>
          <p className="text-sm text-muted-foreground">
            One-click cancel in Stripe&apos;s customer portal — no chatbots, no dark patterns.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        See{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        for fair-billing commitments.
      </p>
    </FadeIn>
  );
}
