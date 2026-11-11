import type { Express, Request, Response } from "express";
import { accountPlan } from "../shared/entitlement";
import {
  CLASS_TOKEN_SECONDS,
  classListQuerySchema,
  classProgressBodySchema,
  classSlugSchema,
  classPlayback,
  continueWatching,
  filterClasses,
  nextClassSuggestion,
  nextProgress,
  paginate,
  presentClass,
  sortClasses,
  type ClassRecord,
  type ClassTokenSigner,
  usesSignedThumbnail,
  type ViewerPlan,
} from "../shared/classLibrary";
import { classThumbnailSigningAvailable, signClassPlayback, signClassThumbnail } from "./muxPlayback";
import { createRateLimiter } from "./security";
import { storage as defaultStore, type IStorage } from "./storage";

/**
 * Progress saves arrive every 15s plus on pause/exit, so a dozen a minute per
 * owner per class is generous; anything faster is a loop, not a viewer. The
 * limiter keys on owner + path, so each class has its own budget.
 */
const progressLimit = createRateLimiter({ windowMs: 60_000, max: 12, key: (req) => req.ownerId || req.ip || "unknown" });

/** Plan comes from the server-side user row only — never a client flag. */
async function viewerPlan(store: IStorage, req: Request): Promise<ViewerPlan> {
  if (!req.userId) return "free";
  return accountPlan(await store.getUserById(req.userId));
}

/**
 * Lists never carry a signer: tokens are minted only for the one class a
 * viewer opens, so signed classes show `playback: null` in every listing.
 */
async function publishedWithProgress(store: IStorage, ownerId: string, plan: ViewerPlan, signedThumbnails: boolean) {
  const [rows, progress] = await Promise.all([store.listClasses(), store.getClassProgress(ownerId)]);
  const byClass = new Map(progress.map((row) => [row.classId, row]));
  const published = sortClasses(rows.filter((row) => row.published) as ClassRecord[]);
  return published.map((row) => ({
    row,
    summary: presentClass(row, plan, byClass.get(row.id), undefined, {
      signedThumbnails,
      fillMissingMuxPoster: true,
    }),
  }));
}

/** Signs one poster frame: `(playbackId, timeSec) → t token | null`. */
export type ClassThumbnailSigner = (playbackId: string, timeSec: number | null) => string | null;

type CachedImage = { expiresAt: number; image: Promise<{ body: Buffer; contentType: string }> };

/** One relayed poster per class per hour; the same image serves every viewer. */
const THUMBNAIL_CACHE_MS = 60 * 60_000;
const THUMBNAIL_CACHE_MAX = 200;
const THUMBNAIL_FETCH_TIMEOUT_MS = 10_000;
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

const defaultSigner: ClassTokenSigner = (playbackId) => signClassPlayback(playbackId, CLASS_TOKEN_SECONDS);

/** Responses depend on who is asking (plan + progress) and must not be shared. */
function privateJson(res: Response, body: unknown, status = 200) {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json(body);
}

export function registerClassRoutes(app: Express, deps: {
  store?: IStorage;
  sign?: ClassTokenSigner;
  signThumbnail?: ClassThumbnailSigner;
  thumbnailSigningAvailable?: () => boolean;
  fetchImage?: typeof fetch;
} = {}) {
  const store = () => deps.store ?? defaultStore;
  const signer = deps.sign ?? defaultSigner;
  const signThumbnail = deps.signThumbnail ?? ((id, time) => signClassThumbnail(id, time));
  const thumbnailsSignable = deps.thumbnailSigningAvailable ?? classThumbnailSigningAvailable;
  const fetchImage = deps.fetchImage ?? fetch;
  const thumbnails = new Map<string, CachedImage>();
  const published = (req: Request, plan: ViewerPlan) => publishedWithProgress(store(), req.ownerId, plan, thumbnailsSignable());

  /**
   * Fetch (or reuse) one poster from Mux. A token is minted only on a cache
   * miss; null means signing is unavailable. In-flight fetches are shared, and
   * a failure is evicted so the next request retries instead of caching it.
   */
  function relayThumbnail(playbackId: string, timeSec: number | null) {
    const key = `${playbackId}:${timeSec ?? ""}`;
    const now = Date.now();
    const hit = thumbnails.get(key);
    if (hit && hit.expiresAt > now) return hit.image;
    const token = signThumbnail(playbackId, timeSec);
    if (!token) return null;
    if (thumbnails.size >= THUMBNAIL_CACHE_MAX) thumbnails.delete(thumbnails.keys().next().value!);
    const image = (async () => {
      const upstream = await fetchImage(`https://image.mux.com/${playbackId}/thumbnail.webp?token=${encodeURIComponent(token)}`, {
        signal: AbortSignal.timeout(THUMBNAIL_FETCH_TIMEOUT_MS),
      });
      const contentType = upstream.headers.get("content-type") ?? "";
      if (!upstream.ok || !contentType.startsWith("image/")) throw new Error(`Mux thumbnail HTTP ${upstream.status}`);
      const body = Buffer.from(await upstream.arrayBuffer());
      if (body.length > THUMBNAIL_MAX_BYTES) throw new Error("Mux thumbnail too large");
      return { body, contentType };
    })();
    thumbnails.set(key, { expiresAt: now + THUMBNAIL_CACHE_MS, image });
    image.catch(() => { if (thumbnails.get(key)?.image === image) thumbnails.delete(key); });
    return image;
  }

  /** Library listing: filters, pagination, and the viewer's lock/progress. */
  app.get("/api/classes", async (req, res, next) => {
    try {
      const parsed = classListQuerySchema.safeParse(req.query);
      if (!parsed.success) return privateJson(res, { error: parsed.error.issues[0]?.message ?? "Invalid filters" }, 400);
      const { page, pageSize, ...filters } = parsed.data;
      const plan = await viewerPlan(store(), req);
      const all = await published(req, plan);
      const matched = filterClasses(all.map(({ row }) => row), filters);
      const summaries = new Map(all.map(({ row, summary }) => [row.id, summary]));
      const result = paginate(matched.map((row) => summaries.get(row.id)!), page, pageSize);
      privateJson(res, { ...result, viewerPlan: plan });
    } catch (error) { next(error); }
  });

  /** Started, unfinished classes for "Continue watching" and Today. */
  app.get("/api/class-progress", async (req, res, next) => {
    try {
      const plan = await viewerPlan(store(), req);
      const all = await published(req, plan);
      privateJson(res, { items: continueWatching(all.map(({ summary }) => summary)) });
    } catch (error) { next(error); }
  });

  app.get("/api/classes/:slug", async (req, res, next) => {
    try {
      const slug = classSlugSchema.safeParse(req.params.slug);
      if (!slug.success) return privateJson(res, { error: "Class not found" }, 404);
      const plan = await viewerPlan(store(), req);
      const all = await published(req, plan);
      const found = all.find(({ row }) => row.slug === slug.data);
      if (!found) return privateJson(res, { error: "Class not found" }, 404);
      // The class being opened is the only place tokens are minted, and only
      // for a viewer `classPlayback` has already found entitled.
      const current = { ...found.summary, playback: classPlayback(found.row, plan, signer) };
      // "Next class" is a card, not a player: it never needs a playback id,
      // so none is sent — a response stays free of any id it does not need.
      const next = nextClassSuggestion(current, all.map(({ summary }) => summary));
      privateJson(res, {
        class: current,
        next: next ? { ...next, playback: null } : null,
        viewerPlan: plan,
      });
    } catch (error) { next(error); }
  });

  /**
   * Poster frame of a signed class, for every viewer — locked cards included.
   * The image is the one frame the class's own `thumbnailTimeSec` names, the
   * token is minted here and bound to it, and only the bytes are sent back:
   * the response carries neither the playback id nor the token. Any failure
   * is a JSON error, and the client falls back to its placeholder.
   */
  app.get("/api/classes/:slug/thumbnail.webp", async (req, res, next) => {
    try {
      const slug = classSlugSchema.safeParse(req.params.slug);
      if (!slug.success) return privateJson(res, { error: "Class not found" }, 404);
      const row = await store().getClassBySlug(slug.data);
      if (!row || !row.published || !usesSignedThumbnail(row as ClassRecord)) return privateJson(res, { error: "Thumbnail not found" }, 404);
      const playbackId = row.muxPlaybackId!.trim();
      const timeSec = typeof row.thumbnailTimeSec === "number" && row.thumbnailTimeSec >= 0 ? row.thumbnailTimeSec : null;
      const pending = relayThumbnail(playbackId, timeSec);
      if (!pending) return privateJson(res, { error: "Signed thumbnails are not configured" }, 503);
      let image: { body: Buffer; contentType: string };
      try {
        image = await pending;
      } catch {
        return privateJson(res, { error: "Thumbnail unavailable" }, 502);
      }
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", image.contentType);
      res.status(200).send(image.body);
    } catch (error) { next(error); }
  });

  /**
   * Save the viewer's position. Idempotent (see `nextProgress`): repeating a
   * body leaves the same row, and completion is sticky. A locked class has no
   * playback to make progress in, so it is refused rather than recorded.
   */
  app.post("/api/classes/:slug/progress", progressLimit, async (req, res, next) => {
    try {
      const slug = classSlugSchema.safeParse(req.params.slug);
      if (!slug.success) return privateJson(res, { error: "Class not found" }, 404);
      const body = classProgressBodySchema.safeParse(req.body);
      if (!body.success) return privateJson(res, { error: body.error.issues[0]?.message ?? "Invalid progress" }, 400);
      const row = await store().getClassBySlug(slug.data);
      if (!row || !row.published) return privateJson(res, { error: "Class not found" }, 404);
      const plan = await viewerPlan(store(), req);
      if (presentClass(row as ClassRecord, plan).locked) {
        return privateJson(res, { error: "Plus membership required", code: "PLUS_REQUIRED", upgradeUrl: "/plus" }, 403);
      }
      const existing = (await store().getClassProgress(req.ownerId)).find((p) => p.classId === row.id);
      const saved = await store().saveClassProgress(req.ownerId, row.id, nextProgress(existing, body.data, row.durationMinutes));
      privateJson(res, {
        progress: { secondsWatched: saved.secondsWatched, completed: saved.completed, updatedAt: saved.updatedAt },
      });
    } catch (error) { next(error); }
  });
}
