import { KEYS, writeString } from "@/lib/localPrefs";

/**
 * Remember that this browser is not a first-time visitor, in localStorage
 * (read by the client gates) and in the cookie the server reads to pick the
 * HTML entry for `/`.
 */
export function markWelcomeSeen(): void {
  writeString(KEYS.welcomeSeen, "1");
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `sadhana_welcome_seen=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch { /* cookies blocked: localStorage still carries it */ }
}

let probe: Promise<boolean> | null = null;

/**
 * Whether this browser has an account session. The session cookie is HttpOnly,
 * so the shell asks the server. Plain `fetch` (not the query client) keeps the
 * landing bundle light. Any failure counts as signed out, which shows the
 * welcome page — the behaviour before this check existed.
 */
export function probeSignedIn(): Promise<boolean> {
  probe ??= fetch("/api/auth/me", { credentials: "include", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) })
    .then(async (res) => (res.ok ? !!((await res.json()) as { user?: unknown }).user : false))
    .catch(() => false)
    .then((signedIn) => {
      if (!signedIn) probe = null; // a later sign-in must be able to answer differently
      return signedIn;
    });
  return probe;
}
