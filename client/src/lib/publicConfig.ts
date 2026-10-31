type PublicConfig = { billingEnabled?: boolean; supportEmail?: string | null };
function readConfig(): PublicConfig {
  try {
    return JSON.parse(document.getElementById("public-config")?.textContent || "{}");
  } catch { return {}; }
}
const config = readConfig();
export const BILLING_ENABLED = config.billingEnabled === true;
export const SUPPORT_EMAIL = config.supportEmail || null;
export const ISSUE_TRACKER_URL = "https://github.com/Tejaswinireddys/sadhana/issues";
