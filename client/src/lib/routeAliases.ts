/**
 * Conventional URLs people type or link to that the app has under another
 * name. `/login`, `/signin`, `/sign-in` and `/signup` are the Sign in / Sign up
 * tabs of `/account`;
 * `/today` is the home page. Before these existed, opening one directly hit
 * the app's Not Found page with HTTP 404.
 *
 * `main.tsx` rewrites an alias with `replaceState` before React mounts, so
 * the router (and history) only ever see the real page — the same pattern as
 * the legacy `/#/…` redirect. The server asks `aliasRouteTarget` too, so it
 * answers exactly these paths (not `/login/extra`) with 200 and the app shell
 * instead of a 404. A new entry here is all a new alias needs on both sides.
 */
export const ROUTE_ALIASES: Readonly<Record<string, { pathname: string; params?: Readonly<Record<string, string>> }>> = {
  "/login": { pathname: "/account", params: { tab: "signin" } },
  "/signin": { pathname: "/account", params: { tab: "signin" } },
  "/sign-in": { pathname: "/account", params: { tab: "signin" } },
  "/signup": { pathname: "/account", params: { tab: "signup" } },
  "/today": { pathname: "/" },
};

/**
 * The canonical URL for an alias path, or null when `pathname` is not one.
 * A trailing slash is ignored. The visitor's own query string and fragment
 * are kept, and a query parameter they set wins over the alias's default
 * (`/login?tab=reset` opens the reset tab).
 */
export function aliasRouteTarget(pathname: string, search = "", hash = ""): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const alias = ROUTE_ALIASES[normalized.toLowerCase()];
  if (!alias) return null;
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(alias.params ?? {})) {
    if (!params.has(key)) params.set(key, value);
  }
  const query = params.toString();
  const fragment = hash === "#" ? "" : hash;
  return `${alias.pathname}${query ? `?${query}` : ""}${fragment}`;
}
