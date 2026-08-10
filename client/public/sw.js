/**
 * Sadhana service worker.
 *
 * Strategy:
 *   - App shell (navigations): network-first with a short timeout, falling back
 *     to the cached shell. This is what covers the cold start.
 *   - Static assets (hashed JS/CSS, pose images, audio): cache-first. They are
 *     content-hashed or immutable, so a stale hit is always safe.
 *   - Explicit offline pack (`sadhana-offline-v1`): checked before network for assets.
 *   - API: never cached. Practice data must not be served stale.
 *   - Push: show gentle practice reminders when the tab is closed.
 */
const VERSION = "v4";
const SHELL_CACHE = `sadhana-shell-${VERSION}`;
const ASSET_CACHE = `sadhana-assets-${VERSION}`;
const OFFLINE_CACHE = "sadhana-offline-v1";
const SHELL_URL = "/index.html";

/** How long to wait for the network before falling back to cache. */
const NETWORK_TIMEOUT_MS = 3000;

const PRECACHE = [
  SHELL_URL,
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/robots.txt",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE && k !== OFFLINE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Sadhana",
    body: "A gentle reminder to practice — no streak guilt.",
    url: "/",
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore malformed payloads */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
      tag: "sadhana-reminder",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/poses/") ||
    url.pathname.startsWith("/videos/") ||
    url.pathname.startsWith("/voice/") ||
    /\.(png|jpg|jpeg|webp|svg|woff2?|mp3|json|webm|mp4)$/.test(url.pathname)
  );
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS),
      ),
    ]);
    if (response && response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw new Error("offline and uncached");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const offline = await caches.open(OFFLINE_CACHE);
  const offlineHit = await offline.match(request);
  if (offlineHit) return offlineHit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Path-based routing: a navigation can be any real path (`/asanas/tadasana`),
    // not just `/`. The server returns the SPA shell for every non-asset path, so
    // we cache and fall back under a single canonical SHELL_URL key — a deep link
    // offline resolves to the cached shell and the client router renders the page.
    event.respondWith(
      networkFirst(request, SHELL_CACHE, SHELL_URL).catch(
        () =>
          new Response(
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>Sadhana offline</title></head><body style=\"font-family:system-ui;padding:2rem;max-width:28rem\"><h1>You're offline</h1><p>Reconnect to sync practice and load new poses.</p><p><a href=\"/\">Try again</a></p></body></html>",
            {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 503,
            },
          ),
      ),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)));
  }
});
