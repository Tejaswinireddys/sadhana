/**
 * Optional Sentry init for the Express process.
 * No-ops when SENTRY_DSN is unset so local/dev stays dependency-light at runtime.
 */
let initialized = false;

export async function initServerSentry(): Promise<void> {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      release: process.env.RENDER_GIT_COMMIT || process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
    initialized = true;
    console.info("[sentry] server SDK initialized");
  } catch (err) {
    console.warn("[sentry] server init failed", (err as Error).message);
  }
}

export async function captureServerException(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN?.trim()) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.withScope((scope) => {
      if (context) {
        for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
      }
      Sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}
