const STORAGE_KEY = "sadhana.deviceId";
const PROOF_KEY = "sadhana.deviceProof";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function memoryId(): string | null {
  const v = (window as any).__sadhanaDeviceId;
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}

function memoryProof(): string | null {
  const v = (window as any).__sadhanaDeviceProof;
  return typeof v === "string" && v.length >= 16 ? v : null;
}

/**
 * The id this browser already has, or null.
 *
 * Deliberately does NOT mint. If localStorage was evicted we want to send no
 * header at all, so the server falls back to its `sadhana_device` cookie and
 * hands us back the *original* owner id — instead of us inventing a new one and
 * orphaning every session, journal entry and streak behind it.
 */
export function peekDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
  } catch {
    /* blocked storage — fall through */
  }
  return memoryId();
}

/** HMAC proof issued by the server — required to re-adopt an id without a cookie. */
export function peekDeviceProof(): string | null {
  try {
    const existing = localStorage.getItem(PROOF_KEY);
    if (existing && existing.length >= 16) return existing;
  } catch {
    /* blocked storage — fall through */
  }
  return memoryProof();
}

/** Adopt the id (+ proof) the server resolved for us. */
export function syncDeviceId(
  id: string | null | undefined,
  proof?: string | null | undefined,
): void {
  if (!id || !UUID_RE.test(id)) return;
  const sameId = peekDeviceId() === id;
  const sameProof = !proof || peekDeviceProof() === proof;
  if (sameId && sameProof) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
    if (proof && proof.length >= 16) localStorage.setItem(PROOF_KEY, proof);
  } catch {
    /* blocked storage — keep it in memory for this session */
  }
  (window as any).__sadhanaDeviceId = id;
  if (proof && proof.length >= 16) (window as any).__sadhanaDeviceProof = proof;
}

/**
 * Stable anonymous device id for per-browser data isolation.
 * Prefer server-minted ids (via cookie echo). Client-side minting is a last
 * resort for the first paint before any API response arrives — the next
 * response will replace it with a signed server id.
 */
export function getDeviceId(): string {
  const existing = peekDeviceId();
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* Private mode / blocked storage — stable for this session only. */
  }
  (window as any).__sadhanaDeviceId = id;
  return id;
}
