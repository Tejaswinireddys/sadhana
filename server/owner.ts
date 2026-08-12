import type { Request, Response, NextFunction } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE, ownerIdForUser, readCookie } from "./auth";
import { storage } from "./storage";

const COOKIE = "sadhana_device";
const HEADER = "x-device-id";
const PROOF_HEADER = "x-device-proof";
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
/** HMAC proof the client stores alongside the bare UUID (not HttpOnly). */
export const DEVICE_PROOF_ECHO_HEADER = "X-Device-Proof";

// Browsers cap persistent cookies at 400 days (chromium); ask for exactly that.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function deviceSecret(): string {
  return (
    process.env.DEVICE_ID_SECRET?.trim() ||
    process.env.BILLING_CANCEL_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    // Dev-only fallback so local boot works without extra env. Production
    // deployments should set DEVICE_ID_SECRET (or SESSION_SECRET).
    "sadhana-dev-device-secret"
  );
}

/** HMAC proof for a device UUID — possession of UUID alone is not enough. */
export function deviceProof(id: string): string {
  return createHmac("sha256", deviceSecret()).update(`device:v1:${id}`).digest("base64url");
}

export function verifyDeviceProof(id: string, proof: string | undefined | null): boolean {
  if (!proof || !isValidDeviceId(id)) return false;
  const expected = deviceProof(id);
  const a = Buffer.from(expected);
  const b = Buffer.from(proof);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Cookie payload: `v1.<uuid>.<proof>` (or legacy bare uuid during migration). */
export function encodeDeviceCookie(id: string): string {
  return `v1.${id}.${deviceProof(id)}`;
}

export function parseDeviceCookie(
  raw: string | undefined,
): { id: string; proof: string | null; legacy: boolean } | null {
  if (!raw) return null;
  if (isValidDeviceId(raw)) {
    return { id: raw, proof: null, legacy: true };
  }
  const parts = raw.split(".");
  if (parts.length === 3 && parts[0] === "v1" && isValidDeviceId(parts[1]!)) {
    const id = parts[1]!;
    const proof = parts[2]!;
    if (!verifyDeviceProof(id, proof)) return null;
    return { id, proof, legacy: false };
  }
  return null;
}

function deviceCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(encodeDeviceCookie(id))}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`;
}

function echoDevice(res: Response, id: string) {
  const proof = deviceProof(id);
  res.setHeader(DEVICE_ECHO_HEADER, id);
  res.setHeader(DEVICE_PROOF_ECHO_HEADER, proof);
  res.append(
    "Access-Control-Expose-Headers",
    `${DEVICE_ECHO_HEADER}, ${DEVICE_PROOF_ECHO_HEADER}`,
  );
}

/**
 * The device identity for this request.
 *
 * Guest practice data is keyed by a server-issued device UUID. The HttpOnly
 * cookie is the identity of record. A bare UUID in `X-Device-Id` is **not**
 * enough to adopt another browser's data — callers must also present a matching
 * HMAC proof (`X-Device-Proof` or a signed cookie).
 *
 * Reconciliation rules, in order:
 *   1. Valid signed (or legacy) cookie → that id wins. A mismatched header is
 *      ignored so replaying someone else's UUID cannot hijack a session that
 *      already has a cookie.
 *   2. No cookie, but header + valid proof → adopt (localStorage recovery after
 *      cookie eviction) and (re)issue the signed cookie.
 *   3. No cookie, header only, legacy unsigned accept → only when
 *      `ALLOW_LEGACY_DEVICE_HEADER=1` (default off in production). Prefer proof.
 *   4. Neither → mint a new id and set the signed cookie.
 */
export function resolveDeviceOwner(req: Request, res: Response): string {
  const fromHeader = req.get(HEADER)?.trim();
  const fromProof = req.get(PROOF_HEADER)?.trim();
  const fromCookieRaw = parseCookie(req.headers.cookie, COOKIE);
  const parsedCookie = parseDeviceCookie(fromCookieRaw);

  if (parsedCookie) {
    // Cookie is authoritative. Never let a mismatched header swap owners.
    if (parsedCookie.legacy || !parsedCookie.proof) {
      // Upgrade legacy bare-uuid cookies to signed form.
      res.append("Set-Cookie", deviceCookie(parsedCookie.id));
    }
    echoDevice(res, parsedCookie.id);
    return parsedCookie.id;
  }

  if (fromHeader && isValidDeviceId(fromHeader) && verifyDeviceProof(fromHeader, fromProof)) {
    res.append("Set-Cookie", deviceCookie(fromHeader));
    echoDevice(res, fromHeader);
    return fromHeader;
  }

  // Optional migration escape hatch for pre-proof clients (dev / staged rollout).
  const allowLegacyHeader =
    process.env.ALLOW_LEGACY_DEVICE_HEADER === "1" ||
    (process.env.NODE_ENV !== "production" && process.env.ALLOW_LEGACY_DEVICE_HEADER !== "0");
  if (allowLegacyHeader && fromHeader && isValidDeviceId(fromHeader)) {
    res.append("Set-Cookie", deviceCookie(fromHeader));
    echoDevice(res, fromHeader);
    return fromHeader;
  }

  const id = randomUUID();
  res.append("Set-Cookie", deviceCookie(id));
  echoDevice(res, id);
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
