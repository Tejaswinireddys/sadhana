import { createContext, useContext, useState } from "react";
import type { Asana } from "@/data/content";

type PracticeContextType = {
  todays: Asana[];
  add: (a: Asana) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const PracticeContext = createContext<PracticeContextType | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [todays, setTodays] = useState<Asana[]>([]);

  const add = (a: Asana) =>
    setTodays((prev) => (prev.find((x) => x.slug === a.slug) ? prev : [...prev, a]));
  const remove = (slug: string) => setTodays((prev) => prev.filter((x) => x.slug !== slug));
  const clear = () => setTodays([]);

  return (
    <PracticeContext.Provider value={{ todays, add, remove, clear }}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}
