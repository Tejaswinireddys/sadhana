/**
 * Spread onto an `<img>` to set its fetch priority:
 * `<img {...fetchPriority("high")} />`.
 *
 * Why not `fetchPriority="high"`: React 18 does not know that camelCase prop
 * and logs "React does not recognize the `fetchPriority` prop on a DOM
 * element" as a console error on every render in development — Today's pose
 * rows printed it on each load, burying real errors. (The attribute itself
 * still reached the DOM, since HTML attribute names are case-insensitive.)
 * The lowercase name is what React 18 expects for an unknown attribute. Once
 * the app is on React 19, which supports `fetchPriority`, this can go.
 */
export type FetchPriority = "high" | "low" | "auto";

export function fetchPriority(value: FetchPriority): { fetchpriority: FetchPriority } {
  return { fetchpriority: value };
}
