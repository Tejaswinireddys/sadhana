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

/** The device identity for this request, minting and setting one when absent. */
function resolveDeviceOwner(req: Request, res: Response): string {
  const fromHeader = req.get(HEADER)?.trim();
  if (fromHeader && isValidDeviceId(fromHeader)) return fromHeader;

  const fromCookie = parseCookie(req.headers.cookie, COOKIE);
  if (fromCookie && isValidDeviceId(fromCookie)) return fromCookie;

  const id = randomUUID();
  res.append(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
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
