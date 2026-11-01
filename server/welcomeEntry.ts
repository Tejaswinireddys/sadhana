import { AUTH_COOKIE } from "./auth";

const WELCOME_SEEN_COOKIE = "sadhana_welcome_seen";

function hasCookie(header: string | undefined, name: string, value?: string): boolean {
  return (header || "").split(";").some((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) return false;
    const current = rest.join("=");
    return value === undefined ? current.length > 0 : current === value;
  });
}

/**
 * Whether `/` (or `/welcome`) is answered with the marketing page instead of
 * the app. `/welcome` always is. `/` is only for brand-new guests: someone who
 * has seen the welcome page, or who has an account session in this browser,
 * lands on Today. A session that has since expired still means "not new";
 * the app then shows Today signed out, which is where they would sign in.
 */
export function servesWelcomeHtml(pathname: string, cookieHeader: string | undefined): boolean {
  if (pathname === "/welcome") return true;
  if (pathname !== "/") return false;
  return !hasCookie(cookieHeader, WELCOME_SEEN_COOKIE, "1") && !hasCookie(cookieHeader, AUTH_COOKIE);
}
