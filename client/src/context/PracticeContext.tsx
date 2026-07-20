import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Asana } from "@/data/content";
import { asanaBySlug } from "@/data/content";
import {
  loadPersistedPractice,
  savePersistedPractice,
  clearPersistedPractice,
  type PersistedProgress,
} from "@/lib/practicePersist";

// A queued pose is an Asana plus optional per-session details that don't live
// on the base Asana (e.g. whether the pose is held on each side). Guided mode
// reads `sides` to decide whether to re-narrate for the second side.
export type QueuedAsana = Asana & {
  sides?: "once" | "each";
};

// Metadata describing the current queued session — used for journaling tags,
// mood check-ins, and milestone attribution (v3.4).
export type SessionMeta = {
  label: string | null; // e.g. "5 min · I'm tense", "Front Splits — Week 2", or null
  pathwaySlug: string | null;
  breathSlug?: string | null; // optional suggested breath technique
};

type PracticeContextType = {
  todays: QueuedAsana[];
  meta: SessionMeta;
  add: (a: Asana) => void;
  remove: (slug: string) => void;
  clear: () => void;
  setMeta: (m: Partial<SessionMeta>) => void;
  /** Replace the whole queue at once, optionally with hold + sides overrides + meta. */
  loadSession: (
    poses: Array<{ asana: Asana; holdSeconds?: number; sides?: "once" | "each" }>,
    meta?: Partial<SessionMeta>,
  ) => void;
  /** Snapshot guided/practice progress so a refresh can resume. */
  saveProgress: (progress: PersistedProgress | null) => void;
  /** Latest in-progress snapshot (also hydrated from sessionStorage on boot). */
  progress: PersistedProgress | null;
  /** One-shot flag: true until Practice/Guided consumes a restored snapshot. */
  needsRestore: boolean;
  consumeRestoredProgress: () => void;
};

const DEFAULT_META: SessionMeta = {
  label: null,
  pathwaySlug: null,
  breathSlug: null,
};

function hydrateFromStorage(): {
  todays: QueuedAsana[];
  meta: SessionMeta;
  progress: PersistedProgress | null;
} {
  const saved = loadPersistedPractice();
  if (!saved || saved.poses.length === 0) {
    return { todays: [], meta: DEFAULT_META, progress: null };
  }
  const todays: QueuedAsana[] = [];
  for (const p of saved.poses) {
    const asana = asanaBySlug(p.slug);
    if (!asana) continue;
    todays.push({
      ...asana,
      ...(p.holdSeconds != null ? { holdSeconds: p.holdSeconds } : {}),
      ...(p.sides ? { sides: p.sides } : {}),
    });
  }
  return {
    todays,
    meta: { ...DEFAULT_META, ...(saved.meta ?? {}) },
    progress: saved.progress ?? null,
  };
}

const PracticeContext = createContext<PracticeContextType | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const initial = hydrateFromStorage();
  const [todays, setTodays] = useState<QueuedAsana[]>(initial.todays);
  const [meta, setMetaState] = useState<SessionMeta>(initial.meta);
  const [progress, setProgress] = useState<PersistedProgress | null>(initial.progress);
  const [needsRestore, setNeedsRestore] = useState(!!initial.progress?.started);

  // Persist queue whenever it changes.
  useEffect(() => {
    if (todays.length === 0) {
      clearPersistedPractice();
      return;
    }
    const saved = loadPersistedPractice();
    savePersistedPractice({
      poses: todays.map((a) => ({
        slug: a.slug,
        holdSeconds: a.holdSeconds,
        sides: a.sides,
      })),
      meta,
      progress: saved?.progress ?? null,
    });
  }, [todays, meta]);

  const add = (a: Asana) =>
    setTodays((prev) => (prev.find((x) => x.slug === a.slug) ? prev : [...prev, a]));
  const remove = (slug: string) => setTodays((prev) => prev.filter((x) => x.slug !== slug));
  const clear = () => {
    setTodays([]);
    setMetaState(DEFAULT_META);
    setProgress(null);
    setNeedsRestore(false);
    clearPersistedPractice();
  };
  const setMeta = (m: Partial<SessionMeta>) => setMetaState((prev) => ({ ...prev, ...m }));

  const loadSession: PracticeContextType["loadSession"] = (poses, m) => {
    setTodays(
      poses.map(({ asana, holdSeconds, sides }) => ({
        ...asana,
        ...(holdSeconds != null ? { holdSeconds } : {}),
        ...(sides ? { sides } : {}),
      })),
    );
    setMetaState({ ...DEFAULT_META, ...(m ?? {}) });
    setProgress(null);
    setNeedsRestore(false);
    // Clear stale progress when loading a new session.
    savePersistedPractice({
      poses: poses.map(({ asana, holdSeconds, sides }) => ({
        slug: asana.slug,
        holdSeconds,
        sides,
      })),
      meta: { ...DEFAULT_META, ...(m ?? {}) },
      progress: null,
    });
  };

  const saveProgress = useCallback((next: PersistedProgress | null) => {
    setProgress(next);
    const saved = loadPersistedPractice();
    if (!saved || saved.poses.length === 0) return;
    savePersistedPractice({ ...saved, progress: next });
  }, []);

  const consumeRestoredProgress = useCallback(() => {
    setNeedsRestore(false);
  }, []);

  return (
    <PracticeContext.Provider
      value={{
        todays,
        meta,
        add,
        remove,
        clear,
        setMeta,
        loadSession,
        saveProgress,
        progress,
        needsRestore,
        consumeRestoredProgress,
      }}
    >
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}
