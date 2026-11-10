/**
 * Server-side knowledge of class detail pages (`/classes/:slug`), for the HTML
 * status code and the sitemap.
 *
 * Why: the SPA fallback answered 200 for any `/classes/<anything>` because
 * `classes` is a known first segment, so `/classes/missing-class` looked like a
 * real page to crawlers while its API said 404. And the sitemap listed
 * `/classes` but none of the published classes. Both now read the same rule
 * the API uses: a class page exists only while its row exists and is
 * `published`. Deleting a class removes its row, so deleted and missing are
 * the same 404.
 *
 * Only slugs leave this module — never playback ids, policies or tokens.
 */
import type { ClassRow } from "../shared/schema";
import { classSlugSchema } from "../shared/classLibrary";

type ClassLookup = {
  getClassBySlug(slug: string): Promise<Pick<ClassRow, "published"> | undefined>;
};
type ClassLister = {
  listClasses(): Promise<Array<Pick<ClassRow, "slug" | "published">>>;
};

const CLASS_DETAIL = /^\/classes\/([^/]+)\/?$/;

/**
 * The HTTP status for the app shell at `pathname`, when it is a class detail
 * page: 200 for a published class (locked Plus classes included — the page
 * renders and offers Plus), 404 for a missing, deleted or draft one. `null`
 * for any other path, which keeps the existing rules.
 *
 * A lookup failure answers 200: a database blip must not tell crawlers that
 * every real class page is gone. The client still shows its own not-found
 * state if the API later says 404.
 */
export async function classPageStatus(pathname: string, store: ClassLookup | undefined): Promise<200 | 404 | null> {
  const match = CLASS_DETAIL.exec(pathname);
  if (!match) return null;
  let slug: string;
  try { slug = decodeURIComponent(match[1]!); } catch { return 404; }
  if (!classSlugSchema.safeParse(slug).success) return 404;
  if (!store) return 200;
  try {
    const row = await store.getClassBySlug(slug);
    return row?.published ? 200 : 404;
  } catch {
    return 200;
  }
}

/** `/classes/<slug>` for every published class, in catalog order. */
export async function publishedClassPaths(store: ClassLister | undefined): Promise<string[]> {
  if (!store) return [];
  const rows = await store.listClasses();
  return rows.filter((row) => row.published).map((row) => `/classes/${encodeURIComponent(row.slug)}`);
}

/** The sitemap XML for `paths` under the canonical `origin`. */
export function sitemapXml(origin: string, paths: readonly string[]): string {
  const urls = paths
    .map((p) => `  <url><loc>${escapeXml(`${origin}${p}`)}</loc><changefreq>weekly</changefreq></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
