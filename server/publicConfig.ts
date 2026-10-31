/** Public, non-secret launch settings embedded into the HTML response. */
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true" && Boolean(process.env.STRIPE_SECRET_KEY);
}
export function publicConfig() {
  const email = process.env.SUPPORT_EMAIL?.trim() ?? "";
  return {
    billingEnabled: billingEnabled(),
    supportEmail: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null,
  };
}
export function publicConfigHtml(): string {
  return `<script type="application/json" id="public-config">${JSON.stringify(publicConfig()).replace(/</g, "\\u003c")}</script>`;
}
