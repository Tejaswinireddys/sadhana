/** Optimistic favorite list. `isFav` is the state before the tap. */
export function applyFavoriteToggle(slugs: readonly string[], slug: string, isFav: boolean): string[] {
  if (isFav) return slugs.filter((item) => item !== slug);
  return slugs.includes(slug) ? [...slugs] : [...slugs, slug];
}
