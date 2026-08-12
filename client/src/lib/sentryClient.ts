/**
 * Optional browser Sentry. Enable with VITE_SENTRY_DSN (or fall back is none —
 * server still receives /api/client-errors beacons).
 */
import * as Sentry from "@sentry/react";

let ready = false;

export function initSentry(): void {
  if (ready) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn?.trim()) return;
  Sentry.init({
    dsn: dsn.trim(),
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  });
  ready = true;
}

export function captureClientException(error: unknown, extras?: Record<string, unknown>) {
  if (!ready) return;
  Sentry.withScope((scope) => {
    if (extras) {
      for (const [k, v] of Object.entries(extras)) scope.setExtra(k, v);
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
