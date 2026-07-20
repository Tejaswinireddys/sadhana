import { useEffect, useRef } from "react";

/**
 * Keep the screen awake while `active` is true (yoga timer / guided flow).
 * Silently no-ops when the Wake Lock API is missing or the request fails.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function request() {
      if (!active || !("wakeLock" in navigator)) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        /* permission denied / unsupported document state */
      }
    }

    async function release() {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s) {
        try {
          await s.release();
        } catch {
          /* ignore */
        }
      }
    }

    if (active) {
      void request();
    } else {
      void release();
    }

    // Re-acquire after tab visibility returns (browsers release on hide).
    const onVisibility = () => {
      if (document.visibilityState === "visible" && active && !sentinelRef.current) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [active]);
}
