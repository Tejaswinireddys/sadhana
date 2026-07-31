/**
 * Web Push helpers — real reminders that work when the tab is closed (prod SW).
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

export type PushPrefs = {
  enabled: boolean;
  endpoint?: string;
};

export function readPushPrefs(): PushPrefs {
  return readJson<PushPrefs>(KEYS.webPush, { enabled: false });
}

export function writePushPrefs(prefs: PushPrefs) {
  writeJson(KEYS.webPush, prefs);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string; enabled?: boolean };
    return data.enabled && data.publicKey ? data.publicKey : null;
  } catch {
    return null;
  }
}

/** Subscribe for Web Push. Returns false if unsupported or user denied. */
export async function subscribeWebPush(): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Web Push needs a modern browser with a service worker." };
  }
  if (!("Notification" in window)) {
    return { ok: false, message: "Notifications are not supported here." };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, message: "Notification permission was not granted." };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      message: "Push server is not configured yet — browser alerts still work when the tab is open.",
    };
  }

  // Ensure SW is registered (also in prod via main.tsx).
  const reg =
    (await navigator.serviceWorker.getRegistration()) ||
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    return { ok: false, message: "Could not save push subscription on the server." };
  }
  writePushPrefs({ enabled: true, endpoint: sub.endpoint });
  return { ok: true, message: "Push reminders enabled — you can close the tab." };
}

export async function unsubscribeWebPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  writePushPrefs({ enabled: false });
}
