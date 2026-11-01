/**
 * State for `/verify`. Kept pure so the page's outcomes can be unit-tested
 * without a DOM.
 *
 * A verification token is single-use: the server deletes it as soon as it
 * signs the user in. Production showed the page stuck on "Verifying…" after a
 * successful sign-in, and a second request for the same token (StrictMode's
 * double effect, a remount, a re-render racing a state flag) can only ever
 * answer "invalid or expired" — so a success would be shown as a failure.
 * `verifyOnce` makes every caller for one token share one request.
 */

export type VerifyPhase = "idle" | "verifying" | "success" | "invalid" | "retry";

/**
 * `apiRequest` throws `Error("<status>: <body>")` for HTTP failures, a
 * "Request timed out" error on abort, and the browser's `TypeError` when the
 * network is unreachable. A 4xx means the token itself was refused (expired,
 * already used, wrong email) and retrying cannot help — the practitioner needs
 * a new email. Anything else is transient and worth a retry.
 */
export function classifyVerifyError(error: unknown): "invalid" | "retry" {
  const message = error instanceof Error ? error.message : "";
  const status = /^(\d{3}):/.exec(message);
  if (status) {
    const code = Number(status[1]);
    return code >= 400 && code < 500 && code !== 408 && code !== 429 ? "invalid" : "retry";
  }
  return "retry";
}

const attempts = new Map<string, Promise<unknown>>();

/**
 * Run `request` at most once per token. Later callers get the same promise,
 * including after it settles, so a remount sees the original outcome instead
 * of re-sending a token the server has already consumed. A transient failure
 * is forgotten so "Try again" can send it again.
 */
export function verifyOnce<T>(token: string, request: () => Promise<T>): Promise<T> {
  const existing = attempts.get(token);
  if (existing) return existing as Promise<T>;
  const attempt = request().catch((error: unknown) => {
    if (classifyVerifyError(error) === "retry") attempts.delete(token);
    throw error;
  });
  attempts.set(token, attempt);
  return attempt;
}

/** Drop a remembered attempt (used by "Try again" and by tests). */
export function forgetVerifyAttempt(token?: string) {
  if (token === undefined) attempts.clear();
  else attempts.delete(token);
}

