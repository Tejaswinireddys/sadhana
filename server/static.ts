import { billingEnabled } from "./publicConfig";
import express from "express";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { brandPublicHtml, publicAppOrigin, robotsTxt } from "./publicUrl";
import { sendJson404 } from "./json404";
import { mountStaticMedia } from "./mountStaticMedia";

const ONE_YEAR_SECONDS = 31_536_000;
const ONE_DAY_SECONDS = 86_400;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;
const IMAGE_EXT = /\.(webp|png|jpe?g|svg)$/i;

/**
 * Cache-Control for a file served from dist/public, given its path relative to
 * that directory, or undefined to keep express.static's default (revalidate
 * via ETag).
 *
 * Vite emits every JS/CSS/font/image it bundles to `assets/` with a content
 * hash in the name, so a changed file is a new URL and the old one can be
 * cached forever. Self-hosted fonts get the same year-long lifetime but not
 * `immutable` unless hashed — a font in public/ keeps its name when replaced.
 * Unhashed public images (poses, kids, posters) keep their names when an
 * illustration is corrected, so they get a day rather than a year. The
 * service worker must always be fresh or a broken one can pin a release.
 */
export function staticCacheControl(relativePath: string): string | undefined {
  const normalized = relativePath.split(path.sep).join("/").replace(/^\/+/, "");
  if (normalized === "robots.txt" || normalized === "sw.js") return "no-store";
  if (normalized.startsWith("assets/")) return `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  if (FONT_EXT.test(normalized)) return `public, max-age=${ONE_YEAR_SECONDS}`;
  if (IMAGE_EXT.test(normalized)) return `public, max-age=${ONE_DAY_SECONDS}`;
  return undefined;
}

function sendBrandedHtml(res: express.Response, filePath: string, status = 200, pathname = "/") {
  const html = brandPublicHtml(fs.readFileSync(filePath, "utf-8"), publicAppOrigin(), pathname);
  res.setHeader("Cache-Control", "no-cache");
  res.status(status).setHeader("Content-Type", "text/html; charset=utf-8").send(html);
}

/**
 * First path segment of every client-side route in App.tsx. Anything else
 * falling through to the SPA shell is a genuinely unknown URL, not a page
 * the router will match — it should still render the app's own branded
 * "not found" screen (so a person hitting a stale link sees the same UI),
 * but the HTTP status needs to say 404 so crawlers/uptime monitors don't
 * index or alert on it as a real page.
 */
const KNOWN_TOP_LEVEL_SEGMENTS = new Set([
  "",
  "register",
  "welcome",
  "start",
  "analytics",
  "asanas",
  "pathways",
  "practice",
  "guided",
  "trainer",
  "breathing",
  "affirmations",
  "journal",
  "profiles",
  "builder",
  "kids",
  "search",
  "settings",
  "account",
  "verify",
  "privacy",
  "terms",
  "health-disclaimer",
  "plus",
  "cancel",
  "challenges",
  "adaptive",
  "pose-coach",
  "help",
  "instructor",
  "instructors",
  "teachers",
  "household",
  "corporate",
  "design-system",
]);

function isKnownAppRoute(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return KNOWN_TOP_LEVEL_SEGMENTS.has(first);
}

function requestPathname(req: { originalUrl?: string; url?: string; path?: string }): string {
  const raw = req.originalUrl || req.url || req.path || "";
  return raw.split("?")[0] || "";
}

/** Prefixes that must never resolve to the SPA shell. */
function isNonSpaPrefix(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/v1/") ||
    pathname.startsWith("/audio/") ||
    pathname.startsWith("/voice/") ||
    pathname === "/audio" ||
    pathname === "/voice"
  );
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");
  const welcomePath = path.resolve(distPath, "welcome.html");
  const hasWelcomeCookie = (req: express.Request) => /(?:^|;\s*)sadhana_welcome_seen=1(?:;|$)/.test(req.headers.cookie || "");
  const sendSpaHtml = (req: express.Request, res: express.Response, pathname: string, status = 200) => {
    const isWelcome = pathname === "/welcome" || (pathname === "/" && !hasWelcomeCookie(req));
    sendBrandedHtml(res, isWelcome ? welcomePath : indexPath, status, pathname);
  };

  app.get("/robots.txt", (_req, res) => {
    res.status(200).type("text/plain").send(robotsTxt(publicAppOrigin()));
  });

  // /audio + /voice before general static so missing files get JSON 404s.
  mountStaticMedia(app);

  app.use(
    express.static(distPath, {
      index: false,
      fallthrough: true,
      setHeaders(res, filePath) {
        const cacheControl = staticCacheControl(path.relative(distPath, filePath));
        if (cacheControl) res.setHeader("Cache-Control", cacheControl);
      },
    }),
  );

  app.get("/welcome", (req, res) => sendSpaHtml(req, res, "/welcome"));
  app.get("/", (req, res) => sendSpaHtml(req, res, "/"));

  app.use("/{*path}", (req, res) => {
    const pathname = requestPathname(req);
    if (pathname === "/design-system" || pathname.startsWith("/analytics/")) {
      res.setHeader("X-Robots-Tag", "noindex");
      sendSpaHtml(req, res, pathname, 404);
      return;
    }
    // /cancel stays reachable (renewal emails, bookmarks) and explains that Plus
    // is waitlist-only while billing is off — just not indexed until it is sold.
    if (!billingEnabled() && (pathname === "/cancel" || pathname.startsWith("/cancel/"))) {
      res.setHeader("X-Robots-Tag", "noindex");
    }
    if (isNonSpaPrefix(pathname)) {
      sendJson404(res);
      return;
    }
    if (path.extname(pathname)) {
      // Missing static asset (image/video/font) — empty 404 so onError fires.
      res.status(404).end();
      return;
    }
    sendSpaHtml(req, res, pathname, isKnownAppRoute(pathname) ? 200 : 404);
  });
}
