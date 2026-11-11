/**
 * Product analytics facade: exact funnel event names → PostHog + local buffer.
 *
 * Remote capture needs `VITE_PUBLIC_POSTHOG_KEY`, no Do Not Track / GPC, and
 * either Settings consent or an anonymous acquisition-funnel event. With no
 * key everything stays local (or silent).
 */
import {
  isProductEvent,
  type AnalyticsProps,
  type ProductEvent,
  type ProductEventProps,
} from "../../../funnel/events";
import { makeLoggedEvent, type LoggedEvent } from "../../../funnel/eventLog";
import { readAnalyticsPrefs } from "./analytics";
import { browserDoNotTrack } from "./doNotTrack";
import { posthogCapture, posthogConfigured, posthogDistinctId, setPostHogOptOut } from "./posthogClient";

const BUFFER_KEY = "sadhana.product.events.v1";
const DISTINCT_KEY = "sadhana.analytics.distinct";
const FIRST_OPEN_KEY = "sadhana.analytics.firstOpenDone";
const FIRST_OPEN_AT_KEY = "sadhana.analytics.firstOpenAt";
const LAST_RETURN_DAY_KEY = "sadhana.analytics.lastReturnDay";
const MAX_BUFFER = 2000;

/**
 * Anonymous acquisition funnel — may go remote when PostHog is keyed and DNT
 * is off, even without Settings opt-in (see docs/ANALYTICS.md). Practice and
 * class events always need consent (or stay local-only).
 */
const FUNNEL_ALWAYS = new Set<ProductEvent>([
  "welcome_viewed",
  "quiz_started",
  "quiz_question_shown",
  "quiz_answered",
  "quiz_abandoned",
  "quiz_completed",
  "plan_revealed",
  "paywall_viewed",
  "checkout_started",
  "purchase_completed",
  "signup_completed",
  "app_first_open",
  "app_return",
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

function shouldBuffer(event: ProductEvent): boolean {
  if (FUNNEL_ALWAYS.has(event)) return true;
  return readAnalyticsPrefs().enabled || posthogConfigured();
}

function shouldSendRemote(event: ProductEvent): boolean {
  if (!posthogConfigured()) return false;
  if (browserDoNotTrack()) return false;
  if (FUNNEL_ALWAYS.has(event)) return true;
  return readAnalyticsPrefs().enabled;
}

export async function captureProduct<E extends ProductEvent>(
  event: E,
  props: ProductEventProps[E],
): Promise<void> {
  if (!isProductEvent(event)) return;
  if (!shouldBuffer(event)) return;

  const clean = sanitizeProps(props as AnalyticsProps);
  const distinct = (await posthogDistinctId()) || localDistinctId();
  const row = makeLoggedEvent(event, clean, distinct);
  writeBuffer([...readBuffer(), row]);

  if (typeof window !== "undefined" && (window as unknown as { __SADHANA_DEBUG?: boolean }).__SADHANA_DEBUG) {
    console.info("[product-analytics]", event, clean);
  }

  if (shouldSendRemote(event)) {
    void posthogCapture(event, clean);
  }
}

/** Fire once per browser for app_first_open; stamps the first-open day for returns. */
export async function trackAppFirstOpen(source: string): Promise<void> {
  try {
    if (localStorage.getItem(FIRST_OPEN_KEY)) return;
    localStorage.setItem(FIRST_OPEN_KEY, "1");
    if (!localStorage.getItem(FIRST_OPEN_AT_KEY)) {
      localStorage.setItem(FIRST_OPEN_AT_KEY, new Date().toISOString());
    }
  } catch {
    /* private mode — still fire */
  }
  await captureProduct("app_first_open", { source });
}

/**
 * Day-1 / day-7 (and later) return: once per local calendar day after the
 * first open, with `days_since_first_open` for retention cohorting.
 */
export async function trackAppReturn(now = new Date()): Promise<void> {
  let firstAt: string | null = null;
  let lastDay: string | null = null;
  try {
    firstAt = localStorage.getItem(FIRST_OPEN_AT_KEY);
    lastDay = localStorage.getItem(LAST_RETURN_DAY_KEY);
  } catch {
    return;
  }
  if (!firstAt) return;
  const first = Date.parse(firstAt);
  if (!Number.isFinite(first)) return;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfFirst = new Date(first);
  const firstDay = new Date(startOfFirst.getFullYear(), startOfFirst.getMonth(), startOfFirst.getDate()).getTime();
  const days = Math.floor((startOfToday - firstDay) / 86_400_000);
  if (days < 1) return;
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  if (lastDay === dayKey) return;
  try {
    localStorage.setItem(LAST_RETURN_DAY_KEY, dayKey);
  } catch {
    /* still fire once this session */
  }
  await captureProduct("app_return", { days_since_first_open: days });
}

/** Keep PostHog's own opt-out flag in sync with Settings. */
export async function syncAnalyticsConsent(enabled: boolean): Promise<void> {
  await setPostHogOptOut(!enabled || browserDoNotTrack());
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
