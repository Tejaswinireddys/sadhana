import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * Legacy hash-route redirect (301-equivalent).
 *
 * The app used to route on the fragment (`/#/asanas/tadasana`). It now uses real
 * paths (`/asanas/tadasana`). Old bookmarks, shared links, and search-engine
 * entries still carry the hash, so rewrite them to the canonical path *before*
 * React mounts — the router then only ever sees the real path. `replaceState`
 * drops the hash URL from history, so it never resolves to content again (the
 * client-side equivalent of a 301).
 */
if (window.location.hash.startsWith("#/")) {
  const target = window.location.hash.slice(1); // "#/foo?x=1" -> "/foo?x=1"
  window.history.replaceState(null, "", target || "/");
} else if (window.location.hash === "#") {
  // Bare "#" left over from an old link — drop it.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

createRoot(document.getElementById("root")!).render(<App />);

import("./lib/analytics")
  .then(({ track }) => track("app_open"))
  .catch(() => undefined);

import("./lib/productAnalytics")
  .then(({ trackAppFirstOpen }) => {
    const path = window.location.pathname || "/";
    const source = path.startsWith("/start")
      ? "quiz"
      : path === "/welcome"
        ? "landing"
        : "app";
    return trackAppFirstOpen(source);
  })
  .catch(() => undefined);

import("./lib/posthogClient")
  .then(({ initPostHog }) => initPostHog())
  .catch(() => undefined);

/**
 * Register the service worker.
 *
 * Deliberately after first render so it never competes with the initial paint,
 * and guarded so a dev build or an unsupported browser is a no-op. This is what
 * makes the shipped manifest/theme-color/icons mean something: an offline shell
 * and a cached start instead of a blank page during a cold start.
 */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failure must never break the app */
    });
  });
}

/** Forward unexpected client errors for monitoring (Sentry when SENTRY_DSN is set). */
function reportClientError(message: string, stack?: string) {
  try {
    const body = JSON.stringify({
      message: message.slice(0, 500),
      stack: stack?.slice(0, 4000),
      path: window.location.pathname,
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/client-errors", blob);
      return;
    }
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "include",
      keepalive: true,
    });
  } catch {
    /* never break the app for telemetry */
  }
}

window.addEventListener("error", (ev) => {
  reportClientError(ev.message || "window.error", ev.error?.stack);
});
window.addEventListener("unhandledrejection", (ev) => {
  const reason = ev.reason;
  const message =
    reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "unhandledrejection";
  const stack = reason instanceof Error ? reason.stack : undefined;
  reportClientError(message, stack);
});
