/**
 * Password hashing, session tokens, and the auth cookie.
 *
 * Uses node:crypto only — no auth dependency to keep the free-tier deploy
 * simple. Sessions are opaque random tokens stored server-side so signing out
 * (or wiping an account) revokes access immediately.
 */
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const AUTH_COOKIE = "sadhana_session";
export const SESSION_DAYS = 90;
/** Password-reset codes expire quickly and are single-use. */
export const RESET_TOKEN_MINUTES = 60;
/** Email verification links stay valid longer so inbox delay is forgiving. */
export const VERIFY_TOKEN_HOURS = 48;

/** `scrypt$<salt-hex>$<key-hex>` — self-describing so the format can evolve. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function newDeviceId(): string {
  return randomUUID();
}

export function sessionExpiry(from = new Date()): string {
  return new Date(from.getTime() + SESSION_DAYS * 86_400_000).toISOString();
}

/** Owner key for an account. Guests keep using their raw device UUID. */
export function ownerIdForUser(userId: number): string {
  return `user:${userId}`;
}

export function authCookie(token: string, secure: boolean): string {
  const parts = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_DAYS * 86_400}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearedAuthCookie(secure: boolean): string {
  const parts = [`${AUTH_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function newResetToken(): string {
  return randomBytes(32).toString("hex");
}

/** Store only a hash of the reset token so a DB leak cannot reset passwords. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenExpiry(from = new Date()): string {
  return new Date(from.getTime() + RESET_TOKEN_MINUTES * 60_000).toISOString();
}

/**
 * A recovery code the practitioner keeps, for deployments with no email.
 *
 * Without one, an account created on a server that cannot send mail is dead on
 * arrival: signup withholds the session until the address is verified, and the
 * verification link never arrives. This is the only way back in, so it is
 * shown once at signup and stored hashed like any other reset token.
 *
 * 20 base32 characters ≈ 100 bits, grouped for transcription. The alphabet
 * omits I, L, O, U and 0/1 so a handwritten code is not ambiguous.
 */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const RECOVERY_CODE_GROUPS = 4;
export const RECOVERY_CODE_GROUP_LEN = 5;

export function newRecoveryCode(): string {
  const len = RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LEN;
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += RECOVERY_ALPHABET[bytes[i]! % RECOVERY_ALPHABET.length];
  }
  return (out.match(/.{1,5}/g) ?? [out]).join("-");
}

/**
 * Codes are read off paper, so accept lowercase, missing dashes and stray
 * spaces. Normalising before hashing is what makes the code usable at all.
 */
export function normalizeRecoveryCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (bare.match(/.{1,5}/g) ?? [bare]).join("-");
}

export function looksLikeRecoveryCode(input: string): boolean {
  return /^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/.test(normalizeRecoveryCode(input));
}

/** Recovery codes do not expire on a timer — losing one has no other remedy. */
export function recoveryCodeExpiry(from = new Date()): string {
  return new Date(from.getTime() + 10 * 365 * 24 * 3_600_000).toISOString();
}

export function newVerifyToken(): string {
  return newResetToken();
}

export function hashVerifyToken(token: string): string {
  return hashResetToken(token);
}

export function verifyTokenExpiry(from = new Date()): string {
  return new Date(from.getTime() + VERIFY_TOKEN_HOURS * 3_600_000).toISOString();
}
