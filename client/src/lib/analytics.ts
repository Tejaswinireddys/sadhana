/**
 * Privacy-first analytics taxonomy.
 * Events never include journal text, emails, or body/injury details.
 * Opt-in via Settings; default is anonymous local counters only.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

export const ANALYTICS_EVENTS = [
  "app_open",
  "onboarding_complete",
  "practice_start",
  "practice_complete",
  "practice_abandon",
  "pathway_enroll",
  "search_query",
  "signup_success",
  "export_data",
  "offline_download",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsPrefs = {
  /** When false, only in-memory counters — nothing persisted. */
  enabled: boolean;
};

const COUNTS_KEY = "sadhana.analytics.counts";

export function readAnalyticsPrefs(): AnalyticsPrefs {
  return readJson<AnalyticsPrefs>(KEYS.analytics, { enabled: false });
}

export function writeAnalyticsPrefs(prefs: AnalyticsPrefs) {
  writeJson(KEYS.analytics, prefs);
}

type Counts = Partial<Record<AnalyticsEvent, number>>;

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  if (!ANALYTICS_EVENTS.includes(event)) return;
  // Never accept free-text payloads that could contain journal/health content.
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === "string" && v.length > 64) return;
      if (/email|journal|note|password|body|injury/i.test(k)) return;
    }
  }
  const prefs = readAnalyticsPrefs();
  if (!prefs.enabled) return;
  const counts = readJson<Counts>(COUNTS_KEY, {});
  counts[event] = (counts[event] ?? 0) + 1;
  writeJson(COUNTS_KEY, counts);
  if (typeof window !== "undefined" && (window as unknown as { __SADHANA_DEBUG?: boolean }).__SADHANA_DEBUG) {
    console.info("[analytics]", event, props ?? {});
  }
}

export function readAnalyticsCounts(): Counts {
  return readJson<Counts>(COUNTS_KEY, {});
}
