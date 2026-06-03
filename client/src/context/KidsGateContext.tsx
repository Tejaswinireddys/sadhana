// Transient session flag for the kids "parent gate". When the user answers the
// math question correctly, the gate is unlocked for the remainder of the
// session. NOT persisted (no localStorage/sessionStorage) — it resets on
// reload, so the gate shows again on the next session, as required.

import { createContext, useContext, useState } from "react";

type KidsGateContextType = {
  unlocked: boolean;
  unlock: () => void;
};

const KidsGateContext = createContext<KidsGateContextType | null>(null);

export function KidsGateProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <KidsGateContext.Provider value={{ unlocked, unlock: () => setUnlocked(true) }}>
      {children}
    </KidsGateContext.Provider>
  );
}

export function useKidsGate() {
  const ctx = useContext(KidsGateContext);
  if (!ctx) throw new Error("useKidsGate must be used within KidsGateProvider");
  return ctx;
}
