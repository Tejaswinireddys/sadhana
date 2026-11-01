import { BILLING_ENABLED } from "@/lib/publicConfig";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, readPreferredPlan, writePreferredPlan, type PlanId } from "@/lib/plans";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AUTH_QUERY_KEY, authErrorMessage, type AuthState } from "@/lib/auth";
import { Check } from "lucide-react";
import { captureProduct, readRememberedFlowId } from "@/lib/productAnalytics";
import { readUrlParam } from "@/lib/hashQuery";
import {
  CHECKOUT_POLL_WINDOW_MS,
  checkoutPollInterval,
  hasPaidPlan as paidPlan,
  plusStatus,
  plusStatusMessage,
  type PlusEntitlementView,
} from "@/lib/plusStatus";

type BillingConfig = {
  enabled: boolean;
  prices?: Record<"month" | "year", { amount: number; currency: string }>;
  note: string;
  portalAvailable?: boolean;
  termsVersion?: string;
};

type Entitlement = PlusEntitlementView & {
  refundEligible?: boolean;
  refundedAt?: string | null;
};

const ENTITLEMENT_QUERY_KEY = ["/api/billing/entitlement"];

const TERMS_DISPLAYED = [
  "Subscription renews automatically until you cancel.",
  "Cancel anytime in two taps from the app home — no chat, phone, or email required.",
  "You keep access until the end of the paid period after canceling.",
  "We email a renewal reminder 3 days before every charge (monthly and annual).",
  "First charge: self-serve refund within 14 days, auto-approved.",
  "No retention interstitials, countdown discounts, or dark patterns.",
].join(" ");

export default function Plus() {
  return <LivePlus />;
}

function LivePlus() {
  useDocumentTitle("Sadhana Plus · Plans");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const paywallRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PlanId>(() => readPreferredPlan());
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [billing, setBilling] = useState<BillingConfig>({ enabled: false, note: "" });
  const [busy, setBusy] = useState(false);
  const [confirmationDeadline] = useState(() => Date.now() + CHECKOUT_POLL_WINDOW_MS);
  const returnedFromCheckout = readUrlParam("checkout") === "success";
  // Returning from Stripe Checkout or the portal lands on a cached page, so
  // session and subscription are always refetched on mount and on focus.
  const { data: auth, isLoading: authLoading, isFetching: authFetching } = useQuery<AuthState>({
    queryKey: AUTH_QUERY_KEY,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (query) => checkoutPollInterval({
      returnedFromCheckout, plan: query.state.data?.user?.plan, now: Date.now(), deadline: confirmationDeadline,
    }),
  });

  const paywallTracked = useRef(false);
  const flowId = readRememberedFlowId() || "plus_page";
  const { data: entitlement, isFetching: entitlementFetching } = useQuery<Entitlement>({
    queryKey: ENTITLEMENT_QUERY_KEY,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: () => checkoutPollInterval({
      returnedFromCheckout, plan: auth?.user?.plan, now: Date.now(), deadline: confirmationDeadline,
    }),
  });
  const hasPaidPlan = paidPlan(auth?.user, entitlement);
  const status = plusStatus({
    user: auth === undefined ? undefined : auth.user ?? null,
    authFetching,
    entitlement,
    entitlementFetching,
    returnedFromCheckout,
    awaitingConfirmation: checkoutPollInterval({
      returnedFromCheckout, plan: auth?.user?.plan, now: Date.now(), deadline: confirmationDeadline,
    }) !== false,
  });
  const canceling = status.kind === "plus-canceling";

  // The entitlement poll may have landed just before the webhook committed;
  // once polling sees Plus, read the subscription details once more.
  const plusConfirmed = returnedFromCheckout && auth?.user?.plan === "plus";
  useEffect(() => {
    if (plusConfirmed) void qc.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
  }, [plusConfirmed, qc]);

  // A back/forward-cache restore (Back from Stripe) fires neither mount nor
  // focus, so refetch explicitly.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      void qc.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [qc]);

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
        title: "Checkout completed",
        description: "Confirming your subscription. Plus access starts after Stripe confirms it.",
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
    if (!auth?.user) {
      navigate("/account?tab=create");
      return;
    }
    if (!auth.user.emailVerified) {
      navigate(`/verify?email=${encodeURIComponent(auth.user.email)}`);
      return;
    }
    if (!billing.enabled || !billing.prices) {
      toast({ title: "Checkout unavailable", description: "Stripe test billing is not configured." });
      return;
    }
    void captureProduct("checkout_started", { flow_id: flowId, plan: id });
    setBusy(true);
    try {
      const { amount, currency } = billing.prices[interval];
      const paywallHtml = paywallRef.current?.outerHTML || document.body.innerHTML;
      const consentRes = await apiRequest("POST", "/api/billing/consent", {
          plan: id,
          interval,
          amount,
          currency,
          priceDisplayed: `${currency} ${amount}/${interval}`,
          termsDisplayed: TERMS_DISPLAYED,
          termsVersion: billing.termsVersion,
          paywallHtml,
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

      const res = await apiRequest("POST", "/api/billing/checkout", { plan: id, interval });
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
    } catch (error) {
      toast({ title: "Checkout unavailable", description: authErrorMessage(error, "Could not start checkout."), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/billing/portal");
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
    } catch (error) {
      toast({ title: "Portal unavailable", description: authErrorMessage(error, "Could not open the billing portal.") });
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
      void qc.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      toast({ title: "Refund auto-approved", description: data.message });
    } catch {
      toast({ title: "Network error", description: "Could not request refund." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6 py-2">
      <div ref={paywallRef} id="waitlist" data-testid="paywall-root">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Plans</h1>
          <p className="text-muted-foreground" data-testid="plans-intro">
            {billing.enabled
              ? "Cancel in two taps from Home. Renewal reminder 3 days before every charge. First-charge refund within 14 days, auto-approved. The safety library stays free."
              : "Plus subscriptions use Stripe test mode. Checkout is unavailable until test billing is configured."}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="billing-status">
            {billing.note ||
              (billing.enabled
                ? "Checkout is live."
                : "Stripe test billing is not configured.")}
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
          {PLANS.filter((p) => p.id !== "coach").map((p) => (
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
                      Test subscriptions
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {p.monthlyUsd === 0
                    ? "Free"
                    : interval === "year"
                      ? `$${billing.prices?.year.amount ?? p.yearlyUsd}/yr`
                      : `$${billing.prices?.month.amount ?? p.monthlyUsd}/mo`}
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
                  disabled={busy || authLoading || (p.id !== "free" && (hasPaidPlan || (!!auth?.user?.emailVerified && !billing.enabled)))}
                  onClick={() => void selectPlan(p.id)}
                  data-testid={`plan-select-${p.id}`}
                >
                  {p.id === "free"
                    ? plan === "free"
                      ? "Selected"
                      : "Continue free"
                    : "Subscribe"}
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

      <p
        className="text-sm"
        role="status"
        aria-busy={status.kind === "loading" || status.kind === "awaiting-confirmation"}
        data-testid="plus-account-status"
        data-status={status.kind}
      >
        {plusStatusMessage(status)}
      </p>
      {status.kind === "signed-out" && <Link href="/account" className="underline" data-testid="plus-sign-in">Sign in to subscribe</Link>}
      <div className="flex flex-wrap items-center gap-3">
        {/* Only someone with a subscription is offered "Cancel subscription";
            one already ending is sent to the portal to manage it instead. */}
        {status.kind === "loading" || status.kind === "awaiting-confirmation" || canceling ? null : hasPaidPlan ? (
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
            {canceling ? "Manage subscription" : "Manage / cancel subscription"}
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
          Cancel is two taps from Home. You can also manage or cancel your subscription in Stripe&apos;s test portal.
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
