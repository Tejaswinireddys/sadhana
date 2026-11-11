import { pageMetadata } from "./pageMetadata";
import { publicConfigHtml } from "./publicConfig";
import type { PageHead } from "./classPages";
/** Use the operator's domain, or Render's supplied deployment URL. Never another owner's domain. */
export function publicAppOrigin(): string {
  const raw = process.env.PUBLIC_APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || "http://localhost:5000";
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("PUBLIC_APP_URL must use HTTPS or HTTP");
  return url.origin;
}

/**
 * Rewrite the built HTML for the page being served: canonical origin, and the
 * page's own title / description / share tags.
 *
 * `page` is supplied for pages whose metadata comes from the database (class
 * pages, see `classPageHead`); otherwise the static table in pageMetadata.ts
 * is used. Every substitution goes through a replacer *function*: titles and
 * descriptions are stored content now, and a `$&` or `$1` in a class title
 * would otherwise be read as a replacement pattern.
 */
export function brandPublicHtml(html: string, origin = publicAppOrigin(), pathname = "/", page?: PageHead | null): string {
  const metadata = page ?? pageMetadata(pathname);
  if (metadata) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeAttr(metadata.title)}</title>`)
      .replace(/(<meta\s+(?:name|property)="(?:description|og:description|twitter:description)"\s+content=")[^"]*(")/g, (_all, start, end) => `${start}${escapeAttr(metadata.description)}${end}`)
      .replace(/(<meta\s+(?:name|property)="(?:og:title|twitter:title)"\s+content=")[^"]*(")/g, (_all, start, end) => `${start}${escapeAttr(metadata.title)}${end}`);
  }
  if (page?.image) {
    const image = page.image;
    html = html
      .replace(/(<meta\s+(?:name|property)="(?:og:image|twitter:image)"\s+content=")[^"]*(")/g, (_all, start, end) => `${start}${escapeAttr(image)}${end}`)
      // The template's 1200×630 describes the default image, not this poster.
      .replace(/\s*<meta\s+property="og:image:(?:width|height)"\s+content="[^"]*"\s*\/?>/g, "")
      .replace(/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/, (_all, start, end) => `${start}${escapeAttr(page.imageAlt ?? metadata?.title ?? "")}${end}`);
  }
  html = html.split("__PUBLIC_APP_ORIGIN__").join(origin);
  if (page?.robots) {
    // A class that is not published must not be canonicalised at its own URL.
    html = html
      .replace(/\s*<link rel="canonical" href="[^"]*"\s*\/?>/g, "")
      .replace(/\s*<meta property="og:url" content="[^"]*"\s*\/?>/g, "");
  } else {
    const canonicalPath = page?.canonicalPath ?? (pathname === "/welcome" ? "/" : pathname.split("?")[0]);
    const canonical = `${origin}${canonicalPath}`;
    html = html
      .replace(/(<link rel="canonical" href=")[^"]*(")/, (_all, start, end) => `${start}${escapeAttr(canonical)}${end}`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, (_all, start, end) => `${start}${escapeAttr(canonical)}${end}`);
  }
  const robots = page?.robots ? `<meta name="robots" content="${escapeAttr(page.robots)}">` : "";
  const structured = page?.jsonLd ? `<script type="application/ld+json">${jsonForScript(page.jsonLd)}</script>` : "";
  return html.replace("</head>", () => `${robots}${structured}${publicConfigHtml()}</head>`);
}
/**
 * JSON safe inside a <script> element: `<` is escaped so stored text containing
 * `</script>` or `<!--` cannot end the block. A data block is not executed, so
 * the production CSP (no inline scripts) does not apply to it.
 */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
export function robotsTxt(origin = publicAppOrigin()): string {
  return `User-agent: *\nAllow: /\nDisallow: /design-system\nDisallow: /analytics/\n\nSitemap: ${origin}/sitemap.xml\n`;
}
