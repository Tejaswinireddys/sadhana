import { useAuth } from "@/lib/auth";
import { accountPlan, canAccessContent } from "@shared/entitlement";

/** Account data is authoritative; local plan preferences never grant access. */
export function useEntitlement() {
  const { user, isLoading } = useAuth();
  const plan = accountPlan(user);
  return { plan, isPlus: plan === "plus", isLoading,
    canAccess: (content: { isPlus: boolean }) => canAccessContent(plan, content),
  };
}
