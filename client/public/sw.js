/**
 * Sadhana service worker.
 *
 * The app shipped a manifest, theme-color and icons but registered no service
 * worker at all — PWA scaffolding with nothing behind it. That matters more
 * here than for most apps: this is used on a mat, on hotel wifi, and (on the
 * free hosting tier) behind a cold start that can take ~40 seconds. A cached
 * shell turns that from a blank "service waking up" page into a usable app.
 *
 * Strategy:
 *   - App shell (navigations): network-first with a short timeout, falling back
 *     to the cached shell. This is what covers the cold start.
 *   - Static assets (hashed JS/CSS, pose images, audio): cache-first. They are
 *     content-hashed or immutable, so a stale hit is always safe.
 *   - API: never cached. Practice data must not be served stale.
 */
const VERSION = "v1";
const SHELL_CACHE = `sadhana-shell-${VERSION}`;
const ASSET_CACHE = `sadhana-assets-${VERSION}`;
const SHELL_URL = "/index.html";

/** How long to wait for the network before falling back to cache. */
const NETWORK_TIMEOUT_MS = 3000;

const PRECACHE = [SHELL_URL, "/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png"];

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
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/poses/") ||
    url.pathname.startsWith("/voice/") ||
    /\.(png|jpg|jpeg|webp|svg|woff2?|mp3|json)$/.test(url.pathname)
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
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Practice data is never served from cache — a stale streak is worse than
  // an error the UI already knows how to show.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, SHELL_CACHE, SHELL_URL).catch(
        () =>
          new Response("<h1>Offline</h1><p>Reconnect to load Sadhana.</p>", {
            headers: { "Content-Type": "text/html" },
            status: 503,
          }),
      ),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)));
  }
});
