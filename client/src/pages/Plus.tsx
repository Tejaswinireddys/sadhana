import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, readPreferredPlan, writePreferredPlan, type PlanId } from "@/lib/plans";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { captureProduct, readRememberedFlowId } from "@/lib/productAnalytics";
import { readUrlParam } from "@/lib/hashQuery";

type BillingConfig = {
  enabled: boolean;
  note: string;
  portalAvailable?: boolean;
  termsVersion?: string;
};

type Entitlement = {
  plan: string;
  cancelAtPeriodEnd?: boolean;
  accessUntil?: string | null;
  refundEligible?: boolean;
  refundedAt?: string | null;
};

const TERMS_DISPLAYED = [
  "Subscription renews automatically until you cancel.",
  "Cancel anytime in two taps from the app home — no chat, phone, or email required.",
  "You keep access until the end of the paid period after canceling.",
  "We email a renewal reminder 3 days before every charge (monthly and annual).",
  "First charge: self-serve refund within 14 days, auto-approved.",
  "No retention interstitials, countdown discounts, or dark patterns.",
].join(" ");

function priceDisplayed(id: PlanId, interval: "month" | "year"): string {
  const p = PLANS.find((x) => x.id === id);
  if (!p || p.monthlyUsd === 0) return "Free";
  return interval === "year" ? `$${p.yearlyUsd}/yr` : `$${p.monthlyUsd}/mo`;
}

export default function Plus() {
  useDocumentTitle("Sadhana Plus · Plans");
  const { toast } = useToast();
  const qc = useQueryClient();
  const paywallRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PlanId>(() => readPreferredPlan());
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [billing, setBilling] = useState<BillingConfig>({ enabled: false, note: "" });
  const [busy, setBusy] = useState(false);

  const paywallTracked = useRef(false);
  const flowId = readRememberedFlowId() || "plus_page";
  const { data: entitlement } = useQuery<Entitlement>({
    queryKey: ["/api/billing/entitlement"],
  });

  useEffect(() => {
    void fetch("/api/billing/config")
      .then((r) => r.json())
      .then((c: BillingConfig) => setBilling(c))
      .catch(() => setBilling({ enabled: false, note: "Billing unavailable right now." }));
  }, []);

  useEffect(() => {
    if (paywallTracked.current) return;
    paywallTracked.current = true;
    const preferred = PLANS.find((p) => p.id === plan && p.id !== "free") ?? PLANS.find((p) => p.id === "plus")!;
    void captureProduct("paywall_viewed", {
      flow_id: flowId,
      price_shown: interval === "year" ? preferred.yearlyUsd : preferred.monthlyUsd,
      currency: "USD",
    });
    const checkout = readUrlParam("checkout");
    if (checkout === "success") {
      toast({
        title: "Welcome to Sadhana Plus",
        description: "Your subscription is active. Cancel anytime from Manage subscription.",
      });
    }
  }, [flowId, interval, plan, toast]);

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
        title: "You're on the waitlist",
        description:
          "Paid plans aren't open yet, so nothing was purchased and you won't be charged. We'll note your interest and keep your free practice going.",
      });
      return;
    }
    void captureProduct("checkout_started", { flow_id: flowId, plan: id });
    setBusy(true);
    try {
      const p = PLANS.find((x) => x.id === id)!;
      const amount = interval === "year" ? p.yearlyUsd : p.monthlyUsd;
      const paywallHtml = paywallRef.current?.outerHTML || document.body.innerHTML;
      const consentRes = await fetch("/api/billing/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: id,
          interval,
          amount,
          currency: "USD",
          priceDisplayed: priceDisplayed(id, interval),
          termsDisplayed: TERMS_DISPLAYED,
          termsVersion: billing.termsVersion,
          paywallHtml,
        }),
      });
      if (!consentRes.ok) {
        const c = (await consentRes.json()) as { error?: string };
        toast({
          title: "Could not record consent",
          description: c.error || "Try again.",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: id, interval, flow_id: flowId }),
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
          title: "Manage payment method",
          description: data.hint || data.error || "Subscribe once to update your card.",
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

  const requestRefund = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/refund-first-charge", { method: "POST" });
      const data = (await res.json()) as { error?: string; hint?: string; message?: string };
      if (!res.ok) {
        toast({
          title: "Refund unavailable",
          description: data.hint || data.error || "Outside the 14-day first-charge window.",
          variant: "destructive",
        });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["/api/billing/entitlement"] });
      toast({ title: "Refund auto-approved", description: data.message });
    } catch {
      toast({ title: "Network error", description: "Could not request refund." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6 py-2">
      <div ref={paywallRef} data-testid="paywall-root">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Plans</h1>
          <p className="text-muted-foreground">
            Transparent tiers. Cancel in two taps from Home. Renewal reminder 3 days before every
            charge. First-charge refund within 14 days, auto-approved. Safety library stays free.
          </p>
          <p className="text-xs text-muted-foreground" data-testid="billing-status">
            {billing.note ||
              (billing.enabled
                ? "Checkout is live."
                : "Free forever on this deployment until paid checkout is configured.")}
          </p>
          <p className="text-sm">
            <Link
              href="/cancel"
              className="font-medium underline underline-offset-2"
              data-testid="paywall-cancel-link"
            >
              How to cancel
            </Link>
            {" · "}
            no chat, no phone, no retention screens.
          </p>
        </header>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Billing interval">
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

        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
                        ? "On the waitlist"
                        : "Join waitlist"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground" data-testid="paywall-terms">
          {TERMS_DISPLAYED}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="default" className="min-h-11" data-testid="plus-cancel-cta">
          <Link href="/cancel/confirm">Cancel subscription</Link>
        </Button>
        {billing.enabled && billing.portalAvailable && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void openPortal()}
            data-testid="billing-portal"
          >
            Update payment method
          </Button>
        )}
        {entitlement?.refundEligible && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void requestRefund()}
            data-testid="button-request-refund"
          >
            Request a refund
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Cancel is two taps from Home. Payment-method updates use Stripe&apos;s portal — cancellation
        never requires it.
      </p>

      <p className="text-xs text-muted-foreground">
        See{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
        ,{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        , and{" "}
        <Link href="/cancel" className="underline underline-offset-2">
          Cancel
        </Link>
        .
      </p>
    </FadeIn>
  );
}
