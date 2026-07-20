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

/** Stable anonymous device id for per-browser data isolation. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
    const id = mintId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Private mode / blocked storage — still send a stable-per-session id.
    if (!(window as any).__sadhanaDeviceId) {
      (window as any).__sadhanaDeviceId = mintId();
    }
    return (window as any).__sadhanaDeviceId as string;
  }
}
