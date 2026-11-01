/**
 * When the class player should fetch fresh signed-playback tokens.
 *
 * Tokens live `CLASS_TOKEN_SECONDS` (1h). Mux checks them when the player asks
 * for a playlist, which also happens mid-class (rendition switches, seeks,
 * reconnects), so a long class or a long pause must get new tokens before the
 * old ones lapse. Refreshing a few minutes early leaves room for one slow or
 * failed request to be retried.
 */

/** Ask for new tokens this long before the current ones expire. */
export const CLASS_TOKEN_REFRESH_LEAD_MS = 5 * 60_000;
/** After a failed refresh, try again this soon. */
export const CLASS_TOKEN_RETRY_MS = 30_000;
/** setTimeout overflows above 2^31-1 ms and would fire immediately. */
const MAX_TIMER_MS = 2_147_483_647;

/** Milliseconds until the refresh is due; 0 when it already is. */
export function tokenRefreshDelayMs(expiresAtSeconds: number, nowMs: number): number {
  const due = expiresAtSeconds * 1000 - CLASS_TOKEN_REFRESH_LEAD_MS - nowMs;
  return Math.min(MAX_TIMER_MS, Math.max(0, Math.floor(due)));
}

/** True when a refresh is due (timers do not run while a tab sleeps). */
export function tokenRefreshDue(expiresAtSeconds: number, nowMs: number): boolean {
  return tokenRefreshDelayMs(expiresAtSeconds, nowMs) === 0;
}

/** The delay before retrying a failed refresh, never past the token's expiry. */
export function tokenRetryDelayMs(expiresAtSeconds: number, nowMs: number): number {
  const untilExpiry = expiresAtSeconds * 1000 - nowMs;
  return Math.max(1_000, Math.min(CLASS_TOKEN_RETRY_MS, untilExpiry > 0 ? untilExpiry : CLASS_TOKEN_RETRY_MS));
}

/**
 * Swapping the playback token reloads the stream, so the player has to be put
 * back where the viewer was. This is the position to restore and whether to
 * resume playing.
 */
export function restorePoint(player: { currentTime?: number; paused?: boolean } | null | undefined): { at: number; play: boolean } {
  const at = player && Number.isFinite(player.currentTime) ? Math.max(0, player.currentTime ?? 0) : 0;
  return { at, play: !!player && player.paused === false };
}
