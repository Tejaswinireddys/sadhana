import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows when the browser is offline or the API fails a cheap health ping.
 * Useful for Render cold starts and flaky mobile networks.
 */
export function ConnectivityBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      if (!navigator.onLine) return;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch("/healthz", { signal: ctrl.signal, cache: "no-store" });
        clearTimeout(t);
        if (!cancelled) setApiDown(!res.ok);
      } catch {
        if (!cancelled) setApiDown(true);
      }
    }
    ping();
    const id = setInterval(ping, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [offline]);

  if (!offline && !apiDown) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 bg-amber-600/90 px-4 py-2 text-center text-sm text-white"
      role="status"
      data-testid="banner-connectivity"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      {offline
        ? "You're offline — practice will save when you're back online."
        : "Connecting to Sadhana… the server may be waking up (up to ~30s)."}
    </div>
  );
}
