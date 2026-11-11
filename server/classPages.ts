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
 * The same lookup also feeds the page's `<head>` (`classPageHead`): title,
 * description, canonical URL, Open Graph / Twitter tags and, when accurate,
 * schema.org `VideoObject` data — in the server HTML, because link previews
 * and most crawlers never run the app's JavaScript.
 *
 * What leaves this module is what a signed-out visitor may see: slugs and
 * catalogue copy. Never a Plus playback id, a policy or a token — the head is
 * built from `presentClass(row, "free")`, the same view the API gives a guest.
 */
import type { ClassRow } from "../shared/schema";
import { classSlugSchema, presentClass, type ClassRecord } from "../shared/classLibrary";
import { MUX_PUBLIC_TEST_PLAYBACK_ID } from "./classSeed";

type ClassLookup = {
  getClassBySlug(slug: string): Promise<(Pick<ClassRow, "published"> & Partial<ClassRow>) | undefined>;
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
  return (await resolveClassPage(pathname, store))?.status ?? null;
}

/**
 * `classPageStatus` plus the published row itself, from one lookup, so the
 * status line and the `<head>` can never disagree about whether the class
 * exists. `row` is only ever a published class.
 */
export async function resolveClassPage(
  pathname: string,
  store: ClassLookup | undefined,
): Promise<{ status: 200 | 404; row?: ClassRow } | null> {
  const match = CLASS_DETAIL.exec(pathname);
  if (!match) return null;
  let slug: string;
  try { slug = decodeURIComponent(match[1]!); } catch { return { status: 404 }; }
  if (!classSlugSchema.safeParse(slug).success) return { status: 404 };
  if (!store) return { status: 200 };
  try {
    const row = await store.getClassBySlug(slug);
    if (!row?.published) return { status: 404 };
    // A full row has a title; the status-only fixtures some callers pass do not.
    return typeof row.title === "string" ? { status: 200, row: row as ClassRow } : { status: 200 };
  } catch {
    return { status: 200 };
  }
}

/** What `brandPublicHtml` writes into the server HTML for one page. */
export type PageHead = {
  title: string;
  description: string;
  /** Path under the canonical origin, without a trailing slash or query. */
  canonicalPath: string;
  /** Absolute poster URL, or null to keep the site's default share image. */
  image: string | null;
  imageAlt: string | null;
  /** schema.org data for a `<script type="application/ld+json">`, or null. */
  jsonLd: Record<string, unknown> | null;
};

const DESCRIPTION_MAX = 200;

/** One line of plain text, cut at a word boundary: share cards truncate anyway, mid-word. */
function summarise(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= DESCRIPTION_MAX) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), DESCRIPTION_MAX - 40)).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * The `<head>` for a published class page.
 *
 * Everything comes from the stored row as a signed-out free viewer would
 * receive it. The poster in particular is `presentClass(...).thumbnailUrl`:
 * a signed (Plus) class resolves to the same-origin relay
 * `/api/classes/<slug>/thumbnail.webp` — or to nothing when the server cannot
 * sign — and a thumbnail URL that embeds a locked class's playback id is
 * dropped, exactly as it is for a guest in the API. With no poster the page
 * keeps the site's default share image rather than inventing one.
 */
export function classPageHead(row: ClassRow, origin: string, options: { signedThumbnails: boolean }): PageHead {
  const guestView = presentClass(row as ClassRecord, "free", null, undefined, { signedThumbnails: options.signedThumbnails });
  const canonicalPath = `/classes/${encodeURIComponent(row.slug)}`;
  const authored = summarise(row.description ?? "");
  const tags = row.focusTags?.length ? ` Focus: ${row.focusTags.join(", ")}.` : "";
  const description = authored
    || summarise(`A ${row.durationMinutes}-minute ${row.level} yoga class with ${row.instructorName}.${tags}`);
  const poster = guestView.thumbnailUrl;
  const image = poster ? new URL(poster, `${origin}/`).toString() : null;

  return {
    title: `${row.title} · Sadhana`,
    description,
    canonicalPath,
    image,
    imageAlt: image ? `${row.title} — yoga class on Sadhana` : null,
    jsonLd: classVideoObject(row, { origin, canonicalPath, description: authored, image }),
  };
}

/**
 * schema.org `VideoObject`, only when every statement in it is true of the
 * video a visitor would actually be shown. It is withheld when:
 *
 * - there is no video yet, or the "video" is Mux's public test clip standing
 *   in for an unfilmed placeholder class (the title would describe footage
 *   that does not exist);
 * - the class has no description of its own, or no poster of its own — the
 *   site's default share image is not a thumbnail of this video;
 * - the stored creation time is not a real date.
 *
 * Deliberately absent: `duration` (`durationMinutes` is rounded up to a whole
 * minute, or typed by hand — an ISO 8601 duration would claim precision the
 * catalogue does not have) and `contentUrl` / `embedUrl` (both would publish
 * the playback id). `uploadDate` is the row's `createdAt`, which is when the
 * class was added to this site and is preserved across later edits.
 */
function classVideoObject(
  row: ClassRow,
  page: { origin: string; canonicalPath: string; description: string; image: string | null },
): Record<string, unknown> | null {
  const playbackId = row.muxPlaybackId?.trim();
  if (!playbackId || playbackId === MUX_PUBLIC_TEST_PLAYBACK_ID) return null;
  if (!page.description || !page.image) return null;
  const uploaded = new Date(row.createdAt);
  if (!row.createdAt || Number.isNaN(uploaded.getTime())) return null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: row.title,
    description: page.description,
    thumbnailUrl: [page.image],
    uploadDate: uploaded.toISOString(),
    url: `${page.origin}${page.canonicalPath}`,
    // Plus classes play only for members; saying so keeps the markup honest.
    isAccessibleForFree: row.tier !== "plus",
  };
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
