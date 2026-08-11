/**
 * Server-side PostHog capture for billing lifecycle events that must be trusted
 * (purchase_completed, subscription_cancelled).
 */
import { PostHog } from "posthog-node";
import type { AnalyticsProps, ProductEvent } from "../funnel/events";

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.POSTHOG_API_KEY || process.env.VITE_PUBLIC_POSTHOG_KEY || "";
  if (!key) {
    client = null;
    return null;
  }
  const host = process.env.POSTHOG_HOST || process.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

export function serverAnalyticsConfigured(): boolean {
  return Boolean(process.env.POSTHOG_API_KEY || process.env.VITE_PUBLIC_POSTHOG_KEY);
}

export async function captureServerEvent(
  distinctId: string,
  event: ProductEvent,
  properties: AnalyticsProps,
): Promise<void> {
  const ph = getClient();
  if (!ph) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[product-analytics:server]", event, properties);
    }
    return;
  }
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (v === undefined || v === null) continue;
    clean[k] = v;
  }
  ph.capture({ distinctId: distinctId || "server", event, properties: clean });
  await ph.flush().catch(() => undefined);
}
