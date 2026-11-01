/**
 * Where a first-time visitor is sent before the app renders, if anywhere.
 *
 * Only the bare home page (`/`) introduces the product. Every other path was
 * asked for by name — a shared pose, a pathway, a bookmark, a search result —
 * so it renders directly, signed in or not. This gate used to send *any*
 * non-marketing path to `/welcome`, which threw away the deep link and left a
 * visitor who followed `/asanas/marjaryasana-bitilasana` on the landing page.
 *
 * The query string travels with the redirect (`/?ref=program-x` →
 * `/welcome?ref=program-x`) so campaign and program seeds are not lost either.
 */
export function welcomeRedirectTarget(
  path: string,
  search: string,
  seen: { welcomeSeen: boolean; onboardingDone: boolean; signedIn?: boolean },
): string | null {
  // An account holder is not new, whether or not they did onboarding (or did
  // it in another browser): they land on Today.
  if (seen.welcomeSeen || seen.onboardingDone || seen.signedIn) return null;
  const pathname = path.split("?")[0] || "/";
  if (pathname !== "/") return null;
  const query = search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `/welcome${query}`;
}

/** Both HTML entry points must canonicalize old bookmarks before selecting a page. */
export function legacyRouteTarget(hash: string): string | null {
  if (!hash.startsWith("#/")) return null;
  try {
    const base = "https://sadhana.invalid";
    const target = new URL(hash.slice(1), base);
    if (target.origin !== base) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return null; }
}

/** Recover the workspace when the server chose welcome.html without browser-only preferences. */
export function welcomeEntryTarget(
  location: { pathname: string; search: string; hash: string },
  seen: { welcomeSeen: boolean; onboardingDone: boolean },
): string | null {
  const legacy = legacyRouteTarget(location.hash);
  if (legacy) return legacy;
  const { pathname, search, hash } = location;
  if (pathname === "/welcome") return null;
  const fragment = hash === "#" ? "" : hash;
  if (pathname === "/" && !seen.welcomeSeen && !seen.onboardingDone) {
    return `/welcome${search}${fragment}`;
  }
  return `${pathname}${search}${fragment}`;
}

export type HomeEntry = "landing" | "workspace" | "checking";

/**
 * What the app shell renders for a path, before the workspace loads.
 *
 * `/` is the welcome page only for a brand-new guest. With no local flags the
 * shell cannot tell a new guest from an account holder on a fresh browser
 * (the session cookie is HttpOnly), so it asks `/api/auth/me` first —
 * `signedIn` is `undefined` while that is in flight — instead of flashing the
 * landing page at someone who is signed in.
 */
export function homeEntry(
  path: string,
  seen: { welcomeSeen: boolean; onboardingDone: boolean; signedIn: boolean | undefined },
): HomeEntry {
  const pathname = path.split("?")[0] || "/";
  if (pathname === "/welcome") return "landing";
  if (pathname !== "/" || seen.welcomeSeen || seen.onboardingDone) return "workspace";
  if (seen.signedIn === undefined) return "checking";
  return seen.signedIn ? "workspace" : "landing";
}
