import express from "express";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { brandPublicHtml, publicAppOrigin, robotsTxt } from "./publicUrl";
import { sendJson404 } from "./json404";
import { mountStaticMedia } from "./mountStaticMedia";

function sendBrandedHtml(res: express.Response, filePath: string, status = 200) {
  const html = brandPublicHtml(fs.readFileSync(filePath, "utf-8"));
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
  "instructors",
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
        if (filePath.endsWith("robots.txt")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );

  app.get("/", (_req, res) => {
    sendBrandedHtml(res, indexPath);
  });

  app.use("/{*path}", (req, res) => {
    const pathname = requestPathname(req);
    if (isNonSpaPrefix(pathname)) {
      sendJson404(res);
      return;
    }
    if (path.extname(pathname)) {
      // Missing static asset (image/video/font) — empty 404 so onError fires.
      res.status(404).end();
      return;
    }
    sendBrandedHtml(res, indexPath, isKnownAppRoute(pathname) ? 200 : 404);
  });
}
