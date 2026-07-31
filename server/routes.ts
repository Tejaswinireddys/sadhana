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
  credentialsSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  deleteAccountSchema,
  type PublicUser,
  type User,
} from "@shared/schema";
import {
  authCookie,
  clearedAuthCookie,
  hashPassword,
  newSessionToken,
  ownerIdForUser,
  sessionExpiry,
  verifyPassword,
  AUTH_COOKIE,
  readCookie,
  newResetToken,
  hashResetToken,
  resetTokenExpiry,
} from "./auth";
import { z } from "zod";

const IMPORT_MAX_ITEMS = 2_000;
const IMPORT_MAX_BODY_BYTES = 2 * 1024 * 1024;

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

function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use("/api", ownerMiddleware);

  // ---- Accounts (optional — guests keep practising on the device owner) ----
  const isSecure = (req: { protocol: string; get(name: string): string | undefined }) =>
    req.protocol === "https" || req.get("x-forwarded-proto") === "https";

  app.get("/api/auth/me", async (req, res) => {
    const user = req.userId ? await storage.getUserById(req.userId) : undefined;
    if (!user) {
      // A guest has no account to merge into, so `deviceRows` told them nothing
      // and only advertised an internal concept. Don't emit it at all.
      return res.json({ user: null });
    }
    // Signed in: report what is still parked on this device so the UI can offer
    // to merge it rather than silently claiming it.
    res.json({ user: publicUser(user), deviceRows: await storage.countOwnerData(req.deviceOwnerId) });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid details" });
    }
    const { email, password, displayName } = parsed.data;
    if (await storage.getUserByEmail(email)) {
      return res.status(409).json({ error: "That email already has an account. Sign in instead." });
    }

    const user = await storage.createUser(email, await hashPassword(password), displayName);
    // A brand-new account can safely adopt this device's practice — nobody else
    // could own it, and losing a guest streak on signup would be cruel.
    const claimed = await storage.transferOwnerData(req.deviceOwnerId, ownerIdForUser(user.id));

    const token = newSessionToken();
    await storage.createAuthSession(user.id, token, sessionExpiry());
    res.setHeader("Set-Cookie", authCookie(token, isSecure(req)));
    res.status(201).json({ user: publicUser(user), claimed });
  });

  app.post("/api/auth/login", async (req, res) => {
    // Login must NOT reuse the signup schema. Its `password.min(8)` rejected a
    // wrong-but-short password with "Enter your email and password" — untrue
    // (both were supplied) and it leaked the length rule to anyone unauthed.
    // Sign-in validates shape only; every failure past that is one answer.
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(401).json({ error: "Email or password is incorrect" });
    }
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect" });
    }

    const token = newSessionToken();
    await storage.createAuthSession(user.id, token, sessionExpiry());
    res.setHeader("Set-Cookie", authCookie(token, isSecure(req)));
    res.json({
      user: publicUser(user),
      // Reported, never merged automatically — this device may belong to someone else.
      deviceRows: await storage.countOwnerData(req.deviceOwnerId),
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = readCookie(req.headers.cookie, AUTH_COOKIE);
    if (token) await storage.deleteAuthSession(token);
    res.setHeader("Set-Cookie", clearedAuthCookie(isSecure(req)));
    res.status(204).end();
  });

  app.post("/api/auth/claim-device", async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: "Sign in first" });
    const claimed = await storage.transferOwnerData(
      req.deviceOwnerId,
      ownerIdForUser(req.userId),
    );
    res.json({ claimed });
  });

  /** Always returns a generic message so we don't enumerate accounts. */
  app.post("/api/auth/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid email" });
    }
    const user = await storage.getUserByEmail(parsed.data.email);
    const generic = {
      ok: true as const,
      message:
        "If an account exists for that email, a reset code was created. It expires in 60 minutes.",
    };
    if (!user) return res.json(generic);

    const token = newResetToken();
    await storage.createPasswordResetToken(user.id, hashResetToken(token), resetTokenExpiry());
    // No SMTP in this stack — operators find the code in logs; local/dev also
    // gets it in the JSON so automated tests and self-hosters can finish the flow.
    console.info(
      `[auth] password reset for user ${user.id} — enter code on Account → Reset password`,
    );
    if (process.env.NODE_ENV !== "production" || process.env.EXPOSE_RESET_TOKEN === "1") {
      return res.json({ ...generic, resetToken: token });
    }
    return res.json(generic);
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid reset" });
    }
    const user = await storage.getUserByEmail(parsed.data.email);
    const tokenRow = await storage.getPasswordResetToken(hashResetToken(parsed.data.token));
    if (
      !user ||
      !tokenRow ||
      tokenRow.userId !== user.id ||
      new Date(tokenRow.expiresAt).getTime() < Date.now()
    ) {
      return res.status(400).json({ error: "Reset code is invalid or expired" });
    }

    await storage.updateUserPassword(user.id, await hashPassword(parsed.data.password));
    await storage.deletePasswordResetToken(tokenRow.tokenHash);
    await storage.deleteAuthSessionsForUser(user.id);

    const token = newSessionToken();
    await storage.createAuthSession(user.id, token, sessionExpiry());
    res.setHeader("Set-Cookie", authCookie(token, isSecure(req)));
    res.json({ user: publicUser(user) });
  });

  /** Full account deletion: practice data + user row + sessions. Requires password. */
  app.delete("/api/auth/account", async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: "Sign in first" });
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Password required" });
    }
    const user = await storage.getUserById(req.userId);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: "Password is incorrect" });
    }
    await storage.deleteUser(user.id);
    res.setHeader("Set-Cookie", clearedAuthCookie(isSecure(req)));
    res.status(204).end();
  });

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
  // Everything this owner has, in exactly the shape /api/account/import takes.
  // Guest practice used to be unrecoverable the moment a browser dropped
  // localStorage; this is the escape hatch.
  app.get("/api/account/export", async (req, res) => {
    const ownerId = req.ownerId;
    const [
      sessions,
      journal,
      customFlows,
      favorites,
      favoriteAsanas,
      enrollments,
      preferences,
      milestones,
      stickers,
      activeProfile,
    ] = await Promise.all([
      storage.getSessions(ownerId),
      storage.getJournal(ownerId),
      storage.getCustomFlows(ownerId),
      storage.getFavorites(ownerId),
      storage.getFavoriteAsanas(ownerId),
      storage.getEnrollments(ownerId),
      storage.getPreferences(ownerId),
      storage.getMilestones(ownerId),
      storage.getStickers(ownerId),
      storage.getActiveProfile(ownerId),
    ]);
    // Pose notes are per-slug; include all known from export by scanning favorites
    // plus a best-effort list isn't available — export notes for favorite asanas
    // and any slug referenced in sessions.
    const noteSlugs = new Set<string>();
    for (const f of favoriteAsanas) noteSlugs.add(f.slug);
    for (const s of sessions) {
      try {
        const asanas = JSON.parse(s.asanas || "[]") as string[];
        for (const slug of asanas) if (typeof slug === "string") noteSlugs.add(slug);
      } catch {
        /* ignore */
      }
    }
    const poseNotes = (
      await Promise.all([...noteSlugs].map((slug) => storage.getPoseNote(ownerId, slug)))
    ).filter(Boolean);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sadhana-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      signedIn: !!req.userId,
      sessions,
      journal,
      customFlows,
      favorites,
      favoriteAsanas,
      enrollments,
      preferences,
      milestones,
      stickers,
      poseNotes,
      activeProfileId: activeProfile?.profileId ?? null,
    });
  });

  app.delete("/api/account/data", async (req, res) => {
    await storage.clearOwnerData(req.ownerId);
    res.status(204).end();
  });
  app.post("/api/account/import", async (req, res) => {
    try {
      const rawLen = Buffer.isBuffer(req.rawBody)
        ? req.rawBody.length
        : JSON.stringify(req.body ?? {}).length;
      if (rawLen > IMPORT_MAX_BODY_BYTES) {
        return res.status(413).json({ error: "Import is too large (max 2 MB)" });
      }

      const strip = (raw: unknown) => {
        const o = { ...(raw as Record<string, unknown>) };
        delete o.id;
        delete o.ownerId;
        delete o.owner_id;
        return o;
      };
      const body = req.body as {
        version?: number;
        sessions?: unknown[];
        journal?: unknown[];
        customFlows?: unknown[];
        favorites?: unknown[];
        favoriteAsanas?: unknown[];
        enrollments?: unknown[];
        preferences?: { motionEnabled?: number; voiceEnabled?: number };
        milestones?: unknown[];
        stickers?: unknown[];
        poseNotes?: { slug?: string; body?: string }[];
        activeProfileId?: string | null;
      };

      if (body.version != null && body.version !== 1) {
        return res.status(400).json({ error: "Unsupported export version" });
      }

      const totalItems =
        (body.sessions?.length ?? 0) +
        (body.journal?.length ?? 0) +
        (body.customFlows?.length ?? 0) +
        (body.favorites?.length ?? 0) +
        (body.favoriteAsanas?.length ?? 0) +
        (body.enrollments?.length ?? 0) +
        (body.milestones?.length ?? 0) +
        (body.stickers?.length ?? 0) +
        (body.poseNotes?.length ?? 0) +
        (body.preferences ? 1 : 0);
      if (totalItems > IMPORT_MAX_ITEMS) {
        return res.status(400).json({ error: `Import exceeds ${IMPORT_MAX_ITEMS} items` });
      }

      const ownerId = req.ownerId;
      const imported = await storage.runInTransaction(async () => {
        let count = 0;

        for (const raw of body.sessions ?? []) {
          const data = insertSessionSchema.parse(strip(raw));
          await storage.createSession(ownerId, data);
          count++;
        }
        for (const raw of body.journal ?? []) {
          const data = insertJournalSchema.parse(strip(raw));
          await storage.createJournal(ownerId, data);
          count++;
        }
        for (const raw of body.customFlows ?? []) {
          const cleaned = strip(raw) as Record<string, unknown>;
          const data = insertCustomFlowSchema.parse({
            ...cleaned,
            createdAt: (cleaned.createdAt as string) ?? new Date().toISOString(),
          });
          await storage.createCustomFlow(ownerId, data);
          count++;
        }
        for (const raw of body.favorites ?? []) {
          const data = insertFavoriteSchema.parse(strip(raw));
          await storage.createFavorite(ownerId, data);
          count++;
        }
        for (const raw of body.favoriteAsanas ?? []) {
          const slug = z.object({ slug: z.string() }).parse(raw).slug;
          await storage.addFavoriteAsana(ownerId, slug);
          count++;
        }
        for (const raw of body.enrollments ?? []) {
          const data = insertEnrollmentSchema.parse(strip(raw));
          await storage.createEnrollment(ownerId, data);
          count++;
        }
        if (body.preferences) {
          await storage.updatePreferences(ownerId, {
            motionEnabled: body.preferences.motionEnabled,
            voiceEnabled: body.preferences.voiceEnabled,
          });
          count++;
        }
        for (const raw of body.milestones ?? []) {
          const { kind, reachedAt } = z
            .object({ kind: z.string(), reachedAt: z.string().optional() })
            .parse(raw);
          await storage.createMilestone(ownerId, {
            kind,
            reachedAt: reachedAt ?? new Date().toISOString(),
          });
          count++;
        }
        for (const raw of body.stickers ?? []) {
          const { poseSlug, earnedAt } = z
            .object({ poseSlug: z.string(), earnedAt: z.string().optional() })
            .parse(raw);
          await storage.createSticker(ownerId, {
            poseSlug,
            earnedAt: earnedAt ?? new Date().toISOString(),
          });
          count++;
        }
        for (const raw of body.poseNotes ?? []) {
          const { slug, body: noteBody } = z
            .object({ slug: z.string(), body: z.string() })
            .parse(raw);
          await storage.upsertPoseNote(ownerId, slug, noteBody);
          count++;
        }
        if (body.activeProfileId) {
          await storage.activateProfile(ownerId, body.activeProfileId);
          count++;
        }

        return count;
      });

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
