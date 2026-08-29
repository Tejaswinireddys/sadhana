/**
 * URL query helpers.
 * With path-based routing the query lives on `location.search` (e.g.
 * `/breathing?slug=box`). A legacy hash query (`#/breathing?slug=box`) is read
 * as a fallback so links shared before the routing migration still resolve.
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

export type AccountAuthTab = "signin" | "signup" | "reset";

/**
 * Map `/account?tab=` to the Account page tabs.
 * Public links use `create` (the visible tab label); the Radix value is `signup`.
 */
export function accountAuthTab(raw: string | null | undefined): AccountAuthTab {
  switch ((raw ?? "").toLowerCase()) {
    case "create":
    case "signup":
    case "sign-up":
      return "signup";
    case "reset":
      return "reset";
    default:
      return "signin";
  }
}

/** Drop a one-shot `location.search` (e.g. deep-link prefill params) from the URL. */
export function clearStickySearchParams(): void {
  if (typeof window === "undefined") return;
  if (!window.location.search) return;
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.hash}`);
}
