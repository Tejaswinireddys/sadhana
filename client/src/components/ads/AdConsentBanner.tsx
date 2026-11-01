import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ADS_CONFIG } from "@/lib/publicConfig";
import { adsAllowedOnPath } from "@/lib/ads";
import { readAdConsent, writeAdConsent } from "@/lib/adsense";
import { useAdEligibility } from "@/components/ads/AdSlot";

/**
 * A small, non-blocking cookie notice for AdSense, shown only to viewers who
 * will see AdSense ads and have not chosen yet. Until they accept, ads are
 * requested non-personalized. The house provider sets no ad cookies, so it
 * never shows this.
 */
export function AdConsentBanner() {
  const [location] = useLocation();
  const eligibility = useAdEligibility();
  const [choice, setChoice] = useState(readAdConsent);
  useEffect(() => {
    const sync = () => setChoice(readAdConsent());
    window.addEventListener("sadhana:ad-consent", sync);
    return () => window.removeEventListener("sadhana:ad-consent", sync);
  }, []);
  if (ADS_CONFIG.provider !== "adsense" || eligibility !== "show" || choice || !adsAllowedOnPath(location)) return null;
  return (
    <div
      role="region"
      aria-label="Ad cookies"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-card-border bg-card p-4 text-sm shadow-soft-lg"
      data-testid="ad-consent-banner"
    >
      <p className="text-muted-foreground">
        Free Sadhana shows ads from Google, which use cookies. We ask Google for non-personalized ads unless you allow personalized ones.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="min-h-11" onClick={() => writeAdConsent("personalized")} data-testid="ad-consent-accept">
          Allow personalized ads
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => writeAdConsent("non-personalized")} data-testid="ad-consent-decline">
          Non-personalized only
        </Button>
      </div>
    </div>
  );
}
