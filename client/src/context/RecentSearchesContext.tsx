import { createContext, useContext, useState, useCallback } from "react";
import { KEYS, readJson, writeJson } from "@/lib/localPrefs";

type RecentSearchesContextType = {
  recents: string[];
  addRecent: (q: string) => void;
};

const RecentSearchesContext = createContext<RecentSearchesContextType | null>(null);

const MAX_RECENTS = 6;

export function RecentSearchesProvider({ children }: { children: React.ReactNode }) {
  const [recents, setRecents] = useState<string[]>(() => readJson(KEYS.recentSearches, []));

  const addRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecents((prev) => {
      const deduped = prev.filter((r) => r.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...deduped].slice(0, MAX_RECENTS);
      writeJson(KEYS.recentSearches, next);
      return next;
    });
  }, []);

  return (
    <RecentSearchesContext.Provider value={{ recents, addRecent }}>
      {children}
    </RecentSearchesContext.Provider>
  );
}

export function useRecentSearches() {
  const ctx = useContext(RecentSearchesContext);
  if (!ctx) throw new Error("useRecentSearches must be used within RecentSearchesProvider");
  return ctx;
}
