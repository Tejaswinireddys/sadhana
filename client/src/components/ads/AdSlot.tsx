import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { AdPlacement } from "@shared/adsConfig";
import { useAuth } from "@/lib/auth";
import { ADS_CONFIG } from "@/lib/publicConfig";
import { adEligibility, adsAllowedOnPath, type AdEligibility } from "@/lib/ads";
import type { PlusEntitlementView } from "@/lib/plusStatus";
import { loadAdsense, requestAdFill } from "@/lib/adsense";
import { cn } from "@/lib/utils";

/**
 * Whether this viewer should see ads: the `/plus` entitlement plus the
 * account's plan. Nothing is fetched when ads are off.
 */
export function useAdEligibility(): AdEligibility {
  const { user, isLoading } = useAuth();
  const entitlement = useQuery<PlusEntitlementView>({
    queryKey: ["/api/billing/entitlement"],
    staleTime: 0,
    refetchOnMount: "always",
    enabled: ADS_CONFIG.enabled,
  });
  return adEligibility({
    ads: ADS_CONFIG,
    user: isLoading ? undefined : user,
    entitlement: entitlement.data,
    entitlementError: entitlement.isError,
  });
}

type BillingConfig = { enabled?: boolean; prices?: Record<"month" | "year", { amount: number; currency: string }> };

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch { return `$${amount}`; }
}

/**
 * Our own card until AdSense is approved. Prices come from Stripe's
 * configured prices (what Checkout would charge), never from copy here; when
 * they are unavailable the card names no price rather than a stale one.
 */
function HouseAd() {
  const { data } = useQuery<BillingConfig>({ queryKey: ["/api/billing/config"], staleTime: 10 * 60_000 });
  const prices = data?.enabled ? data.prices : undefined;
  return (
    <Link
      href="/plus"
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="ad-house"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">Go ad-free with Sadhana Plus</span>
        <span className="block text-sm text-muted-foreground" data-testid="ad-house-price">
          {prices
            ? `${money(prices.month.amount, prices.month.currency)}/mo or ${money(prices.year.amount, prices.year.currency)}/yr`
            : "Every class, no ads."}
        </span>
      </span>
    </Link>
  );
}

function AdsenseUnit({ clientId, slotId }: { clientId: string; slotId: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    let live = true;
    loadAdsense(clientId).then(() => {
      if (!live || pushed.current) return;
      pushed.current = true;
      requestAdFill();
    }).catch(() => undefined);
    return () => { live = false; };
  }, [clientId]);
  return (
    <ins
      className="adsbygoogle block min-h-[90px]"
      style={{ display: "block" }}
      data-ad-client={clientId}
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
      data-testid="ad-adsense"
    />
  );
}

/**
 * One calm ad slot: labelled "Ad", with "Remove ads" to /plus. Renders nothing
 * — no box, no script — when ads are off, the viewer is Plus, their plan is
 * not known yet, or the page is one that never carries ads.
 */
export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const [location] = useLocation();
  const eligibility = useAdEligibility();
  if (eligibility !== "show" || !adsAllowedOnPath(location)) return null;
  const slotId = ADS_CONFIG.provider === "adsense" ? ADS_CONFIG.slots[placement] : undefined;
  return (
    <aside
      aria-label="Advertisement"
      className={cn("space-y-1.5", className)}
      data-testid={`ad-slot-${placement}`}
      data-provider={slotId ? "adsense" : "house"}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="rounded border border-border px-1.5 py-0.5 font-medium uppercase tracking-wide" data-testid="ad-label">Ad</span>
        <Link href="/plus" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline" data-testid="ad-remove">
          Remove ads
        </Link>
      </div>
      {slotId && ADS_CONFIG.adsenseClientId
        ? <AdsenseUnit clientId={ADS_CONFIG.adsenseClientId} slotId={slotId} />
        : <HouseAd />}
    </aside>
  );
}
