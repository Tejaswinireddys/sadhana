import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  insertSessionSchema,
  insertEnrollmentSchema,
  insertFavoriteSchema,
  insertJournalSchema,
  insertPreferencesSchema,
} from "@shared/schema";
import { z } from "zod";

// Normalize an ISO string / date string to YYYY-MM-DD
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function computeStats(sessions: { date: string; durationMinutes: number; kind?: string }[]) {
  // Aggregate minutes per day
  const minutesByDay = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.date);
    minutesByDay.set(k, (minutesByDay.get(k) || 0) + s.durationMinutes);
  }

  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((a, s) => a + s.durationMinutes, 0);
  const asanaSessions = sessions.filter((s) => (s.kind ?? "asana") === "asana").length;
  const breathingSessions = sessions.filter((s) => s.kind === "breathing").length;

  // Build last 84 days array (oldest -> newest)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const heatmap: { date: string; minutes: number }[] = [];
  const practicedDays = new Set(minutesByDay.keys());
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    heatmap.push({ date: k, minutes: minutesByDay.get(k) || 0 });
  }

  // Current streak: consecutive days ending today or yesterday
  function isoDaysAgo(n: number): string {
    const d = new Date(today);
    d.setDate(today.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  let currentStreak = 0;
  // Allow streak to count even if today not yet practiced (start from yesterday)
  let startOffset = practicedDays.has(isoDaysAgo(0)) ? 0 : practicedDays.has(isoDaysAgo(1)) ? 1 : -1;
  if (startOffset >= 0) {
    let n = startOffset;
    while (practicedDays.has(isoDaysAgo(n))) {
      currentStreak++;
      n++;
    }
  }

  // Longest streak across all practiced days
  const sortedDays = Array.from(practicedDays).sort();
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sortedDays) {
    const d = new Date(k + "T00:00:00");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = d;
  }

  return {
    currentStreak,
    longestStreak,
    totalSessions,
    totalMinutes,
    asanaSessions,
    breathingSessions,
    daysPracticed: practicedDays.size,
    heatmap,
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ---- Sessions ----
  app.get("/api/sessions", async (_req, res) => {
    res.json(await storage.getSessions());
  });
  app.post("/api/sessions", async (req, res) => {
    try {
      const data = insertSessionSchema.parse(req.body);
      res.status(201).json(await storage.createSession(data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.get("/api/sessions/stats", async (_req, res) => {
    const sessions = await storage.getSessions();
    res.json(computeStats(sessions));
  });

  // ---- Enrollments ----
  app.get("/api/enrollments", async (_req, res) => {
    res.json(await storage.getEnrollments());
  });
  app.post("/api/enrollments", async (req, res) => {
    try {
      const data = insertEnrollmentSchema.parse(req.body);
      res.status(201).json(await storage.createEnrollment(data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/enrollments/:id", async (req, res) => {
    await storage.deleteEnrollment(Number(req.params.id));
    res.status(204).end();
  });

  // ---- Favorites ----
  app.get("/api/favorites", async (_req, res) => {
    res.json(await storage.getFavorites());
  });
  app.post("/api/favorites", async (req, res) => {
    try {
      const data = insertFavoriteSchema.parse(req.body);
      res.status(201).json(await storage.createFavorite(data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/favorites/:id", async (req, res) => {
    await storage.deleteFavorite(Number(req.params.id));
    res.status(204).end();
  });

  // ---- Journal ----
  app.get("/api/journal", async (_req, res) => {
    res.json(await storage.getJournal());
  });
  app.post("/api/journal", async (req, res) => {
    try {
      const data = insertJournalSchema.parse(req.body);
      res.status(201).json(await storage.createJournal(data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.patch("/api/journal/:id", async (req, res) => {
    try {
      const data = insertJournalSchema.partial().parse(req.body);
      const updated = await storage.updateJournal(Number(req.params.id), data);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/journal/:id", async (req, res) => {
    await storage.deleteJournal(Number(req.params.id));
    res.status(204).end();
  });

  // ---- Preferences ----
  app.get("/api/preferences", async (_req, res) => {
    res.json(await storage.getPreferences());
  });
  app.patch("/api/preferences", async (req, res) => {
    try {
      const data = insertPreferencesSchema.partial().parse(req.body);
      res.json(await storage.updatePreferences(data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Personalization profiles ----
  app.get("/api/profile/active", async (_req, res) => {
    const profile = await storage.getActiveProfile();
    res.json(profile ?? null);
  });
  app.post("/api/profile/activate", async (req, res) => {
    try {
      const { profileId } = z.object({ profileId: z.string().min(1) }).parse(req.body);
      res.status(201).json(await storage.activateProfile(profileId));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.post("/api/profile/deactivate", async (_req, res) => {
    await storage.deactivateProfile();
    res.status(204).end();
  });

  // ---- Favorite asanas (v3.4) ----
  app.get("/api/favorites/asanas", async (_req, res) => {
    res.json(await storage.getFavoriteAsanas());
  });
  app.post("/api/favorites/asanas", async (req, res) => {
    try {
      const { slug } = z.object({ slug: z.string().min(1) }).parse(req.body);
      res.status(201).json(await storage.addFavoriteAsana(slug));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/favorites/asanas/:slug", async (req, res) => {
    await storage.removeFavoriteAsana(req.params.slug);
    res.status(204).end();
  });

  // ---- Milestones (v3.4) ----
  app.get("/api/milestones", async (_req, res) => {
    res.json(await storage.getMilestones());
  });
  app.post("/api/milestones", async (req, res) => {
    try {
      const { kind } = z.object({ kind: z.string().min(1) }).parse(req.body);
      res
        .status(201)
        .json(await storage.createMilestone({ kind, reachedAt: new Date().toISOString() }));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Pose notes (v3.4) ----
  app.get("/api/notes/:slug", async (req, res) => {
    const note = await storage.getPoseNote(req.params.slug);
    res.json(note ?? null);
  });
  app.put("/api/notes/:slug", async (req, res) => {
    try {
      const { body } = z.object({ body: z.string() }).parse(req.body);
      res.json(await storage.upsertPoseNote(req.params.slug, body));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Kids stickers ----
  app.get("/api/kids/stickers", async (_req, res) => {
    res.json(await storage.getStickers());
  });
  app.post("/api/kids/stickers", async (req, res) => {
    try {
      const { poseSlug } = z.object({ poseSlug: z.string().min(1) }).parse(req.body);
      res
        .status(201)
        .json(await storage.createSticker({ poseSlug, earnedAt: new Date().toISOString() }));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  return httpServer;
}
