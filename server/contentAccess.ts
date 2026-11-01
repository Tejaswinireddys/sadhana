import type { Express, Request, Response, NextFunction } from "express";
import { ASANAS, PATHWAYS } from "../client/src/data/content";
import { accountPlan, canAccessContent } from "../shared/entitlement";
import { storage, type IStorage } from "./storage";

/** Only the authenticated server-side user record can grant Plus access. */
export function requireContentAccess(content: { isPlus: boolean }, store: IStorage = storage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.userId ? await store.getUserById(req.userId) : undefined;
      if (!canAccessContent(accountPlan(user), content)) {
        res.status(403).json({ error: "Plus membership required", code: "PLUS_REQUIRED", upgradeUrl: "/plus" });
        return;
      }
      next();
    } catch (error) { next(error); }
  };
}

export function registerContentAccess(app: Express) {
  // Runs after ownerMiddleware and before media/TTS and partner API handlers.
  app.use(["/api/poses/:slug", "/api/v1/poses/:slug"], (req, res, next) => {
    const content = ASANAS.find((pose) => pose.slug === req.params.slug)
      || PATHWAYS.find((pathway) => `class-${pathway.slug}` === req.params.slug);
    if (!content) return next();
    return requireContentAccess(content)(req, res, next);
  });
  app.get("/api/content/:kind/:slug", (req, res, next) => {
    const catalog = req.params.kind === "poses" ? ASANAS
      : ["classes", "programs"].includes(req.params.kind) ? PATHWAYS : [];
    const content = catalog.find((row) => row.slug === req.params.slug);
    if (!content) return res.status(404).json({ error: "Content not found" });
    return requireContentAccess(content)(req, res, (error) => {
      if (error) return next(error);
      res.json(content);
    });
  });
}
