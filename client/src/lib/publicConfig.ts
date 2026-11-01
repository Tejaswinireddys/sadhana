import { parseAdsConfig } from "@shared/adsConfig";

type PublicConfig = { billingEnabled?: boolean; supportEmail?: string | null; ads?: unknown };
function readConfig(): PublicConfig {
  try {
    return JSON.parse(document.getElementById("public-config")?.textContent || "{}");
  } catch { return {}; }
}
const config = readConfig();
export const BILLING_ENABLED = config.billingEnabled === true;
export const SUPPORT_EMAIL = config.supportEmail || null;
/** Free-tier ad settings from server env (off unless ADS_ENABLED=true). */
export const ADS_CONFIG = parseAdsConfig(config.ads);
export const ISSUE_TRACKER_URL = "https://github.com/Tejaswinireddys/sadhana/issues";
