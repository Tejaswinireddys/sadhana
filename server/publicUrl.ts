/** Canonical public origin for OG/canonical/sitemap/emails. */
export function publicAppOrigin(): string {
  const raw =
    process.env.PUBLIC_APP_URL?.trim() || "https://sadhana-ou9m.onrender.com";
  return raw.replace(/\/$/, "");
}

const DEFAULT_ORIGIN = "https://sadhana-ou9m.onrender.com";

/** Rewrite hard-coded Render demo URLs to the configured public origin. */
export function brandPublicHtml(html: string, origin = publicAppOrigin()): string {
  if (origin === DEFAULT_ORIGIN) return html;
  return html.split(DEFAULT_ORIGIN).join(origin);
}

export function robotsTxt(origin = publicAppOrigin()): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
