/**
 * Teachers waitlist — email capture until live classes exist.
 */
import type { Express, Request, Response } from "express";
import { createRateLimiter } from "./security";
import { loadMap, saveMap } from "./jsonStore";

type Row = { email: string; createdAt: string };

const STORE = "teachers-waitlist";
const registry = loadMap<Row>(STORE);
const limit = createRateLimiter({ windowMs: 60_000, max: 20 });

function persist() {
  saveMap(STORE, registry);
}

function normalizeEmail(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

export function registerTeachersWaitlistRoutes(app: Express) {
  app.post("/api/teachers-waitlist", limit, (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    const already = registry.has(email);
    if (!already) {
      registry.set(email, { email, createdAt: new Date().toISOString() });
      persist();
    }
    return res.json({ ok: true, already });
  });
}
