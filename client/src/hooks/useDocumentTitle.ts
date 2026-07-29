import { useEffect } from "react";

/**
 * Sets document.title for hash-routed pages (screen-reader orientation), and
 * optionally the meta description.
 *
 * index.html carries a site-wide description, but every hash route shared it —
 * so a link to a specific pose or pathway previewed as generic boilerplate.
 * Pass `description` on pages worth describing individually.
 */
export function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);

  useEffect(() => {
    if (!description) return;
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) return;
    const prev = tag.content;
    tag.content = description;
    return () => {
      tag.content = prev;
    };
  }, [description]);
}
