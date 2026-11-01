/**
 * Free-tier ad settings, shared by the server (which reads env) and the client
 * (which reads the copy embedded in the HTML as `public-config`).
 *
 * Off unless ADS_ENABLED=true. AdSense ids are public by design (they appear
 * in every ad request), but they are still validated so a typo cannot inject
 * markup or load a script from somewhere else.
 */
export const AD_PROVIDERS = ["house", "adsense"] as const;
export type AdProvider = (typeof AD_PROVIDERS)[number];

export const AD_PLACEMENTS = ["today", "classes", "classDetail"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export type AdsConfig = {
  enabled: boolean;
  provider: AdProvider;
  /** `ca-pub-…`, only when the provider is adsense. */
  adsenseClientId: string | null;
  /** AdSense ad-unit ids per placement, only when the provider is adsense. */
  slots: Partial<Record<AdPlacement, string>>;
};

export const ADS_OFF: AdsConfig = { enabled: false, provider: "house", adsenseClientId: null, slots: {} };

const CLIENT_ID = /^ca-pub-\d{10,20}$/;
const SLOT_ID = /^\d{6,20}$/;
const SLOT_ENV: Record<AdPlacement, string> = {
  today: "ADSENSE_SLOT_TODAY",
  classes: "ADSENSE_SLOT_CLASSES",
  classDetail: "ADSENSE_SLOT_CLASS_DETAIL",
};

/** A valid `ca-pub-…` client id, or null. */
export function adsenseClientId(env: Record<string, string | undefined>): string | null {
  const id = env.ADSENSE_CLIENT_ID?.trim() ?? "";
  return CLIENT_ID.test(id) ? id : null;
}

/**
 * Settings from env. AdSense needs a valid client id; without one the
 * provider falls back to the house card rather than rendering broken units.
 */
export function adsConfigFromEnv(env: Record<string, string | undefined>): AdsConfig {
  if (env.ADS_ENABLED?.trim() !== "true") return ADS_OFF;
  const requested = env.ADS_PROVIDER?.trim() === "adsense" ? "adsense" : "house";
  const clientId = requested === "adsense" ? adsenseClientId(env) : null;
  if (!clientId) return { enabled: true, provider: "house", adsenseClientId: null, slots: {} };
  const slots: AdsConfig["slots"] = {};
  for (const placement of AD_PLACEMENTS) {
    const id = env[SLOT_ENV[placement]]?.trim() ?? "";
    if (SLOT_ID.test(id)) slots[placement] = id;
  }
  return { enabled: true, provider: "adsense", adsenseClientId: clientId, slots };
}

/** Read the embedded config defensively: anything unexpected means ads off. */
export function parseAdsConfig(value: unknown): AdsConfig {
  if (!value || typeof value !== "object") return ADS_OFF;
  const v = value as Partial<AdsConfig>;
  if (v.enabled !== true) return ADS_OFF;
  const clientId = typeof v.adsenseClientId === "string" && CLIENT_ID.test(v.adsenseClientId) ? v.adsenseClientId : null;
  if (v.provider !== "adsense" || !clientId) return { enabled: true, provider: "house", adsenseClientId: null, slots: {} };
  const slots: AdsConfig["slots"] = {};
  for (const placement of AD_PLACEMENTS) {
    const id = v.slots?.[placement];
    if (typeof id === "string" && SLOT_ID.test(id)) slots[placement] = id;
  }
  return { enabled: true, provider: "adsense", adsenseClientId: clientId, slots };
}

/** The ads.txt line for a client id: `google.com, pub-…, DIRECT, f08c47fec0942fa0`. */
export function adsTxt(clientId: string): string {
  return `google.com, ${clientId.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
}
