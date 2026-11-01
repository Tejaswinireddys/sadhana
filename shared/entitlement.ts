export type AccountPlan = "free" | "plus";

/** Missing, stale or unrecognised plans never grant access. */
export function accountPlan(user?: { plan?: unknown } | null): AccountPlan {
  return user?.plan === "plus" ? "plus" : "free";
}

export function canAccessContent(plan: AccountPlan, content: { isPlus: boolean }): boolean {
  return !content.isPlus || plan === "plus";
}
