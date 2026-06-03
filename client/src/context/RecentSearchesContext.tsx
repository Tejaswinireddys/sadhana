// RecentSearches — keeps the last handful of search queries in memory only.
// Intentionally NOT persisted (no localStorage/sessionStorage) — it resets on
// reload, matching the rest of the app's transient-state approach.
import { createContext, useContext, useState, useCallback } from "react";

type RecentSearchesContextType = {
  recents: string[];
  addRecent: (q: string) => void;
};

const RecentSearchesContext = createContext<RecentSearchesContextType | null>(null);

const MAX_RECENTS = 6;

export function RecentSearchesProvider({ children }: { children: React.ReactNode }) {
  const [recents, setRecents] = useState<string[]>([]);

  const addRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecents((prev) => {
      const deduped = prev.filter((r) => r.toLowerCase() !== trimmed.toLowerCase());
      return [trimmed, ...deduped].slice(0, MAX_RECENTS);
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
