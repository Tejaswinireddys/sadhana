/**
 * WCAG contrast maths, so palette decisions are checked rather than eyeballed.
 *
 * A cream-on-cream palette looks calm and fails badly: "Beginner" badges landed
 * at 3.51:1 and "Intermediate" was effectively invisible. These helpers back the
 * contrast test that now guards every foreground/background token pair.
 */

export type Hsl = { h: number; s: number; l: number };

/** Parse the `H S% L%` form used by our CSS custom properties. */
export function parseHsl(value: string): Hsl {
  const [h, s, l] = value
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two `H S% L%` strings, 1–21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(hslToRgb(parseHsl(foreground)));
  const b = relativeLuminance(hslToRgb(parseHsl(background)));
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and UI components. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
