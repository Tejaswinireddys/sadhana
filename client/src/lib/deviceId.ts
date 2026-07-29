const STORAGE_KEY = "sadhana.deviceId";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mintId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function memoryId(): string | null {
  const v = (window as any).__sadhanaDeviceId;
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
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

/** Adopt the id the server resolved for us (from its cookie), if it differs. */
export function syncDeviceId(id: string | null | undefined): void {
  if (!id || !UUID_RE.test(id)) return;
  if (peekDeviceId() === id) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* blocked storage — keep it in memory for this session */
  }
  (window as any).__sadhanaDeviceId = id;
}

/** Stable anonymous device id for per-browser data isolation. */
export function getDeviceId(): string {
  const existing = peekDeviceId();
  if (existing) return existing;
  const id = mintId();
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* Private mode / blocked storage — stable for this session only. */
  }
  (window as any).__sadhanaDeviceId = id;
  return id;
}
