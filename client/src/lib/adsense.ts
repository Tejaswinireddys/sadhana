/**
 * AdSense loading and consent. The script is injected once, lazily — the
 * first time an eligible viewer reaches an AdSense slot — never in the HTML,
 * so guests on other pages, Plus members and ads-off deploys never load it.
 * It is cross-origin, so the service worker never caches it.
 *
 * Consent: until the viewer accepts personalized ads on the banner, every
 * request is non-personalized (`requestNonPersonalizedAds = 1`).
 */
import { KEYS, readString, removeKey, writeString } from "@/lib/localPrefs";

export type AdConsent = "personalized" | "non-personalized";
type AdsByGoogle = Array<unknown> & { requestNonPersonalizedAds?: 0 | 1 };

export const ADSENSE_SCRIPT_ORIGIN = "https://pagead2.googlesyndication.com";

export function readAdConsent(): AdConsent | null {
  const value = readString(KEYS.adConsent);
  return value === "personalized" || value === "non-personalized" ? value : null;
}

export function writeAdConsent(value: AdConsent): void {
  writeString(KEYS.adConsent, value);
  applyConsent();
  window.dispatchEvent(new Event("sadhana:ad-consent"));
}

/** Forget the choice: requests go back to non-personalized and the notice asks again. */
export function clearAdConsent(): void {
  removeKey(KEYS.adConsent);
  window.dispatchEvent(new Event("sadhana:ad-consent"));
}

/** Non-personalized unless the viewer explicitly chose personalized. */
export function nonPersonalized(consent: AdConsent | null): 0 | 1 {
  return consent === "personalized" ? 0 : 1;
}

function queue(): AdsByGoogle {
  const w = window as unknown as { adsbygoogle?: AdsByGoogle };
  w.adsbygoogle = w.adsbygoogle || ([] as unknown as AdsByGoogle);
  return w.adsbygoogle;
}

function applyConsent() {
  queue().requestNonPersonalizedAds = nonPersonalized(readAdConsent());
}

let loading: Promise<void> | null = null;

/** Inject adsbygoogle.js once for this page load. */
export function loadAdsense(clientId: string): Promise<void> {
  applyConsent();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${ADSENSE_SCRIPT_ORIGIN}/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.dataset.testid = "adsense-script";
    script.onload = () => resolve();
    script.onerror = () => { loading = null; reject(new Error("AdSense failed to load")); };
    document.head.appendChild(script);
  });
  return loading;
}

/** Ask AdSense to fill one `<ins class="adsbygoogle">` (consent applied first). */
export function requestAdFill(): void {
  applyConsent();
  queue().push({});
}
