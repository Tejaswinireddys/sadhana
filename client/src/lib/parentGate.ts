/**
 * Parent gate question generator.
 *
 * "What is 4 + 8?" is solved by every child old enough to open the app, which
 * made the gate decorative. Two-digit multiplication is the standard bar for
 * this pattern: it isn't a security control (nothing client-side is), but it
 * reliably sits above the age range the gate exists to stop.
 */

/** How long the confirm button must be held, in milliseconds. */
export const HOLD_MS = 1200;

export type ParentGateQuestion = { a: number; b: number };

/** A randomised two-digit × two-digit question. */
export function makeParentGateQuestion(
  random: () => number = Math.random,
): ParentGateQuestion {
  // 12–29 × 11–19 — awkward enough to need real arithmetic, small enough that
  // an adult can do it in their head without resenting the app.
  const a = 12 + Math.floor(random() * 18);
  const b = 11 + Math.floor(random() * 9);
  return { a, b };
}

export function isCorrect(q: ParentGateQuestion, answer: string): boolean {
  const n = Number.parseInt(answer, 10);
  return Number.isFinite(n) && n === q.a * q.b;
}
