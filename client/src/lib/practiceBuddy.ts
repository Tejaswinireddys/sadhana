/**
 * Privacy-first practice buddy — opt-in pairing via share code.
 * No public feed, no body metrics, no leaderboard.
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

export function clearBuddyPair(): PracticeBuddy {
  const mine = readBuddy();
  const next = { ...mine, pairedWithCode: null, pairedName: null, lastNudgeAt: null };
  writeBuddy(next);
  return next;
}

export function recordBuddyNudge(): PracticeBuddy {
  const mine = readBuddy();
  const next = { ...mine, lastNudgeAt: new Date().toISOString() };
  writeBuddy(next);
  return next;
}
