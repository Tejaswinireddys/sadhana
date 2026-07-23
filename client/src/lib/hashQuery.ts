/**
 * Hash-routing query helpers.
 * wouter's hash navigate stores `?…` on `location.search` (and sometimes in the hash).
 * Read both so deep links work; clear sticky search when navigating without a query.
 */

export function readUrlParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const fromSearch = new URLSearchParams(window.location.search).get(name);
  if (fromSearch) return fromSearch;
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(hash.slice(qIndex + 1)).get(name);
}

/** Drop sticky `location.search` left over from a previous hash navigation. */
export function clearStickySearchParams(): void {
  if (typeof window === "undefined") return;
  if (!window.location.search) return;
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.hash}`);
}
