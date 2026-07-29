import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { AUTH_COOKIE, ownerIdForUser, readCookie } from "./auth";
import { storage } from "./storage";

const COOKIE = "sadhana_device";
const HEADER = "x-device-id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDeviceId(id: string): boolean {
  return UUID_RE.test(id);
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  return readCookie(header, name);
}

declare global {
  namespace Express {
    interface Request {
      ownerId: string;
      /** Set only when a valid account session cookie was presented. */
      userId?: number;
      /** The anonymous owner for this browser, even while signed in. */
      deviceOwnerId: string;
    }
  }
}

/** Response header the client mirrors back into localStorage. */
export const DEVICE_ECHO_HEADER = "X-Device-Id";

// Browsers cap persistent cookies at 400 days (chromium); ask for exactly that.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function deviceCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`;
}

/**
 * The device identity for this request.
 *
 * The cookie is the identity of record: it is the copy that survives a
 * localStorage eviction (Safari ITP, "clear site data", storage pressure), and
 * losing it used to orphan every session, journal entry and streak on the
 * server with no way back.
 *
 * Reconciliation rules, in order:
 *   1. A header id wins, because that is where existing data already lives —
 *      preferring the cookie outright would strand every current user whose two
 *      ids diverged. The cookie is (re)written to match, so the two agree from
 *      now on.
 *   2. No header but a valid cookie: this is the recovery path. The browser lost
 *      localStorage; the cookie hands the same owner id straight back.
 *   3. Neither: mint one and set it.
 *
 * The client only sends the header when it *already* has an id, so a wiped
 * localStorage can never overwrite a good cookie with a freshly minted id.
 */
export function resolveDeviceOwner(req: Request, res: Response): string {
  const fromHeader = req.get(HEADER)?.trim();
  const fromCookie = parseCookie(req.headers.cookie, COOKIE);
  const cookieOk = !!fromCookie && isValidDeviceId(fromCookie);

  if (fromHeader && isValidDeviceId(fromHeader)) {
    if (fromCookie !== fromHeader) res.append("Set-Cookie", deviceCookie(fromHeader));
    return fromHeader;
  }

  if (cookieOk) return fromCookie!;

  const id = randomUUID();
  res.append("Set-Cookie", deviceCookie(id));
  return id;
}

/**
 * Resolve who owns the data for this request.
 *
 * A valid account session wins; otherwise the anonymous device identity is used,
 * so guest practice keeps working exactly as it did before accounts existed.
 */
export async function ownerMiddleware(req: Request, res: Response, next: NextFunction) {
  req.deviceOwnerId = resolveDeviceOwner(req, res);
  req.ownerId = req.deviceOwnerId;

  // Hand the resolved id back so a client that lost localStorage can re-seed it
  // from the cookie it can no longer read itself.
  res.setHeader(DEVICE_ECHO_HEADER, req.deviceOwnerId);
  res.append("Access-Control-Expose-Headers", DEVICE_ECHO_HEADER);

  const token = parseCookie(req.headers.cookie, AUTH_COOKIE);
  if (token) {
    try {
      const session = await storage.getAuthSession(token);
      if (session && new Date(session.expiresAt).getTime() > Date.now()) {
        req.userId = session.userId;
        req.ownerId = ownerIdForUser(session.userId);
      }
    } catch {
      // A storage hiccup must not lock anyone out — fall back to guest ownership.
    }
  }

  next();
}
