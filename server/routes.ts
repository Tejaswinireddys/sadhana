import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { ownerMiddleware } from "./owner";
import {
  insertSessionSchema,
  insertEnrollmentSchema,
  insertFavoriteSchema,
  insertJournalSchema,
  insertPreferencesSchema,
  insertMobilityCheckInSchema,
  insertCustomFlowSchema,
} from "@shared/schema";
import { z } from "zod";

// Normalize an ISO string / date string to YYYY-MM-DD
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// Pure YYYY-MM-DD arithmetic (UTC-based) so results never depend on the
// server's local timezone.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

export function computeStats(
  sessions: { date: string; durationMinutes: number; kind?: string }[],
  todayOverride?: string,
) {
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

  // Build last 84 days array (oldest -> newest), anchored on the client's
  // local calendar day when provided (server UTC day otherwise).
  const todayKey =
    todayOverride && /^\d{4}-\d{2}-\d{2}$/.test(todayOverride)
      ? todayOverride
      : new Date().toISOString().slice(0, 10);
  const heatmap: { date: string; minutes: number }[] = [];
  const practicedDays = new Set(minutesByDay.keys());
  for (let i = 83; i >= 0; i--) {
    const k = addDays(todayKey, -i);
    heatmap.push({ date: k, minutes: minutesByDay.get(k) || 0 });
  }

  // Current streak: consecutive days ending today or yesterday
  function isoDaysAgo(n: number): string {
    return addDays(todayKey, -n);
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
    const d = new Date(k + "T00:00:00Z");
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
  app.use("/api", ownerMiddleware);

  // ---- Sessions ----
  app.get("/api/sessions", async (req, res) => {
    res.json(await storage.getSessions(req.ownerId));
  });
  app.post("/api/sessions", async (req, res) => {
    try {
      const data = insertSessionSchema.parse(req.body);
      res.status(201).json(await storage.createSession(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/sessions/:id", async (req, res) => {
    const ok = await storage.deleteSession(req.ownerId, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });
  // Optional trailing segment: the client's local calendar day (YYYY-MM-DD),
  // so streaks/heatmaps line up with the user's timezone, not the server's.
  app.get("/api/sessions/stats{/:today}", async (req, res) => {
    const list = await storage.getSessions(req.ownerId);
    res.json(computeStats(list, req.params.today));
  });

  // ---- Account export / import / wipe (per device owner) ----
  app.delete("/api/account/data", async (req, res) => {
    await storage.clearOwnerData(req.ownerId);
    res.status(204).end();
  });
  app.post("/api/account/import", async (req, res) => {
    try {
      const strip = (raw: unknown) => {
        const o = { ...(raw as Record<string, unknown>) };
        delete o.id;
        delete o.ownerId;
        delete o.owner_id;
        return o;
      };
      const body = req.body as {
        sessions?: unknown[];
        journal?: unknown[];
        customFlows?: unknown[];
        favorites?: unknown[];
        favoriteAsanas?: unknown[];
        enrollments?: unknown[];
        preferences?: { motionEnabled?: number; voiceEnabled?: number };
        milestones?: unknown[];
        stickers?: unknown[];
      };
      const ownerId = req.ownerId;
      let imported = 0;

      for (const raw of body.sessions ?? []) {
        const data = insertSessionSchema.parse(strip(raw));
        await storage.createSession(ownerId, data);
        imported++;
      }
      for (const raw of body.journal ?? []) {
        const data = insertJournalSchema.parse(strip(raw));
        await storage.createJournal(ownerId, data);
        imported++;
      }
      for (const raw of body.customFlows ?? []) {
        const cleaned = strip(raw) as Record<string, unknown>;
        const data = insertCustomFlowSchema.parse({
          ...cleaned,
          createdAt: (cleaned.createdAt as string) ?? new Date().toISOString(),
        });
        await storage.createCustomFlow(ownerId, data);
        imported++;
      }
      for (const raw of body.favorites ?? []) {
        const data = insertFavoriteSchema.parse(strip(raw));
        await storage.createFavorite(ownerId, data);
        imported++;
      }
      for (const raw of body.favoriteAsanas ?? []) {
        const slug = z.object({ slug: z.string() }).parse(raw).slug;
        await storage.addFavoriteAsana(ownerId, slug);
        imported++;
      }
      for (const raw of body.enrollments ?? []) {
        const data = insertEnrollmentSchema.parse(strip(raw));
        await storage.createEnrollment(ownerId, data);
        imported++;
      }
      if (body.preferences) {
        await storage.updatePreferences(ownerId, {
          motionEnabled: body.preferences.motionEnabled,
          voiceEnabled: body.preferences.voiceEnabled,
        });
        imported++;
      }
      for (const raw of body.milestones ?? []) {
        const { kind, reachedAt } = z
          .object({ kind: z.string(), reachedAt: z.string().optional() })
          .parse(raw);
        await storage.createMilestone(ownerId, {
          kind,
          reachedAt: reachedAt ?? new Date().toISOString(),
        });
        imported++;
      }
      for (const raw of body.stickers ?? []) {
        const { poseSlug, earnedAt } = z
          .object({ poseSlug: z.string(), earnedAt: z.string().optional() })
          .parse(raw);
        await storage.createSticker(ownerId, {
          poseSlug,
          earnedAt: earnedAt ?? new Date().toISOString(),
        });
        imported++;
      }

      res.status(201).json({ imported });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Enrollments ----
  app.get("/api/enrollments", async (req, res) => {
    res.json(await storage.getEnrollments(req.ownerId));
  });
  app.post("/api/enrollments", async (req, res) => {
    try {
      const data = insertEnrollmentSchema.parse(req.body);
      res.status(201).json(await storage.createEnrollment(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/enrollments/:id", async (req, res) => {
    await storage.deleteEnrollment(req.ownerId, Number(req.params.id));
    res.status(204).end();
  });

  // ---- Favorites ----
  app.get("/api/favorites", async (req, res) => {
    res.json(await storage.getFavorites(req.ownerId));
  });
  app.post("/api/favorites", async (req, res) => {
    try {
      const data = insertFavoriteSchema.parse(req.body);
      res.status(201).json(await storage.createFavorite(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/favorites/:id", async (req, res) => {
    await storage.deleteFavorite(req.ownerId, Number(req.params.id));
    res.status(204).end();
  });

  // ---- Journal ----
  app.get("/api/journal", async (req, res) => {
    res.json(await storage.getJournal(req.ownerId));
  });
  app.post("/api/journal", async (req, res) => {
    try {
      const data = insertJournalSchema.parse(req.body);
      res.status(201).json(await storage.createJournal(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.patch("/api/journal/:id", async (req, res) => {
    try {
      const data = insertJournalSchema.partial().parse(req.body);
      const updated = await storage.updateJournal(req.ownerId, Number(req.params.id), data);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/journal/:id", async (req, res) => {
    await storage.deleteJournal(req.ownerId, Number(req.params.id));
    res.status(204).end();
  });

  // ---- Preferences ----
  app.get("/api/preferences", async (req, res) => {
    res.json(await storage.getPreferences(req.ownerId));
  });
  app.patch("/api/preferences", async (req, res) => {
    try {
      const data = insertPreferencesSchema.partial().parse(req.body);
      res.json(await storage.updatePreferences(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Personalization profiles ----
  app.get("/api/profile/active", async (req, res) => {
    const profile = await storage.getActiveProfile(req.ownerId);
    res.json(profile ?? null);
  });
  app.post("/api/profile/activate", async (req, res) => {
    try {
      const { profileId } = z.object({ profileId: z.string().min(1) }).parse(req.body);
      res.status(201).json(await storage.activateProfile(req.ownerId, profileId));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.post("/api/profile/deactivate", async (req, res) => {
    await storage.deactivateProfile(req.ownerId);
    res.status(204).end();
  });

  // ---- Favorite asanas (v3.4) ----
  app.get("/api/favorites/asanas", async (req, res) => {
    res.json(await storage.getFavoriteAsanas(req.ownerId));
  });
  app.post("/api/favorites/asanas", async (req, res) => {
    try {
      const { slug } = z.object({ slug: z.string().min(1) }).parse(req.body);
      res.status(201).json(await storage.addFavoriteAsana(req.ownerId, slug));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/favorites/asanas/:slug", async (req, res) => {
    await storage.removeFavoriteAsana(req.ownerId, req.params.slug);
    res.status(204).end();
  });

  // ---- Milestones (v3.4) ----
  app.get("/api/milestones", async (req, res) => {
    res.json(await storage.getMilestones(req.ownerId));
  });
  app.post("/api/milestones", async (req, res) => {
    try {
      const { kind } = z.object({ kind: z.string().min(1) }).parse(req.body);
      res
        .status(201)
        .json(
          await storage.createMilestone(req.ownerId, {
            kind,
            reachedAt: new Date().toISOString(),
          }),
        );
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Pose notes (v3.4) ----
  app.get("/api/notes/:slug", async (req, res) => {
    const note = await storage.getPoseNote(req.ownerId, req.params.slug);
    res.json(note ?? null);
  });
  app.put("/api/notes/:slug", async (req, res) => {
    try {
      const { body } = z.object({ body: z.string() }).parse(req.body);
      res.json(await storage.upsertPoseNote(req.ownerId, req.params.slug, body));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Mobility check-ins (v3.5) ----
  app.get("/api/mobility", async (req, res) => {
    const pathwaySlug = String(req.query.pathwaySlug ?? "");
    if (!pathwaySlug) return res.status(400).json({ error: "pathwaySlug is required" });
    res.json(await storage.getMobilityCheckIns(req.ownerId, pathwaySlug));
  });
  app.post("/api/mobility", async (req, res) => {
    try {
      const data = insertMobilityCheckInSchema.parse({
        ...req.body,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(await storage.createMobilityCheckIn(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/mobility/:id", async (req, res) => {
    await storage.deleteMobilityCheckIn(req.ownerId, Number(req.params.id));
    res.status(204).end();
  });

  // ---- Kids stickers ----
  app.get("/api/kids/stickers", async (req, res) => {
    res.json(await storage.getStickers(req.ownerId));
  });
  app.post("/api/kids/stickers", async (req, res) => {
    try {
      const { poseSlug } = z.object({ poseSlug: z.string().min(1) }).parse(req.body);
      res
        .status(201)
        .json(
          await storage.createSticker(req.ownerId, {
            poseSlug,
            earnedAt: new Date().toISOString(),
          }),
        );
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ---- Custom flows (Sequence Builder, v5.1) ----
  app.get("/api/custom-flows", async (req, res) => {
    res.json(await storage.getCustomFlows(req.ownerId));
  });
  app.get("/api/custom-flows/:id", async (req, res) => {
    const flow = await storage.getCustomFlow(req.ownerId, Number(req.params.id));
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  });
  app.post("/api/custom-flows", async (req, res) => {
    try {
      const data = insertCustomFlowSchema.parse({
        ...req.body,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(await storage.createCustomFlow(req.ownerId, data));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.put("/api/custom-flows/:id", async (req, res) => {
    try {
      const data = insertCustomFlowSchema.partial().parse(req.body);
      const updated = await storage.updateCustomFlow(req.ownerId, Number(req.params.id), data);
      if (!updated) return res.status(404).json({ error: "Flow not found" });
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.delete("/api/custom-flows/:id", async (req, res) => {
    await storage.deleteCustomFlow(req.ownerId, Number(req.params.id));
    res.status(204).end();
  });

  return httpServer;
}
