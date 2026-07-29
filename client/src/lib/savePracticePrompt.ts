/**
 * savePracticePrompt — when to ask a guest to create an account.
 *
 * The problem this solves is not conversion, it's loss. A guest's practice
 * lives under a device id. Clear site data, open a private window, or let
 * Safari's ITP evict storage, and every session, streak, journal entry and
 * custom flow is stranded on the server with no way to reach it. Silence is
 * the wrong default: we know the risk and the practitioner doesn't.
 *
 * The ladder, and why it is shaped this way:
 *
 *   0 sessions  — nothing. There is nothing to lose yet, and a wall in front of
 *                 someone's first practice is how a wellness app dies. They
 *                 haven't seen the product; asking for an email buys nothing.
 *
 *   1+ sessions — a dismissible banner. They have felt the value once and now
 *                 own something. Dismissal is respected for the rest of the day
 *                 so it never becomes noise.
 *
 *   3+ sessions — a blocking prompt before the next session starts. At three
 *                 sessions there is a streak, and a streak is the thing people
 *                 actually grieve. "Continue as guest" stays available as a
 *                 quiet text link, because holding someone's own practice
 *                 hostage is not a growth strategy — it's a dark pattern, and
 *                 it converts worse than honesty anyway.
 *
 * Export is offered at every rung. If someone declines an account, they should
 * still be able to walk away with their data.
 */
import { readJson, writeJson } from "@/lib/localPrefs";

export const BANNER_AFTER_SESSIONS = 1;
export const BLOCKING_AFTER_SESSIONS = 3;

const DISMISS_KEY = "sadhana.savePrompt.dismissed";

type DismissState = {
  /** YYYY-MM-DD the soft banner was last dismissed. */
  bannerDay?: string;
  /** Session count at which the blocking prompt was last declined. */
  blockedAt?: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type SavePromptLevel = "none" | "banner" | "blocking";

/**
 * Which prompt (if any) a guest should see right now.
 *
 * `totalSessions` is the server's count for this owner — the number that would
 * actually be lost.
 */
export function savePromptLevel(args: {
  isSignedIn: boolean;
  totalSessions: number;
  /** Pass true only at a natural boundary (starting a session), never mid-practice. */
  atSessionBoundary?: boolean;
  now?: DismissState;
}): SavePromptLevel {
  const { isSignedIn, totalSessions, atSessionBoundary = false } = args;
  if (isSignedIn) return "none";
  if (totalSessions < BANNER_AFTER_SESSIONS) return "none";

  const state = args.now ?? readDismissState();

  if (totalSessions >= BLOCKING_AFTER_SESSIONS && atSessionBoundary) {
    // Declining is remembered until they accrue more practice, so the prompt
    // reappears when the stakes have actually risen — not on the next click.
    if ((state.blockedAt ?? 0) >= totalSessions) return "banner";
    return "blocking";
  }

  if (state.bannerDay === today()) return "none";
  return "banner";
}

export function readDismissState(): DismissState {
  return readJson<DismissState>(DISMISS_KEY, {});
}

export function dismissBanner(): void {
  writeJson<DismissState>(DISMISS_KEY, { ...readDismissState(), bannerDay: today() });
}

export function declineBlocking(totalSessions: number): void {
  writeJson<DismissState>(DISMISS_KEY, {
    ...readDismissState(),
    blockedAt: totalSessions,
    bannerDay: undefined,
  });
}

/** Cleared on sign-in so a later sign-out starts the ladder honestly. */
export function resetSavePrompt(): void {
  writeJson<DismissState>(DISMISS_KEY, {});
}

/** Plain-language stake, used in both prompts. Numbers, not adjectives. */
export function stakeSummary(totalSessions: number, currentStreak: number): string {
  const parts = [`${totalSessions} ${totalSessions === 1 ? "session" : "sessions"}`];
  if (currentStreak > 1) parts.push(`a ${currentStreak}-day streak`);
  return parts.join(" and ");
}
