/**
 * Web Push (VAPID) — reminders that work when the tab is closed.
 */
import type { Express, Request, Response } from "express";
import webpush from "web-push";
import { createRateLimiter } from "./security";

type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  ownerId: string;
  reminderHour: number;
  createdAt: string;
};

const subs = new Map<string, PushSub>();

let vapidPublic = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@sadhana.local";

if (!vapidPublic || !vapidPrivate) {
  const generated = webpush.generateVAPIDKeys();
  vapidPublic = generated.publicKey;
  vapidPrivate = generated.privateKey;
  console.log(
    "[push] Generated ephemeral VAPID keys (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY for persistence)",
  );
}

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

const pushLimit = createRateLimiter({ windowMs: 60_000, max: 30 });

export function registerPushRoutes(app: Express) {
  app.get("/api/push/vapid-public-key", (_req, res) => {
    res.json({ enabled: true, publicKey: vapidPublic });
  });

  app.post("/api/push/subscribe", pushLimit, (req: Request, res: Response) => {
    const endpoint = String(req.body?.endpoint || "");
    const p256dh = String(req.body?.keys?.p256dh || "");
    const auth = String(req.body?.keys?.auth || "");
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "Invalid push subscription" });
    }
    const reminderHour = Math.min(23, Math.max(0, Number(req.body?.reminderHour) || 18));
    subs.set(endpoint, {
      endpoint,
      keys: { p256dh, auth },
      ownerId: req.ownerId || "",
      reminderHour,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ ok: true });
  });

  app.post("/api/push/unsubscribe", pushLimit, (req: Request, res: Response) => {
    const endpoint = String(req.body?.endpoint || "");
    if (endpoint) subs.delete(endpoint);
    res.json({ ok: true });
  });

  /** Send a one-off reminder (Settings "Send test" / cron). */
  app.post("/api/push/test", pushLimit, async (req: Request, res: Response) => {
    const endpoint = String(req.body?.endpoint || "");
    const targets = endpoint
      ? [...subs.values()].filter((s) => s.endpoint === endpoint)
      : [...subs.values()].filter((s) => !req.ownerId || s.ownerId === req.ownerId);
    if (!targets.length) return res.status(404).json({ error: "No push subscription on this device" });

    const payload = JSON.stringify({
      title: "Time for Sadhana",
      body: "A few mindful minutes will meet you where you are — no streak guilt.",
      url: "/#/",
    });

    let sent = 0;
    for (const s of targets) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          payload,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) subs.delete(s.endpoint);
      }
    }
    res.json({ ok: true, sent });
  });

  /**
   * Dispatch reminders for the current UTC hour mapped roughly to local hours.
   * Production should hit this from a scheduler; safe to call manually.
   */
  app.post("/api/push/dispatch-reminders", pushLimit, async (req: Request, res: Response) => {
    const secret = process.env.PUSH_DISPATCH_SECRET;
    if (secret && req.get("x-push-secret") !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const hour = new Date().getHours();
    const payload = JSON.stringify({
      title: "Gentle practice reminder",
      body: "Missed yesterday? Start with one easy pose — your chain is not broken.",
      url: "/#/",
    });
    let sent = 0;
    for (const s of subs.values()) {
      if (s.reminderHour !== hour) continue;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) subs.delete(s.endpoint);
      }
    }
    res.json({ ok: true, sent, hour });
  });
}
