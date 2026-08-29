/**
 * savePracticePrompt — when to ask a guest to create an account.
 *
 * A guest's practice lives under a device id. Silence forever is wrong; a wall
 * in front of the session they opened the app to do is worse. The ladder:
 *
 *   0 sessions  — nothing. They haven't seen the product.
 *
 *   1+ sessions — a dismissible Home banner. Dismissal lasts the rest of the day.
 *
 *   3+ sessions — a prompt on the *completion* screen, once they have just
 *                 earned something worth keeping. Never before a session starts.
 *                 At most once per week. "Not now" is a real exit.
 *
 * Export is offered at every rung.
 */
import { readJson, writeJson } from "@/lib/localPrefs";

export const BANNER_AFTER_SESSIONS = 1;
export const BLOCKING_AFTER_SESSIONS = 3;

/**
 * The Home "saved only on this device" banner asks a guest to commit (create an
 * account / download a backup). It must not precede value: only surface it once
 * the practitioner has had real, repeated benefit — at least this many completed
 * sessions across at least this many separate active days.
 */
export const BANNER_MIN_SESSIONS = 2;
export const BANNER_MIN_ACTIVE_DAYS = 2;

const DISMISS_KEY = "sadhana.savePrompt.dismissed";

type DismissState = {
  /** YYYY-MM-DD the soft banner was last dismissed. */
  bannerDay?: string;
  /** Session count at which the completion prompt was last declined. */
  blockedAt?: number;
  /** YYYY-MM-DD the completion prompt was last shown/declined. */
  blockedOn?: string;
};

const WEEK_MS = 7 * 86_400_000;

function withinLastWeek(isoDay: string | undefined, now: Date): boolean {
  if (!isoDay) return false;
  const t = Date.parse(`${isoDay}T00:00:00`);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < WEEK_MS;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type SavePromptLevel = "none" | "banner" | "blocking";

/**
 * Which prompt (if any) a guest should see right now.
 *
 * `totalSessions` is the server's count for this owner.
 */
export function savePromptLevel(args: {
  isSignedIn: boolean;
  totalSessions: number;
  /**
   * Pass true only on the session-complete screen, never before practice starts.
   * Starting a mood session because you're tense is not a decision moment.
   */
  atCompletion?: boolean;
  now?: DismissState;
  clock?: Date;
}): SavePromptLevel {
  const { isSignedIn, totalSessions, atCompletion = false } = args;
  if (isSignedIn) return "none";
  if (totalSessions < BANNER_AFTER_SESSIONS) return "none";

  const state = args.now ?? readDismissState();
  const clock = args.clock ?? new Date();

  if (totalSessions >= BLOCKING_AFTER_SESSIONS && atCompletion) {
    if (withinLastWeek(state.blockedOn, clock)) return "banner";
    if ((state.blockedAt ?? 0) >= totalSessions) return "banner";
    return "blocking";
  }

  if (state.bannerDay === today()) return "none";
  return "banner";
}

/**
 * Whether the Home save-your-practice banner should show right now. Beyond the
 * base prompt ladder, it waits until the guest has completed
 * BANNER_MIN_SESSIONS sessions on BANNER_MIN_ACTIVE_DAYS separate days — so we
 * never ask for commitment before delivering repeated value.
 */
export function shouldShowSaveBanner(args: {
  level: SavePromptLevel;
  totalSessions: number;
  daysPracticed: number;
}): boolean {
  if (args.level !== "banner") return false;
  return (
    args.totalSessions >= BANNER_MIN_SESSIONS && args.daysPracticed >= BANNER_MIN_ACTIVE_DAYS
  );
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
    blockedOn: today(),
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
