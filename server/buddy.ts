/**
 * Privacy-first practice buddy — opt-in code pairing + nudge (no feed / leaderboard).
 */
import type { Express, Request, Response } from "express";
import { createRateLimiter } from "./security";
import { loadMap, saveMap } from "./jsonStore";
import { pushToOwner } from "./push";

type BuddyRow = {
  code: string;
  displayName: string;
  ownerId: string;
  pairedWithCode: string | null;
  updatedAt: string;
};

const STORE = "practice-buddies";
const registry = loadMap<BuddyRow>(STORE);
const buddyLimit = createRateLimiter({ windowMs: 60_000, max: 40 });

function persist() {
  saveMap(STORE, registry);
}

function normalizeCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
}

export function registerBuddyRoutes(app: Express) {
  app.post("/api/buddy/register", buddyLimit, (req: Request, res: Response) => {
    const code = normalizeCode(req.body?.code);
    const displayName = String(req.body?.displayName || "Friend").trim().slice(0, 40) || "Friend";
    if (!/^SB-[A-Z0-9]{6}$/.test(code)) {
      return res.status(400).json({ error: "Invalid buddy code format" });
    }
    const ownerId = req.ownerId || "";
    const prev = registry.get(code);
    // Don't let a stranger steal an existing code owned by someone else.
    if (prev && prev.ownerId && ownerId && prev.ownerId !== ownerId) {
      return res.status(409).json({ error: "That code is already registered" });
    }
    const row: BuddyRow = {
      code,
      displayName,
      ownerId: ownerId || prev?.ownerId || "",
      pairedWithCode: prev?.pairedWithCode ?? null,
      updatedAt: new Date().toISOString(),
    };
    registry.set(code, row);
    persist();
    res.json({ ok: true, buddy: row });
  });

  app.post("/api/buddy/pair", buddyLimit, (req: Request, res: Response) => {
    const myCode = normalizeCode(req.body?.myCode);
    const theirCode = normalizeCode(req.body?.theirCode);
    if (!myCode || !theirCode || myCode === theirCode) {
      return res.status(400).json({ error: "Enter someone else's buddy code" });
    }
    const mine = registry.get(myCode);
    const theirs = registry.get(theirCode);
    if (!theirs) {
      return res.status(404).json({
        error: "Code not found",
        hint: "Ask your buddy to open Challenges once so their code registers.",
      });
    }
    const displayName = String(req.body?.displayName || mine?.displayName || "Friend")
      .trim()
      .slice(0, 40);
    const ownerId = req.ownerId || mine?.ownerId || "";
    const nextMine: BuddyRow = {
      code: myCode,
      displayName,
      ownerId,
      pairedWithCode: theirCode,
      updatedAt: new Date().toISOString(),
    };
    registry.set(myCode, nextMine);
    // Soft reciprocal link if they aren't paired yet.
    if (!theirs.pairedWithCode) {
      registry.set(theirCode, {
        ...theirs,
        pairedWithCode: myCode,
        updatedAt: new Date().toISOString(),
      });
    }
    persist();
    res.json({
      ok: true,
      pairedWithCode: theirCode,
      pairedName: theirs.displayName,
    });
  });

  app.post("/api/buddy/unpair", buddyLimit, (req: Request, res: Response) => {
    const myCode = normalizeCode(req.body?.myCode);
    const mine = registry.get(myCode);
    if (!mine) return res.json({ ok: true });
    const other = mine.pairedWithCode ? registry.get(mine.pairedWithCode) : null;
    registry.set(myCode, { ...mine, pairedWithCode: null, updatedAt: new Date().toISOString() });
    if (other?.pairedWithCode === myCode) {
      registry.set(other.code, {
        ...other,
        pairedWithCode: null,
        updatedAt: new Date().toISOString(),
      });
    }
    persist();
    res.json({ ok: true });
  });

  app.post("/api/buddy/nudge", buddyLimit, async (req: Request, res: Response) => {
    const myCode = normalizeCode(req.body?.myCode);
    const mine = registry.get(myCode);
    if (!mine?.pairedWithCode) {
      return res.status(400).json({ error: "Pair with a buddy before sending a nudge" });
    }
    const theirs = registry.get(mine.pairedWithCode);
    if (!theirs) return res.status(404).json({ error: "Buddy not found" });

    const message =
      String(req.body?.message || "").trim().slice(0, 120) ||
      "Showing up is enough — glad you're here.";

    let pushed = 0;
    if (theirs.ownerId) {
      pushed = await pushToOwner(
        theirs.ownerId,
        `${mine.displayName} sent encouragement`,
        message,
      );
    }
    res.json({
      ok: true,
      deliveredPush: pushed,
      pairedName: theirs.displayName,
      message,
    });
  });

  app.get("/api/buddy/:code", buddyLimit, (req: Request, res: Response) => {
    const code = normalizeCode(String(req.params.code || ""));
    const row = registry.get(code);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({
      code: row.code,
      displayName: row.displayName,
      pairedWithCode: row.pairedWithCode,
    });
  });
}
