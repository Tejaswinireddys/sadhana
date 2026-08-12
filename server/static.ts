import express from "express";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { brandPublicHtml, publicAppOrigin, robotsTxt } from "./publicUrl";
import { sendJson404 } from "./json404";
import { mountStaticMedia } from "./mountStaticMedia";

function sendBrandedHtml(res: express.Response, filePath: string) {
  const html = brandPublicHtml(fs.readFileSync(filePath, "utf-8"));
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(html);
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
    sendBrandedHtml(res, indexPath);
  });
}
