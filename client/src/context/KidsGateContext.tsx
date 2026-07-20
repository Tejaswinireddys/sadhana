// Kids parent gate unlock — persists for the local calendar day so parents
// aren't re-quizzed on every reload during the same day.

import { createContext, useContext, useState, useCallback } from "react";
import { KEYS, readString, writeString, removeKey } from "@/lib/localPrefs";
import { todayISO } from "@/lib/sadhana";

type KidsGateContextType = {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
};

const KidsGateContext = createContext<KidsGateContextType | null>(null);

function isUnlockedToday(): boolean {
  return readString(KEYS.kidsGateDay) === todayISO();
}

export function KidsGateProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlockedToday);

  const unlock = useCallback(() => {
    writeString(KEYS.kidsGateDay, todayISO());
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    removeKey(KEYS.kidsGateDay);
    setUnlocked(false);
  }, []);

  return (
    <KidsGateContext.Provider value={{ unlocked, unlock, lock }}>
      {children}
    </KidsGateContext.Provider>
  );
}

export function useKidsGate() {
  const ctx = useContext(KidsGateContext);
  if (!ctx) throw new Error("useKidsGate must be used within KidsGateProvider");
  return ctx;
}
