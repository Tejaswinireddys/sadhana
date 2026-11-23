/**
 * How a square thumbnail should frame a catalog illustration.
 *
 * Sources are tall 600×1200 drawings. A tight trim with no inset clips
 * Warrior II's fingertips and Mountain / Lion at the crown or the feet.
 * Savasana is drawn head-up in that portrait frame, so the square reads as
 * someone standing — the same silhouette as Mountain — instead of lying down.
 */

/** Pixels of clear space inside the 160px thumb, on every side. */
export const THUMB_INSET_PX = 16;

/**
 * Supine poses drawn along the long axis. The thumb generator rotates these
 * before trimming so the body lies across the square.
 */
export const SUPINE_THUMB_SLUGS = ["savasana"] as const;

export function supineThumb(slug: string): boolean {
  return (SUPINE_THUMB_SLUGS as readonly string[]).includes(slug);
}
