import { parseAdsConfig } from "@shared/adsConfig";

type PublicConfig = { billingEnabled?: boolean; stripeMode?: unknown; supportEmail?: string | null; ads?: unknown };
function readConfig(): PublicConfig {
  try {
    return JSON.parse(document.getElementById("public-config")?.textContent || "{}");
  } catch { return {}; }
}
const config = readConfig();
export const BILLING_ENABLED = config.billingEnabled === true;
/** The server's STRIPE_MODE. Anything but an explicit "live" reads as test, so test wording is the safe default. */
export const STRIPE_MODE: "test" | "live" = config.stripeMode === "live" ? "live" : "test";
export const SUPPORT_EMAIL = config.supportEmail || null;
/** Free-tier ad settings from server env (off unless ADS_ENABLED=true). */
export const ADS_CONFIG = parseAdsConfig(config.ads);
export const ISSUE_TRACKER_URL = "https://github.com/Tejaswinireddys/sadhana/issues";
