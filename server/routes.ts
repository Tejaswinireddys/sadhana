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
  verifyEmailSchema,
  resendVerificationSchema,
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
  newVerifyToken,
  hashVerifyToken,
  verifyTokenExpiry,
} from "./auth";
import {
  sendAccountDeletedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "./email";
import { z } from "zod";
import { reportError } from "./errorReporting";
import { buildPoseMediaManifest, isSafeSlug } from "./poseMediaManifest";
import { ensureNeuralTts, readCachedTts, ttsConfigured } from "./tts";
import { upsertPosePlayback } from "./poseStreamStore";
import { streamProvider, type StreamProvider } from "./streamConfig";
import { computeStats } from "@shared/practiceStats";

export { computeStats };

const IMPORT_MAX_ITEMS = 2_000;
const IMPORT_MAX_BODY_BYTES = 2 * 1024 * 1024;

function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

function exposeSensitiveAuthToken(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.EXPOSE_VERIFY_TOKEN === "1";
}

async function issueVerification(user: User): Promise<string> {
  const token = newVerifyToken();
  await storage.createEmailVerificationToken(
    user.id,
    hashVerifyToken(token),
    verifyTokenExpiry(),
  );
  await sendVerificationEmail({ to: user.email, token });
  console.info(`[auth] email verification for user ${user.id} — open /verify`);
  return token;
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
    const verifyToken = await issueVerification(user);
    // No session until the email is verified — guest practice stays on this device.
    const body: {
      needsVerification: true;
      email: string;
      message: string;
      verifyToken?: string;
    } = {
      needsVerification: true,
      email: user.email,
      message:
        "Account created. Check your email for a verification link — it expires in 48 hours.",
    };
    if (exposeSensitiveAuthToken() || process.env.EXPOSE_RESET_TOKEN === "1") {
      body.verifyToken = verifyToken;
    }
    res.status(201).json(body);
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
    if (!user.emailVerified) {
      return res.status(403).json({
        error: "Verify your email before signing in. Check your inbox or resend the link.",
        needsVerification: true,
        email: user.email,
      });
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

  app.post("/api/auth/verify-email", async (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid code" });
    }
    const tokenRow = await storage.getEmailVerificationToken(hashVerifyToken(parsed.data.token));
    if (!tokenRow || new Date(tokenRow.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Verification code is invalid or expired" });
    }
    const user = await storage.getUserById(tokenRow.userId);
    if (!user) {
      return res.status(400).json({ error: "Verification code is invalid or expired" });
    }
    if (parsed.data.email && parsed.data.email !== user.email) {
      return res.status(400).json({ error: "Verification code is invalid or expired" });
    }

    await storage.markEmailVerified(user.id);
    await storage.deleteEmailVerificationToken(tokenRow.tokenHash);
    await storage.deleteEmailVerificationTokensForUser(user.id);

    // Safe to adopt this device's guest practice now that the account is real.
    const claimed = await storage.transferOwnerData(req.deviceOwnerId, ownerIdForUser(user.id));
    const sessionTok = newSessionToken();
    await storage.createAuthSession(user.id, sessionTok, sessionExpiry());
    res.setHeader("Set-Cookie", authCookie(sessionTok, isSecure(req)));
    const verified = { ...user, emailVerified: true };
    void sendWelcomeEmail({ to: user.email, displayName: user.displayName });
    res.json({ user: publicUser(verified), claimed });
  });

  /** Always returns a generic message so we don't enumerate accounts. */
  app.post("/api/auth/resend-verification", async (req, res) => {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid email" });
    }
    const generic = {
      ok: true as const,
      message: "If that email still needs verification, we sent a new link. It expires in 48 hours.",
    };
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || user.emailVerified) return res.json(generic);

    const verifyToken = await issueVerification(user);
    if (exposeSensitiveAuthToken() || process.env.EXPOSE_RESET_TOKEN === "1") {
      return res.json({ ...generic, verifyToken });
    }
    return res.json(generic);
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
    const delivery = await sendPasswordResetEmail({ to: user.email, token });
    console.info(
      `[auth] password reset for user ${user.id} via ${delivery.mode}` +
        (delivery.sent ? "" : " (logged; set RESEND_API_KEY or EMAIL_WEBHOOK_URL for delivery)"),
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
    // Resetting via email also proves inbox access.
    await storage.markEmailVerified(user.id);
    await storage.deletePasswordResetToken(tokenRow.tokenHash);
    await storage.deleteEmailVerificationTokensForUser(user.id);
    await storage.deleteAuthSessionsForUser(user.id);
    void sendPasswordChangedEmail({ to: user.email });

    const token = newSessionToken();
    await storage.createAuthSession(user.id, token, sessionExpiry());
    res.setHeader("Set-Cookie", authCookie(token, isSecure(req)));
    res.json({ user: publicUser({ ...user, emailVerified: true }) });
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
    const email = user.email;
    await storage.deleteUser(user.id);
    void sendAccountDeletedEmail({ to: email });
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

  /** Browser exception beacon (rate-limited via global write limiter). */
  app.post("/api/client-errors", async (req, res) => {
    const message = String(req.body?.message || "client error").slice(0, 500);
    const stack = typeof req.body?.stack === "string" ? req.body.stack.slice(0, 4000) : undefined;
    const pathName = typeof req.body?.path === "string" ? req.body.path.slice(0, 200) : undefined;
    void reportError({
      message,
      stack,
      path: pathName,
      source: "client",
    });
    res.status(204).end();
  });

  /**
   * Pose media manifest — client uses this instead of guessing file paths.
   * Only reports assets that exist on disk (video/audio may each be null).
   */
  app.get("/api/poses/:slug/media", async (req, res) => {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!isSafeSlug(slug)) {
      return res.status(400).json({ error: "Invalid pose slug" });
    }
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(await buildPoseMediaManifest(slug));
  });

  /**
   * Upsert a streaming playback ID for a pose.
   * Protected by STREAM_ADMIN_KEY (or SADHANA_API_KEY) when set; open in local
   * memory-mode demos when neither key is configured.
   */
  app.put("/api/poses/:slug/stream", async (req, res) => {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!isSafeSlug(slug)) {
      return res.status(400).json({ error: "Invalid pose slug" });
    }
    const adminKey = process.env.STREAM_ADMIN_KEY || process.env.SADHANA_API_KEY;
    if (adminKey) {
      const presented =
        req.get("x-stream-admin-key") ||
        req.get("x-api-key") ||
        String(req.query.key || "");
      if (presented !== adminKey) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    const playbackId = String(req.body?.playbackId || req.body?.playback_id || "").trim();
    if (!playbackId || playbackId.length > 128) {
      return res.status(400).json({ error: "playbackId required" });
    }
    const rawProvider = String(req.body?.provider || streamProvider()).toLowerCase();
    const provider: StreamProvider =
      rawProvider === "mux" || rawProvider === "cloudflare" || rawProvider === "bunny"
        ? rawProvider
        : streamProvider();
    const row = await upsertPosePlayback(slug, playbackId, provider);
    res.json({
      slug: row.slug,
      playbackId: row.playbackId,
      provider: row.provider || provider,
      media: await buildPoseMediaManifest(slug),
    });
  });

  /**
   * Neural TTS: return cached MP3 or generate one when TTS_PROVIDER is set.
   * Body: { texts: string[], cues?: { t, text }[] }
   */
  app.post("/api/poses/:slug/tts", async (req, res) => {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!isSafeSlug(slug)) {
      return res.status(400).json({ error: "Invalid pose slug" });
    }
    // Prefer an on-disk human/neural file over generating a new track.
    const existing = (await buildPoseMediaManifest(slug)).audio;
    if (existing) {
      return res.json({ ...existing, cached: true });
    }
    const cached = readCachedTts(slug);
    if (cached) return res.json(cached);

    const texts = Array.isArray(req.body?.texts)
      ? (req.body.texts as unknown[]).map((t) => String(t || "").trim()).filter(Boolean)
      : [];
    const cues = Array.isArray(req.body?.cues) ? req.body.cues : null;
    if (texts.length === 0) {
      return res.status(400).json({ error: "texts required" });
    }
    if (!ttsConfigured()) {
      return res.status(501).json({
        error: "Neural TTS is not configured",
        hint: "Set TTS_PROVIDER=elevenlabs|azure|google and the matching API key",
      });
    }
    try {
      const result = await ensureNeuralTts(slug, texts, cues);
      return res.json(result);
    } catch (e) {
      const err = e as Error & { status?: number };
      return res.status(err.status || 502).json({ error: err.message || "TTS failed" });
    }
  });

  return httpServer;
}
