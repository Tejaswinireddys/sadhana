/**
 * Product analytics facade: exact funnel event names → PostHog + local buffer.
 */
import {
  isProductEvent,
  type AnalyticsProps,
  type ProductEvent,
  type ProductEventProps,
} from "../../../funnel/events";
import { makeLoggedEvent, type LoggedEvent } from "../../../funnel/eventLog";
import { readAnalyticsPrefs } from "./analytics";
import { posthogCapture, posthogConfigured, posthogDistinctId } from "./posthogClient";

const BUFFER_KEY = "sadhana.product.events.v1";
const DISTINCT_KEY = "sadhana.analytics.distinct";
const FIRST_OPEN_KEY = "sadhana.analytics.firstOpenDone";
const MAX_BUFFER = 2000;

/** Funnel acquisition events always capture when PostHog is configured (anonymous). */
const FUNNEL_ALWAYS = new Set<ProductEvent>([
  "quiz_started",
  "quiz_question_shown",
  "quiz_answered",
  "quiz_abandoned",
  "quiz_completed",
  "plan_revealed",
  "paywall_viewed",
  "checkout_started",
  "purchase_completed",
]);

function localDistinctId(): string {
  try {
    let id = localStorage.getItem(DISTINCT_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DISTINCT_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

function sanitizeProps(props?: AnalyticsProps): AnalyticsProps {
  if (!props) return {};
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (/email|journal|note|password|injury/i.test(k)) continue;
    if (typeof v === "string" && v.length > 64) continue;
    out[k] = v;
  }
  return out;
}

function readBuffer(): LoggedEvent[] {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoggedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: LoggedEvent[]) {
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(events.slice(-MAX_BUFFER)));
  } catch {
    /* quota */
  }
}

export function readProductEventBuffer(): LoggedEvent[] {
  return readBuffer();
}

export function clearProductEventBuffer() {
  try {
    localStorage.removeItem(BUFFER_KEY);
  } catch {
    /* ignore */
  }
}

export function appendProductEvents(events: LoggedEvent[]) {
  writeBuffer([...readBuffer(), ...events].slice(-MAX_BUFFER));
}

function shouldCapture(event: ProductEvent): boolean {
  if (FUNNEL_ALWAYS.has(event) && posthogConfigured()) return true;
  if (FUNNEL_ALWAYS.has(event)) return true; // still buffer locally for dashboard
  return readAnalyticsPrefs().enabled || posthogConfigured();
}

export async function captureProduct<E extends ProductEvent>(
  event: E,
  props: ProductEventProps[E],
): Promise<void> {
  if (!isProductEvent(event)) return;
  if (!shouldCapture(event)) return;

  const clean = sanitizeProps(props as AnalyticsProps);
  const distinct = (await posthogDistinctId()) || localDistinctId();
  const row = makeLoggedEvent(event, clean, distinct);
  writeBuffer([...readBuffer(), row]);

  if (typeof window !== "undefined" && (window as unknown as { __SADHANA_DEBUG?: boolean }).__SADHANA_DEBUG) {
    console.info("[product-analytics]", event, clean);
  }

  // PostHog: funnel always (when keyed); in-app respects Settings opt-in OR keyed+enabled default.
  const prefs = readAnalyticsPrefs();
  const sendRemote =
    posthogConfigured() && (FUNNEL_ALWAYS.has(event) || prefs.enabled);
  if (sendRemote) {
    void posthogCapture(event, clean);
  }
}

/** Fire once per browser for app_first_open. */
export async function trackAppFirstOpen(source: string): Promise<void> {
  try {
    if (localStorage.getItem(FIRST_OPEN_KEY)) return;
    localStorage.setItem(FIRST_OPEN_KEY, "1");
  } catch {
    /* private mode — still fire */
  }
  await captureProduct("app_first_open", { source });
}

/** Persist flow_id for server-side purchase attribution via checkout metadata. */
export function rememberFunnelFlowId(flowId: string) {
  try {
    sessionStorage.setItem("sadhana.funnel.flow_id", flowId);
  } catch {
    /* ignore */
  }
}

export function readRememberedFlowId(): string | null {
  try {
    return sessionStorage.getItem("sadhana.funnel.flow_id");
  } catch {
    return null;
  }
}
