import { pageMetadata } from "./pageMetadata";
import { publicConfigHtml } from "./publicConfig";
/** Use the operator's domain, or Render's supplied deployment URL. Never another owner's domain. */
export function publicAppOrigin(): string {
  const raw = process.env.PUBLIC_APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || "http://localhost:5000";
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("PUBLIC_APP_URL must use HTTPS or HTTP");
  return url.origin;
}

export function brandPublicHtml(html: string, origin = publicAppOrigin(), pathname = "/"): string {
  const canonicalPath = pathname === "/welcome" ? "/" : pathname.split("?")[0];
  const canonical = `${origin}${canonicalPath}`;
  const metadata = pageMetadata(pathname);
  if (metadata) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(metadata.title)}</title>`)
      .replace(/(<meta\s+(?:name|property)="(?:description|og:description|twitter:description)"\s+content=")[^"]*(")/g, (_all, start, end) => `${start}${escapeAttr(metadata.description)}${end}`)
      .replace(/(<meta\s+(?:name|property)="(?:og:title|twitter:title)"\s+content=")[^"]*(")/g, (_all, start, end) => `${start}${escapeAttr(metadata.title)}${end}`);
  }
  return html.split("__PUBLIC_APP_ORIGIN__").join(origin)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_all, start, end) => `${start}${escapeAttr(canonical)}${end}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (_all, start, end) => `${start}${escapeAttr(canonical)}${end}`)
    .replace("</head>", `${publicConfigHtml()}</head>`);
}
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
export function robotsTxt(origin = publicAppOrigin()): string {
  return `User-agent: *\nAllow: /\nDisallow: /design-system\nDisallow: /analytics/\n\nSitemap: ${origin}/sitemap.xml\n`;
}
