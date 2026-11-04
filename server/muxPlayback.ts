import { createPrivateKey, sign } from "node:crypto";
import type { Express } from "express";
import { ASANAS, PATHWAYS } from "../client/src/data/content";
import { storage, type IStorage } from "./storage";
import { getPosePlayback, type PoseMediaRow } from "./poseStreamStore";
import { buildPoseMediaManifest } from "./poseMediaManifest";
import { streamProvider } from "./streamConfig";

export const MUX_TOKEN_SECONDS = 15 * 60;

class PlaybackError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Mux JWT audiences: video, thumbnail, storyboard. */
export type MuxTokenAudience = "v" | "t" | "s";

/** True when both signing env vars are present (the key is parsed on first use). */
export function muxSigningConfigured(): boolean {
  return !!process.env.MUX_SIGNING_KEY_ID?.trim() && !!process.env.MUX_SIGNING_KEY_PRIVATE?.trim();
}

/**
 * Sign only server-resolved playback IDs; private keys never leave this module.
 * `claims` carries Mux's image options (`time`, `width`, …): on a signed id
 * they must be inside the token, and Mux rejects them as query parameters.
 */
export function signMuxToken(
  playbackId: string,
  audience: MuxTokenAudience,
  ttlSeconds: number,
  now = Math.floor(Date.now() / 1000),
  claims: Record<string, string | number> = {},
) {
  const kid = process.env.MUX_SIGNING_KEY_ID?.trim();
  const value = process.env.MUX_SIGNING_KEY_PRIVATE?.trim();
  if (!kid || !value) throw new PlaybackError(503, "Signed video playback is not configured");
  try {
    const pem = value.includes("-----BEGIN") ? value.replace(/\\n/g, "\n") : Buffer.from(value, "base64").toString("utf8");
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== "rsa") throw new Error("RSA key required");
    const expiresAt = now + ttlSeconds;
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ ...claims, sub: playbackId, aud: audience, kid, iat: now, exp: expiresAt })).toString("base64url");
    const input = `${header}.${payload}`;
    return { token: `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`, expiresAt };
  } catch { throw new PlaybackError(503, "Signed video playback is not configured"); }
}

export function signMuxPlayback(playbackId: string, now = Math.floor(Date.now() / 1000)) {
  return signMuxToken(playbackId, "v", MUX_TOKEN_SECONDS, now);
}

let warnedUnsigned = false;
/**
 * Video, thumbnail and storyboard tokens for a class, all with one expiry.
 * Returns null (and warns once) when signing is unavailable, so the caller
 * withholds the class instead of serving anything public.
 */
export function signClassPlayback(playbackId: string, ttlSeconds: number, now = Math.floor(Date.now() / 1000)) {
  if (!/^[a-zA-Z0-9_-]+$/.test(playbackId)) return null;
  try {
    const playback = signMuxToken(playbackId, "v", ttlSeconds, now);
    const thumbnail = signMuxToken(playbackId, "t", ttlSeconds, now);
    const storyboard = signMuxToken(playbackId, "s", ttlSeconds, now);
    return { tokens: { playback: playback.token, thumbnail: thumbnail.token, storyboard: storyboard.token }, expiresAt: playback.expiresAt };
  } catch {
    if (!warnedUnsigned) {
      warnedUnsigned = true;
      console.warn("[classes] MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE missing or invalid — signed classes stay unplayable");
    }
    return null;
  }
}

/** Poster frames are fetched once and cached, so a short-lived token is enough. */
const CLASS_THUMBNAIL_TOKEN_SECONDS = 5 * 60;

/** Cards and the locked panel render posters at 640×360. */
export const CLASS_THUMBNAIL_WIDTH = 640;

/**
 * A Mux `t` token for one poster frame of a signed class. The frame time and
 * width are claims, so the token fetches that one image and nothing else.
 * Null when signing is unavailable or the id is malformed.
 */
export function signClassThumbnail(playbackId: string, timeSec: number | null, now = Math.floor(Date.now() / 1000)): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(playbackId)) return null;
  const claims: Record<string, number> = { width: CLASS_THUMBNAIL_WIDTH };
  if (typeof timeSec === "number" && timeSec >= 0) claims.time = timeSec;
  try { return signMuxToken(playbackId, "t", CLASS_THUMBNAIL_TOKEN_SECONDS, now, claims).token; } catch { return null; }
}

let signingProbe: { env: string; ok: boolean } | null = null;
/**
 * Whether signed thumbnails can actually be minted: the env vars are set *and*
 * the key parses. Remembered per env value, so a listing does not RSA-sign a
 * probe on every request.
 */
export function classThumbnailSigningAvailable(): boolean {
  const env = `${process.env.MUX_SIGNING_KEY_ID ?? ""}\n${process.env.MUX_SIGNING_KEY_PRIVATE ?? ""}`;
  if (signingProbe?.env !== env) signingProbe = { env, ok: muxSigningConfigured() && signClassThumbnail("probe", null) !== null };
  return signingProbe.ok;
}

type Content = { slug: string; isPlus: boolean };
const catalog: Content[] = [...ASANAS, ...PATHWAYS.map((row) => ({ ...row, slug: `class-${row.slug}` }))];
type Dependencies = { store?: IStorage; getPlayback?: (slug: string) => Promise<PoseMediaRow | null>; catalog?: Content[] };

/** Authorization is re-read for every issuance, independently of client flags or billing metadata. */
export async function issueMuxPlayback(slug: string, userId?: number, deps: Dependencies = {}) {
  const content = (deps.catalog || catalog).find((row) => row.slug === slug);
  if (!content) throw new PlaybackError(404, "Content not found");
  if (!userId) throw new PlaybackError(401, "Sign in to watch Plus video");
  const user = await (deps.store || storage).getUserById(userId);
  if (!user || user.plan !== "plus") throw new PlaybackError(403, "Plus membership required");
  const row = await (deps.getPlayback || getPosePlayback)(slug);
  if (!row || (row.provider || streamProvider()) !== "mux" || row.playbackPolicy !== "signed") {
    throw new PlaybackError(404, "Signed video not available");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(row.playbackId)) throw new PlaybackError(503, "Invalid stored playback ID");
  const signed = signMuxPlayback(row.playbackId);
  return { ...signed, playbackId: row.playbackId, hls: `https://stream.mux.com/${row.playbackId}.m3u8?token=${signed.token}` };
}

/** Public manifests stay public; signed manifests receive a token only after authorization. */
export async function buildAuthorizedMedia(slug: string, userId?: number) {
  const row = await getPosePlayback(slug);
  const content = catalog.find((item) => item.slug === slug);
  if (content?.isPlus && (row?.provider || streamProvider()) === "mux" && row?.playbackPolicy !== "signed") {
    throw new PlaybackError(503, "Plus video must be migrated to signed playback");
  }
  if (row?.playbackPolicy === "signed") {
    const signed = await issueMuxPlayback(slug, userId);
    return buildPoseMediaManifest(slug, signed.token);
  }
  return buildPoseMediaManifest(slug);
}

export function registerMuxPlaybackRoutes(app: Express, deps: Dependencies = {}) {
  app.get(["/api/poses/:slug/playback-token", "/api/classes/:slug/playback-token"], async (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const slug = req.path.startsWith("/api/classes/") ? `class-${req.params.slug}` : String(req.params.slug);
      res.json(await issueMuxPlayback(slug, req.userId, deps));
    } catch (error) {
      if (error instanceof PlaybackError) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });
}
