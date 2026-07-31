/**
 * Offline download manager — caches listed shell + practice assets via Cache API.
 * Complements the service worker; API data is never stored here.
 */
import { track } from "./analytics";

export const OFFLINE_CACHE = "sadhana-offline-v1";

export type OfflineManifest = {
  version: string;
  urls: string[];
  updatedAt: string;
};

/** Core assets useful for a short offline practice when already visited once. */
export function defaultOfflineManifest(): OfflineManifest {
  const base = import.meta.env.BASE_URL || "/";
  const join = (p: string) => (base.endsWith("/") ? `${base}${p.replace(/^\//, "")}` : `${base}/${p.replace(/^\//, "")}`);
  return {
    version: "1",
    updatedAt: new Date().toISOString(),
    urls: [
      join("index.html"),
      join("manifest.webmanifest"),
      join("favicon.svg"),
      join("icon-192.png"),
      join("poses/tadasana.png"),
      join("poses/balasana.png"),
      join("poses/sukhasana.png"),
      join("poses/savasana.png"),
      join("poses/adho-mukha-svanasana.png"),
    ],
  };
}

export async function estimateOfflineBytes(urls: string[]): Promise<number> {
  // HEAD is not always available; approximate from known small shells.
  return urls.length * 180_000;
}

export async function downloadOfflinePack(manifest = defaultOfflineManifest()): Promise<{
  cached: number;
  failed: number;
}> {
  if (!("caches" in globalThis)) {
    throw new Error("Offline downloads need a modern browser with Cache Storage.");
  }
  const cache = await caches.open(OFFLINE_CACHE);
  let cached = 0;
  let failed = 0;
  for (const url of manifest.urls) {
    try {
      const res = await fetch(url, { cache: "reload" });
      if (res.ok) {
        await cache.put(url, res.clone());
        cached++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  track("offline_download", { cached, failed });
  return { cached, failed };
}

export async function clearOfflinePack(): Promise<void> {
  if (!("caches" in globalThis)) return;
  await caches.delete(OFFLINE_CACHE);
}

export async function offlinePackStatus(): Promise<{ present: boolean; entries: number }> {
  if (!("caches" in globalThis)) return { present: false, entries: 0 };
  const cache = await caches.open(OFFLINE_CACHE);
  const keys = await cache.keys();
  return { present: keys.length > 0, entries: keys.length };
}

/** Queue practice completion payloads until back online (local only). */
const SYNC_QUEUE_KEY = "sadhana.offline.syncQueue";

export type QueuedCompletion = {
  id: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export function enqueueCompletion(payload: Record<string, unknown>): void {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const list: QueuedCompletion[] = raw ? JSON.parse(raw) : [];
    list.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      payload,
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* ignore */
  }
}

export function readCompletionQueue(): QueuedCompletion[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedCompletion[]) : [];
  } catch {
    return [];
  }
}

export function clearCompletionQueue(): void {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  } catch {
    /* ignore */
  }
}
