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
  seen: { welcomeSeen: boolean; onboardingDone: boolean },
): string | null {
  if (seen.welcomeSeen || seen.onboardingDone) return null;
  const pathname = path.split("?")[0] || "/";
  if (pathname !== "/") return null;
  const query = search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `/welcome${query}`;
}
