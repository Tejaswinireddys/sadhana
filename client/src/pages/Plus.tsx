import { BILLING_ENABLED } from "@/lib/publicConfig";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, readPreferredPlan, writePreferredPlan, type PlanId } from "@/lib/plans";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { KEYS, readString, writeString } from "@/lib/localPrefs";
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
  if (!BILLING_ENABLED) return (
    <div className="space-y-4 py-8">
      <h1 className="font-serif text-3xl">Practice for free</h1>
      <p>Paid subscriptions are not available yet. You can use guest practice without a payment card.</p>
      <Button asChild><Link href="/start">Find my practice</Link></Button>
      <PlusWaitlistSignup />
    </div>
  );
  return <LivePlus />;
}

/**
 * The Plus waitlist while payments are off. Linked as /plus#waitlist from the
 * /cancel pages, so it scrolls itself into view when that is the hash.
 * A failed request says so — "you're on the list" is only shown once the
 * server has the address.
 */
function PlusWaitlistSignup() {
  const { toast } = useToast();
  const sectionRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(() => !!readString(KEYS.plusWaitlist));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#waitlist") sectionRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/plus-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: "Could not join", description: data.error, variant: "destructive" });
        return;
      }
      writeString(KEYS.plusWaitlist, value);
      setJoined(true);
    } catch {
      toast({
        title: "Could not join",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="waitlist"
      className="scroll-mt-20 space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft"
      data-testid="plus-waitlist"
    >
      <h2 className="font-serif text-xl">Sadhana Plus waitlist</h2>
      {joined ? (
        <p className="text-sm" data-testid="plus-waitlist-success">
          You&apos;re on the Plus waitlist. We&apos;ll email you once when Plus opens. Nothing is
          charged.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Plus isn&apos;t on sale yet. Leave your email and we&apos;ll tell you when it is — that
            is the only thing we use it for.
          </p>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={join}>
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11"
              aria-label="Email for the Plus waitlist"
              data-testid="plus-waitlist-email"
            />
            <Button type="submit" className="min-h-11" disabled={busy} data-testid="plus-waitlist-join">
              {busy ? "Joining…" : "Join waitlist"}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}

function LivePlus() {
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
  const { data: entitlement } = useQuery<Entitlement & { status?: string }>({
    queryKey: ["/api/billing/entitlement"],
  });
  /** Same rule as Home's cancel shortcut: a live or ending paid plan. */
  const hasPaidPlan =
    !!entitlement &&
    entitlement.plan !== "free" &&
    entitlement.status !== "refunded" &&
    (entitlement.status === "active" || entitlement.status === "trialing" || !!entitlement.cancelAtPeriodEnd);

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
          <p className="text-muted-foreground" data-testid="plans-intro">
            {billing.enabled
              ? "Cancel in two taps from Home. Renewal reminder 3 days before every charge. First-charge refund within 14 days, auto-approved. The safety library stays free."
              : "Everything in the app is free today. The paid plans below are planned, not on sale — join the waitlist to hear when they are. Nothing can be charged."}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="billing-status">
            {billing.note ||
              (billing.enabled
                ? "Checkout is live."
                : "Free forever here — paid plans are on a waitlist.")}
          </p>
          <p className="text-sm">
            {BILLING_ENABLED && (<Link
              href="/cancel"
              className="font-medium underline underline-offset-2"
              data-testid="paywall-cancel-link"
            >
              How to cancel
            </Link>)}
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
                <CardTitle className="flex flex-wrap items-center gap-2 font-serif text-xl">
                  {p.name}
                  {p.status === "planned" && !billing.enabled && (
                    <span
                      className="rounded-full border border-border px-2 py-0.5 font-sans text-xs font-medium text-muted-foreground"
                      data-testid={`plan-planned-${p.id}`}
                    >
                      Planned · waitlist
                    </span>
                  )}
                </CardTitle>
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

        {billing.enabled && (
          <p className="mt-4 text-xs text-muted-foreground" data-testid="paywall-terms">
            {TERMS_DISPLAYED}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Only someone with a subscription is offered "Cancel subscription". */}
        {hasPaidPlan ? (
          <Button asChild variant="default" className="min-h-11" data-testid="plus-cancel-cta">
            {BILLING_ENABLED && (<Link href="/cancel/confirm">Cancel subscription</Link>)}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="plus-no-subscription">
            You don&apos;t have a subscription.
          </p>
        )}
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
      {billing.enabled && (
        <p className="text-sm text-muted-foreground">
          Cancel is two taps from Home. Payment-method updates use Stripe&apos;s portal — cancellation
          never requires it.
        </p>
      )}

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
        {BILLING_ENABLED && (<Link href="/cancel" className="underline underline-offset-2">
          Cancel
        </Link>)}
        .
      </p>
    </FadeIn>
  );
}
