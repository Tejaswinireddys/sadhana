import { useCallback, useEffect, useState } from "react";

/** Reveals list items in batches as the sentinel scrolls into view. */
export function useProgressiveList<T>(items: T[], batchSize = 24) {
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [items, batchSize]);

  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(
    () => setVisibleCount((n) => Math.min(n + batchSize, items.length)),
    [batchSize, items.length],
  );

  return { visible, hasMore, loadMore, visibleCount, total: items.length };
}
