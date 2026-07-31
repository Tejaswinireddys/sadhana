import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);

import("./lib/analytics")
  .then(({ track }) => track("app_open"))
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
