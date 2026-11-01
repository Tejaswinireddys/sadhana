/**
 * What Today's "Continue practice" row shows.
 *
 * Its cards come from several sources that load separately — class progress
 * (which also waits for /api/auth/me), program enrollments, saved sequences —
 * and "Nothing in progress" used to render while any of them was still in
 * flight, then swap to a card 3–4s later. The row now holds a placeholder
 * until every source has answered, and says "Nothing in progress" only when
 * they have all answered with nothing.
 *
 * A source that failed counts as answered (empty): a broken request must not
 * leave a placeholder up forever.
 */
export type ContinueRowState = "loading" | "items" | "empty";

export function continueRowState({
  classProgressPending,
  programsPending,
  hasItems,
}: {
  /** Class progress has not answered yet (including waiting for auth). */
  classProgressPending: boolean;
  /** Enrollments or saved sequences have not answered yet. */
  programsPending: boolean;
  /** At least one card could be shown from what has loaded. */
  hasItems: boolean;
}): ContinueRowState {
  if (classProgressPending || programsPending) return "loading";
  return hasItems ? "items" : "empty";
}
