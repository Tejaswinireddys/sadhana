/**
 * Cross-tab practice data sync.
 * After a confirmed session/journal write, broadcast so other open tabs
 * invalidate journal + progress queries instead of showing stale counts.
 */

const CHANNEL = "sadhana-practice-data";
const STORAGE_KEY = "sadhana.practiceData.rev";

export type PracticeDataChangedDetail = {
  at: number;
  source: "session" | "journal" | "breathing" | "manual";
};

function canUseBroadcast(): boolean {
  return typeof BroadcastChannel !== "undefined";
}

/** Notify other tabs (and same-tab subscribers) that practice data changed. */
export function broadcastPracticeDataChanged(
  source: PracticeDataChangedDetail["source"] = "manual",
): void {
  const detail: PracticeDataChangedDetail = { at: Date.now(), source };
  try {
    if (canUseBroadcast()) {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage(detail);
      ch.close();
    }
  } catch {
    /* private mode / unsupported */
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(detail.at));
    }
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sadhana:practice-data", { detail }));
  }
}

/** Subscribe to practice-data changes from this tab or others. */
export function subscribePracticeDataChanged(
  onChange: (detail: PracticeDataChangedDetail) => void,
): () => void {
  const fromEvent = (e: Event) => {
    const detail = (e as CustomEvent<PracticeDataChangedDetail>).detail;
    if (detail) onChange(detail);
  };
  window.addEventListener("sadhana:practice-data", fromEvent);

  let ch: BroadcastChannel | null = null;
  if (canUseBroadcast()) {
    try {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (msg) => {
        const detail = msg.data as PracticeDataChangedDetail | undefined;
        if (detail?.at) onChange(detail);
      };
    } catch {
      ch = null;
    }
  }

  const fromStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || e.newValue == null) return;
    const at = Number(e.newValue);
    if (Number.isFinite(at)) onChange({ at, source: "manual" });
  };
  window.addEventListener("storage", fromStorage);

  return () => {
    window.removeEventListener("sadhana:practice-data", fromEvent);
    window.removeEventListener("storage", fromStorage);
    try {
      ch?.close();
    } catch {
      /* ignore */
    }
  };
}

/** Query keys that must refresh after a practice write. */
export const PRACTICE_DATA_QUERY_KEYS = [
  ["/api/journal"],
  ["/api/sessions/stats"],
  ["/api/sessions"],
] as const;
