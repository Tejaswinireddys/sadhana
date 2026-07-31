/**
 * Privacy-first practice buddy — opt-in pairing via share code.
 * Local cache + server registry for cross-device pair/nudge.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

export type PracticeBuddy = {
  code: string;
  displayName: string;
  pairedWithCode: string | null;
  pairedName: string | null;
  lastNudgeAt: string | null;
  encouragement: string;
};

const DEFAULT: PracticeBuddy = {
  code: "",
  displayName: "Friend",
  pairedWithCode: null,
  pairedName: null,
  lastNudgeAt: null,
  encouragement: "Showing up is enough — glad you're here.",
};

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "SB-";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function readBuddy(): PracticeBuddy {
  const raw = readJson<Partial<PracticeBuddy>>(KEYS.practiceBuddy, {});
  const base = { ...DEFAULT, ...raw };
  if (!base.code) {
    base.code = randomCode();
    writeJson(KEYS.practiceBuddy, base);
  }
  return base as PracticeBuddy;
}

export function writeBuddy(b: PracticeBuddy) {
  writeJson(KEYS.practiceBuddy, b);
}

/** Register this device's code on the server (idempotent). */
export async function registerBuddyRemote(buddy = readBuddy()): Promise<PracticeBuddy> {
  try {
    await fetch("/api/buddy/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: buddy.code, displayName: buddy.displayName }),
    });
  } catch {
    /* offline — local code still works for later sync */
  }
  return buddy;
}

export async function pairBuddyRemote(
  theirCode: string,
  displayName?: string,
): Promise<PracticeBuddy> {
  const mine = readBuddy();
  const code = theirCode.trim().toUpperCase();
  if (!code || code === mine.code) return mine;

  try {
    const res = await fetch("/api/buddy/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        myCode: mine.code,
        theirCode: code,
        displayName: displayName ?? mine.displayName,
      }),
    });
    const data = (await res.json()) as {
      pairedWithCode?: string;
      pairedName?: string;
      error?: string;
    };
    if (!res.ok) {
      return mine;
    }
    const next: PracticeBuddy = {
      ...mine,
      displayName: displayName ?? mine.displayName,
      pairedWithCode: data.pairedWithCode || code,
      pairedName: data.pairedName || "Buddy",
    };
    writeBuddy(next);
    return next;
  } catch {
    // Offline fallback: still remember the code locally.
    const next: PracticeBuddy = {
      ...mine,
      pairedWithCode: code,
      pairedName: "Buddy",
    };
    writeBuddy(next);
    return next;
  }
}

/** @deprecated Prefer pairBuddyRemote — kept for unit tests of local shape. */
export function pairBuddy(theirCode: string, theirName = "Buddy"): PracticeBuddy {
  const mine = readBuddy();
  const code = theirCode.trim().toUpperCase();
  if (!code || code === mine.code) return mine;
  const next: PracticeBuddy = {
    ...mine,
    pairedWithCode: code,
    pairedName: theirName.trim() || "Buddy",
  };
  writeBuddy(next);
  return next;
}

export async function clearBuddyPairRemote(): Promise<PracticeBuddy> {
  const mine = readBuddy();
  try {
    await fetch("/api/buddy/unpair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myCode: mine.code }),
    });
  } catch {
    /* ignore */
  }
  const next = { ...mine, pairedWithCode: null, pairedName: null, lastNudgeAt: null };
  writeBuddy(next);
  return next;
}

export function clearBuddyPair(): PracticeBuddy {
  const mine = readBuddy();
  const next = { ...mine, pairedWithCode: null, pairedName: null, lastNudgeAt: null };
  writeBuddy(next);
  return next;
}

export async function sendBuddyNudgeRemote(): Promise<{
  buddy: PracticeBuddy;
  deliveredPush: number;
  message: string;
}> {
  const mine = readBuddy();
  try {
    const res = await fetch("/api/buddy/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myCode: mine.code, message: mine.encouragement }),
    });
    const data = (await res.json()) as { deliveredPush?: number; message?: string };
    const next = { ...mine, lastNudgeAt: new Date().toISOString() };
    writeBuddy(next);
    return {
      buddy: next,
      deliveredPush: data.deliveredPush ?? 0,
      message: data.message || mine.encouragement,
    };
  } catch {
    const next = { ...mine, lastNudgeAt: new Date().toISOString() };
    writeBuddy(next);
    return { buddy: next, deliveredPush: 0, message: mine.encouragement };
  }
}

export function recordBuddyNudge(): PracticeBuddy {
  const mine = readBuddy();
  const next = { ...mine, lastNudgeAt: new Date().toISOString() };
  writeBuddy(next);
  return next;
}
