/**
 * Platform API v1 — partners reuse catalog + constrained session plans.
 * No journal/mood/injury payloads by default.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { createRateLimiter } from "./security";
import { COACH_CATALOG } from "./coach-catalog";

/** Slim pathway index for API partners (no full day plans). */
const PATHWAY_INDEX = [
  { slug: "foundations-beginner", name: "Foundations for Beginners", kind: "daily", minutes: 12 },
  { slug: "stress-release-week", name: "Stress Release Week", kind: "daily", minutes: 12 },
  { slug: "chair-limited-mobility", name: "Chair & Limited Mobility", kind: "daily", minutes: 11 },
  { slug: "better-sleep-flow", name: "Better Sleep Flow", kind: "flow", minutes: 12 },
  { slug: "morning-wake-up", name: "Morning Wake-Up", kind: "flow", minutes: 10 },
  { slug: "desk-break", name: "Desk Break", kind: "flow", minutes: 7 },
] as const;

const TEMPLATE_PLANS: Record<string, { slug: string; holdSeconds: number }[]> = {
  calm: [
    { slug: "sukhasana", holdSeconds: 60 },
    { slug: "balasana", holdSeconds: 60 },
    { slug: "viparita-karani", holdSeconds: 90 },
    { slug: "savasana", holdSeconds: 120 },
  ],
  energy: [
    { slug: "tadasana", holdSeconds: 30 },
    { slug: "virabhadrasana-ii", holdSeconds: 40 },
    { slug: "adho-mukha-svanasana", holdSeconds: 45 },
    { slug: "balasana", holdSeconds: 45 },
  ],
  sleep: [
    { slug: "sukhasana", holdSeconds: 45 },
    { slug: "balasana", holdSeconds: 75 },
    { slug: "viparita-karani", holdSeconds: 120 },
    { slug: "savasana", holdSeconds: 180 },
  ],
};

function apiKeyOk(req: Request): boolean {
  const key = req.get("x-api-key") || "";
  const expected = process.env.SADHANA_API_KEY;
  if (!expected) return key === "sadhana-demo-key" || key === "";
  return key === expected;
}

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!apiKeyOk(req)) {
    return res.status(401).json({ error: "Invalid or missing X-Api-Key" });
  }
  next();
}

const v1Limit = createRateLimiter({ windowMs: 60_000, max: 120 });

export function registerPlatformApi(app: Express) {
  app.use("/api/v1", v1Limit, requireApiKey);

  app.get("/api/v1", (_req, res) => {
    res.json({
      name: "Sadhana Platform API",
      version: "1",
      docs: "Read-only movement catalog and constrained session plans. No personal health data.",
      endpoints: [
        "GET /api/v1/poses",
        "GET /api/v1/poses/:slug",
        "GET /api/v1/pathways",
        "POST /api/v1/session-plan",
      ],
    });
  });

  app.get("/api/v1/poses", (req, res) => {
    const q = String(req.query.q ?? "").toLowerCase();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    let rows = COACH_CATALOG.map((a) => ({
      slug: a.slug,
      english: a.english,
      sanskrit: a.sanskrit,
      level: a.level,
      category: a.category,
      benefits: a.benefits.slice(0, 3),
    }));
    if (q) {
      rows = rows.filter(
        (a) =>
          a.english.toLowerCase().includes(q) ||
          a.sanskrit.toLowerCase().includes(q) ||
          a.slug.includes(q),
      );
    }
    res.json({ version: 1, count: rows.length, poses: rows.slice(0, limit) });
  });

  app.get("/api/v1/poses/:slug", (req, res) => {
    const a = COACH_CATALOG.find((p) => p.slug === req.params.slug);
    if (!a) return res.status(404).json({ error: "Pose not found" });
    res.json({ version: 1, pose: a });
  });

  app.get("/api/v1/pathways", (_req, res) => {
    res.json({ version: 1, pathways: PATHWAY_INDEX });
  });

  app.post("/api/v1/session-plan", (req, res) => {
    const minutes = Math.min(45, Math.max(5, Number(req.body?.minutes) || 15));
    const need = String(req.body?.need || "calm").toLowerCase();
    if (req.body?.journal || req.body?.email || req.body?.injuries) {
      return res.status(400).json({
        error: "Personal health fields are not accepted on this endpoint",
      });
    }
    const template = TEMPLATE_PLANS[need] ?? TEMPLATE_PLANS.calm;
    res.json({
      version: 1,
      minutes,
      need,
      explanation:
        "Constrained template plan — partners must apply their own clinical review. Safety metadata is included per pose.",
      poses: template.map((p) => {
        const meta = COACH_CATALOG.find((c) => c.slug === p.slug);
        return {
          slug: p.slug,
          holdSeconds: p.holdSeconds,
          english: meta?.english,
          contraindications: meta?.contraindications ?? [],
        };
      }),
    });
  });
}
