import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const COOKIE = "sadhana_device";
const HEADER = "x-device-id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDeviceId(id: string): boolean {
  return UUID_RE.test(id);
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

declare global {
  namespace Express {
    interface Request {
      ownerId: string;
    }
  }
}

/** Resolve anonymous device identity from header or cookie; mint one if missing. */
export function ownerMiddleware(req: Request, res: Response, next: NextFunction) {
  const fromHeader = req.get(HEADER)?.trim();
  if (fromHeader && isValidDeviceId(fromHeader)) {
    req.ownerId = fromHeader;
    return next();
  }

  const fromCookie = parseCookie(req.headers.cookie, COOKIE);
  if (fromCookie && isValidDeviceId(fromCookie)) {
    req.ownerId = fromCookie;
    return next();
  }

  const id = randomUUID();
  req.ownerId = id;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
  next();
}
