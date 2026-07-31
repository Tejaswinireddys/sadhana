/**
 * Web Push (VAPID) — reminders that work when the tab is closed.
 * Persists subscriptions and matches reminder hours in the subscriber's timezone.
 */
import type { Express, Request, Response } from "express";
import webpush from "web-push";
import { createRateLimiter } from "./security";
import { loadMap, saveMap } from "./jsonStore";
import { localDayHourKey, localHourFor } from "./pushTime";

export { localDayHourKey, localHourFor } from "./pushTime";

type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  ownerId: string;
  reminderHour: number;
  /** Minutes to add to local time to get UTC (Date#getTimezoneOffset). */
  timezoneOffsetMinutes: number;
  createdAt: string;
  /** YYYY-MM-DDTHH in subscriber-local — last successful reminder. */
  lastSentKey?: string;
};

const STORE = "push-subs";
const subs = loadMap<PushSub>(STORE);

function persist() {
  saveMap(STORE, subs);
}

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

async function sendTo(sub: PushSub, payload: string): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      subs.delete(sub.endpoint);
      persist();
    }
    return false;
  }
}

export async function dispatchDueReminders(now = new Date()): Promise<number> {
  const payload = JSON.stringify({
    title: "Gentle practice reminder",
    body: "Missed yesterday? Start with one easy pose — your chain is not broken.",
    url: "/#/",
  });
  let sent = 0;
  for (const s of subs.values()) {
    if (localHourFor(s, now) !== s.reminderHour) continue;
    const key = localDayHourKey(s, now);
    if (s.lastSentKey === key) continue;
    if (await sendTo(s, payload)) {
      s.lastSentKey = key;
      subs.set(s.endpoint, s);
      sent++;
    }
  }
  if (sent) persist();
  return sent;
}

/** Find push endpoints for an owner (used by practice-buddy nudges). */
export async function pushToOwner(
  ownerId: string,
  title: string,
  body: string,
): Promise<number> {
  if (!ownerId) return 0;
  const payload = JSON.stringify({ title, body, url: "/#/challenges" });
  let sent = 0;
  for (const s of subs.values()) {
    if (s.ownerId !== ownerId) continue;
    if (await sendTo(s, payload)) sent++;
  }
  return sent;
}

let schedulerStarted = false;

export function startPushScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  // Every 10 minutes — cheap and catches the top of each local hour.
  const tick = () => {
    void dispatchDueReminders().then((n) => {
      if (n > 0) console.log(`[push] dispatched ${n} reminder(s)`);
    });
  };
  tick();
  setInterval(tick, 10 * 60_000);
}

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
    const timezoneOffsetMinutes = Number.isFinite(Number(req.body?.timezoneOffsetMinutes))
      ? Number(req.body.timezoneOffsetMinutes)
      : new Date().getTimezoneOffset();
    const prev = subs.get(endpoint);
    subs.set(endpoint, {
      endpoint,
      keys: { p256dh, auth },
      ownerId: req.ownerId || prev?.ownerId || "",
      reminderHour,
      timezoneOffsetMinutes,
      createdAt: prev?.createdAt || new Date().toISOString(),
      lastSentKey: prev?.lastSentKey,
    });
    persist();
    res.status(201).json({ ok: true, reminderHour, timezoneOffsetMinutes });
  });

  app.post("/api/push/unsubscribe", pushLimit, (req: Request, res: Response) => {
    const endpoint = String(req.body?.endpoint || "");
    if (endpoint) {
      subs.delete(endpoint);
      persist();
    }
    res.json({ ok: true });
  });

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
      if (await sendTo(s, payload)) sent++;
    }
    res.json({ ok: true, sent });
  });

  app.post("/api/push/dispatch-reminders", pushLimit, async (req: Request, res: Response) => {
    const secret = process.env.PUSH_DISPATCH_SECRET;
    if (secret && req.get("x-push-secret") !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const sent = await dispatchDueReminders();
    res.json({ ok: true, sent, hourUtc: new Date().getUTCHours() });
  });
}
