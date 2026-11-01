import type { Express, Request, Response } from "express";
import { accountPlan } from "../shared/entitlement";
import {
  classListQuerySchema,
  classProgressBodySchema,
  classSlugSchema,
  continueWatching,
  filterClasses,
  nextClassSuggestion,
  nextProgress,
  paginate,
  presentClass,
  sortClasses,
  type ClassRecord,
  type ViewerPlan,
} from "../shared/classLibrary";
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

async function publishedWithProgress(store: IStorage, ownerId: string, plan: ViewerPlan) {
  const [rows, progress] = await Promise.all([store.listClasses(), store.getClassProgress(ownerId)]);
  const byClass = new Map(progress.map((row) => [row.classId, row]));
  const published = sortClasses(rows.filter((row) => row.published) as ClassRecord[]);
  return published.map((row) => ({ row, summary: presentClass(row, plan, byClass.get(row.id)) }));
}

/** Responses depend on who is asking (plan + progress) and must not be shared. */
function privateJson(res: Response, body: unknown, status = 200) {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json(body);
}

export function registerClassRoutes(app: Express, deps: { store?: IStorage } = {}) {
  const store = () => deps.store ?? defaultStore;

  /** Library listing: filters, pagination, and the viewer's lock/progress. */
  app.get("/api/classes", async (req, res, next) => {
    try {
      const parsed = classListQuerySchema.safeParse(req.query);
      if (!parsed.success) return privateJson(res, { error: parsed.error.issues[0]?.message ?? "Invalid filters" }, 400);
      const { page, pageSize, ...filters } = parsed.data;
      const plan = await viewerPlan(store(), req);
      const all = await publishedWithProgress(store(), req.ownerId, plan);
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
      const all = await publishedWithProgress(store(), req.ownerId, plan);
      privateJson(res, { items: continueWatching(all.map(({ summary }) => summary)) });
    } catch (error) { next(error); }
  });

  app.get("/api/classes/:slug", async (req, res, next) => {
    try {
      const slug = classSlugSchema.safeParse(req.params.slug);
      if (!slug.success) return privateJson(res, { error: "Class not found" }, 404);
      const plan = await viewerPlan(store(), req);
      const all = await publishedWithProgress(store(), req.ownerId, plan);
      const current = all.find(({ row }) => row.slug === slug.data)?.summary;
      if (!current) return privateJson(res, { error: "Class not found" }, 404);
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
