/**
 * Lightweight error reporting. PostHog covers product analytics — this is for
 * unexpected exceptions. When SENTRY_DSN is set, events are forwarded as a
 * Sentry envelope store request (no SDK dependency). Otherwise they are logged.
 */
type ErrorPayload = {
  message: string;
  stack?: string;
  source?: "server" | "client";
  path?: string;
  release?: string;
  extra?: Record<string, unknown>;
};

function dsnParts(dsn: string): { publicKey: string; host: string; projectId: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "").split("/")[0];
    if (!projectId || !u.username) return null;
    return { publicKey: u.username, host: u.host, projectId };
  } catch {
    return null;
  }
}

export async function reportError(payload: ErrorPayload): Promise<void> {
  const msg = (payload.message || "unknown").slice(0, 500);
  const line = `[error:${payload.source || "server"}] ${msg}`;
  if (payload.stack) console.error(line, "\n", payload.stack.slice(0, 4000));
  else console.error(line);

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  const parts = dsnParts(dsn);
  if (!parts) return;

  const event = {
    message: msg,
    platform: payload.source === "client" ? "javascript" : "node",
    level: "error",
    timestamp: Date.now() / 1000,
    release: payload.release || process.env.RENDER_GIT_COMMIT || undefined,
    tags: { source: payload.source || "server" },
    extra: {
      path: payload.path,
      ...(payload.extra || {}),
    },
    exception: payload.stack
      ? {
          values: [
            {
              type: "Error",
              value: msg,
              stacktrace: {
                frames: payload.stack
                  .split("\n")
                  .slice(0, 30)
                  .map((l) => ({ filename: l.trim() })),
              },
            },
          ],
        }
      : undefined,
  };

  const url = `https://${parts.host}/api/${parts.projectId}/store/`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parts.publicKey}, sentry_client=sadhana/1.0`,
      },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.warn("[errorReporting] Sentry forward failed", (err as Error).message);
  }
}
