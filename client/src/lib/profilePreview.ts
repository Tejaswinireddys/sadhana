/**
 * Thumbnails on a path card. Skip illustrations that are withheld because
 * they contradict the pose steps — those render as an empty broken-image
 * mark. If every pose in the path is withheld, keep the originals so the
 * card still shows the honest placeholder.
 */
export function profilePreviewSlugs(
  slugs: readonly string[],
  withheld: (slug: string) => boolean,
  limit = 3,
): string[] {
  const accurate = slugs.filter((slug) => !withheld(slug));
  return (accurate.length > 0 ? accurate : [...slugs]).slice(0, limit);
}
