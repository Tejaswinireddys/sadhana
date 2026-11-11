import type { Journal as JournalEntry } from "@shared/schema";

/**
 * Apply a create/update to the cached journal list. Invalidate-only was racing
 * a stale GET under `staleTime: Infinity`, so the toast fired while the list
 * stayed on the previous empty array.
 */
export function applyJournalSaved(
  list: JournalEntry[] | undefined,
  entry: JournalEntry,
): JournalEntry[] {
  const prev = list ?? [];
  const idx = prev.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    const next = prev.slice();
    next[idx] = entry;
    return next;
  }
  return [entry, ...prev];
}

/** Drop a deleted entry from the cached journal list immediately. */
export function applyJournalDeleted(
  list: JournalEntry[] | undefined,
  id: number,
): JournalEntry[] {
  return (list ?? []).filter((e) => e.id !== id);
}
