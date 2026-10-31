/**
 * Plus waitlist — email capture until payments launch.
 *
 * Plus cannot be bought while BILLING_ENABLED is off; this is the only thing
 * the Plans page and the /cancel pages offer instead. Addresses are kept only
 * to announce Plus (see Privacy → What we collect).
 */
import type { Express, Request, Response } from "express";
import { createRateLimiter } from "./security";
import { loadMap, saveMap } from "./jsonStore";

type Row = { email: string; createdAt: string };

const limit = createRateLimiter({ windowMs: 60_000, max: 20 });

function normalizeEmail(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

/** `store` names the .data/<store>.json file; tests pass their own. */
export function registerPlusWaitlistRoutes(app: Express, store = "plus-waitlist") {
  const registry = loadMap<Row>(store);

  app.post("/api/plus-waitlist", limit, (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    const already = registry.has(email);
    if (!already) {
      registry.set(email, { email, createdAt: new Date().toISOString() });
      saveMap(store, registry);
    }
    return res.json({ ok: true, already });
  });
}
