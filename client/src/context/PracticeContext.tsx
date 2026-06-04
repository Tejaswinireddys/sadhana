import { createContext, useContext, useState } from "react";
import type { Asana } from "@/data/content";

// Metadata describing the current queued session — used for journaling tags,
// mood check-ins, and milestone attribution (v3.4).
export type SessionMeta = {
  label: string | null; // e.g. "5 min · I'm tense", "Front Splits — Week 2", or null
  pathwaySlug: string | null;
  breathSlug?: string | null; // optional suggested breath technique
};

type PracticeContextType = {
  todays: Asana[];
  meta: SessionMeta;
  add: (a: Asana) => void;
  remove: (slug: string) => void;
  clear: () => void;
  setMeta: (m: Partial<SessionMeta>) => void;
  /** Replace the whole queue at once, optionally with hold overrides + meta. */
  loadSession: (
    poses: Array<{ asana: Asana; holdSeconds?: number }>,
    meta?: Partial<SessionMeta>,
  ) => void;
};

const DEFAULT_META: SessionMeta = { label: null, pathwaySlug: null, breathSlug: null };

const PracticeContext = createContext<PracticeContextType | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [todays, setTodays] = useState<Asana[]>([]);
  const [meta, setMetaState] = useState<SessionMeta>(DEFAULT_META);

  const add = (a: Asana) =>
    setTodays((prev) => (prev.find((x) => x.slug === a.slug) ? prev : [...prev, a]));
  const remove = (slug: string) => setTodays((prev) => prev.filter((x) => x.slug !== slug));
  const clear = () => {
    setTodays([]);
    setMetaState(DEFAULT_META);
  };
  const setMeta = (m: Partial<SessionMeta>) => setMetaState((prev) => ({ ...prev, ...m }));

  const loadSession: PracticeContextType["loadSession"] = (poses, m) => {
    setTodays(
      poses.map(({ asana, holdSeconds }) =>
        holdSeconds != null ? { ...asana, holdSeconds } : asana,
      ),
    );
    setMetaState({ ...DEFAULT_META, ...(m ?? {}) });
  };

  return (
    <PracticeContext.Provider value={{ todays, meta, add, remove, clear, setMeta, loadSession }}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}
