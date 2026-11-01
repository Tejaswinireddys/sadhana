import { isStripeTestKey } from "./stripePlus";
import { adsConfigFromEnv } from "../shared/adsConfig";
/** Public, non-secret launch settings embedded into the HTML response. */
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true" && isStripeTestKey(process.env.STRIPE_SECRET_KEY || "");
}
export function publicConfig() {
  const email = process.env.SUPPORT_EMAIL?.trim() ?? "";
  return {
    billingEnabled: billingEnabled(),
    supportEmail: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null,
    ads: adsConfigFromEnv(process.env),
  };
}
export function publicConfigHtml(): string {
  return `<script type="application/json" id="public-config">${JSON.stringify(publicConfig()).replace(/</g, "\\u003c")}</script>`;
}
