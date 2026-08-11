/**
 * Lazy PostHog browser client. No-ops when VITE_PUBLIC_POSTHOG_KEY is unset.
 */
import type { AnalyticsProps } from "../../../funnel/events";

type PostHogLike = {
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (id: string, props?: Record<string, unknown>) => void;
  opt_out_capturing: () => void;
  opt_in_capturing: () => void;
  get_distinct_id: () => string;
};

let client: PostHogLike | null = null;
let initStarted = false;

function viteEnv(): ImportMetaEnv | Record<string, string | boolean | undefined> {
  try {
    return (import.meta as ImportMeta).env ?? {};
  } catch {
    return {};
  }
}

export function posthogConfigured(): boolean {
  return Boolean(viteEnv().VITE_PUBLIC_POSTHOG_KEY);
}

export async function initPostHog(): Promise<PostHogLike | null> {
  const env = viteEnv();
  const key = env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
  if (!key) return null;
  if (client) return client;
  if (initStarted) return client;
  initStarted = true;
  try {
    const { default: posthog } = await import("posthog-js");
    const host = (env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: false,
      persistence: "localStorage+cookie",
      loaded: (ph) => {
        if (env.DEV) {
          try {
            (ph as { debug?: (v: boolean) => void }).debug?.(false);
          } catch {
            /* ignore */
          }
        }
      },
    });
    client = posthog as unknown as PostHogLike;
    return client;
  } catch (err) {
    console.warn("[posthog] init failed", err);
    return null;
  }
}

export async function posthogCapture(event: string, props?: AnalyticsProps): Promise<void> {
  const ph = await initPostHog();
  if (!ph) return;
  const clean: Record<string, string | number | boolean> = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null) continue;
      clean[k] = v;
    }
  }
  ph.capture(event, clean);
}

export async function posthogDistinctId(): Promise<string | null> {
  const ph = await initPostHog();
  if (!ph) return null;
  try {
    return ph.get_distinct_id();
  } catch {
    return null;
  }
}

export async function setPostHogOptOut(optOut: boolean): Promise<void> {
  const ph = await initPostHog();
  if (!ph) return;
  if (optOut) ph.opt_out_capturing();
  else ph.opt_in_capturing();
}
