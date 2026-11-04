import { isStripeKeyForMode, stripeConfig, stripeMode } from "./stripeConfig";
import { adsConfigFromEnv } from "../shared/adsConfig";
/** Public, non-secret launch settings embedded into the HTML response. */
export function billingEnabled(): boolean {
  const { secretKey, mode } = stripeConfig();
  return process.env.BILLING_ENABLED === "true" && isStripeKeyForMode(secretKey, mode);
}
export function publicConfig() {
  const email = process.env.SUPPORT_EMAIL?.trim() ?? "";
  return {
    billingEnabled: billingEnabled(),
    /** Drives "test mode" wording; never a secret. */
    stripeMode: stripeMode(),
    supportEmail: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null,
    ads: adsConfigFromEnv(process.env),
  };
}
export function publicConfigHtml(): string {
  return `<script type="application/json" id="public-config">${JSON.stringify(publicConfig()).replace(/</g, "\\u003c")}</script>`;
}
