import { createContext, useContext, useState } from "react";

// In-memory "New" badge for the Coach sidebar entry (v4). Resets every session
// (no persistence — sandbox blocks storage). Shows the pill for the first few
// visits to the Coach page, then hides it.
const MAX_VISITS = 3;

type CoachBadgeContextType = {
  showNew: boolean;
  markVisited: () => void;
};

const CoachBadgeContext = createContext<CoachBadgeContextType | null>(null);

export function CoachBadgeProvider({ children }: { children: React.ReactNode }) {
  const [visits, setVisits] = useState(0);
  const showNew = visits < MAX_VISITS;
  const markVisited = () => setVisits((v) => (v < MAX_VISITS ? v + 1 : v));
  return (
    <CoachBadgeContext.Provider value={{ showNew, markVisited }}>
      {children}
    </CoachBadgeContext.Provider>
  );
}

export function useCoachBadge() {
  const ctx = useContext(CoachBadgeContext);
  if (!ctx) throw new Error("useCoachBadge must be used within CoachBadgeProvider");
  return ctx;
}
