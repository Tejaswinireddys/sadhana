/**
 * Connectivity banner: only after consecutive health failures, with backoff
 * and an explicit retry. Successful /api traffic clears the banner immediately.
 */
import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

const FAIL_THRESHOLD = 2;
const BASE_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 120_000;
const PING_TIMEOUT_MS = 8_000;

/** Fired by the API client after any successful response so we drop the banner. */
export const SADHANA_API_OK = "sadhana:api-ok";

export function notifyApiOk() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SADHANA_API_OK));
  }
}

export function ConnectivityBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [apiDown, setApiDown] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const failCount = useRef(0);
  const timer = useRef<number | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const onOff = () => setOffline(true);
    const onOn = () => {
      setOffline(false);
      void ping(true);
    };
    const onApiOk = () => {
      failCount.current = 0;
      setApiDown(false);
    };
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    window.addEventListener(SADHANA_API_OK, onApiOk);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
      window.removeEventListener(SADHANA_API_OK, onApiOk);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ping(force = false) {
    if (cancelled.current) return;
    if (!navigator.onLine) return;
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
      const res = await fetch("/healthz", { signal: ctrl.signal, cache: "no-store" });
      window.clearTimeout(t);
      if (cancelled.current) return;
      if (res.ok) {
        failCount.current = 0;
        setApiDown(false);
        schedule(BASE_INTERVAL_MS);
        return;
      }
      recordFailure(force);
    } catch (err) {
      if (cancelled.current) return;
      // Aborts from a superseded ping shouldn't count as an outage.
      if (err instanceof DOMException && err.name === "AbortError" && !force) {
        schedule(BASE_INTERVAL_MS);
        return;
      }
      recordFailure(force);
    } finally {
      setRetrying(false);
    }
  }

  function recordFailure(force: boolean) {
    failCount.current += 1;
    if (force || failCount.current >= FAIL_THRESHOLD) {
      setApiDown(true);
    }
    const backoff = Math.min(
      MAX_INTERVAL_MS,
      BASE_INTERVAL_MS * Math.pow(2, Math.max(0, failCount.current - 1)),
    );
    schedule(backoff);
  }

  function schedule(ms: number) {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void ping();
    }, ms);
  }

  useEffect(() => {
    cancelled.current = false;
    void ping();
    return () => {
      cancelled.current = true;
      if (timer.current != null) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offline && !apiDown) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 bg-amber-700/95 px-4 py-2 text-center text-sm text-white"
      role="status"
      aria-live="polite"
      data-testid="banner-connectivity"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {offline
          ? "You're offline — practice will save when you're back online."
          : "Having trouble reaching Sadhana. Checking again shortly…"}
      </span>
      {!offline && (
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md bg-white/15 px-3 text-sm font-medium hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          onClick={() => {
            setRetrying(true);
            void ping(true);
          }}
          disabled={retrying}
          data-testid="banner-connectivity-retry"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}
