import express from "express";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { brandPublicHtml, publicAppOrigin, robotsTxt } from "./publicUrl";

function sendBrandedHtml(res: express.Response, filePath: string) {
  const html = brandPublicHtml(fs.readFileSync(filePath, "utf-8"));
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(html);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");

  // Dynamic robots so Sitemap matches PUBLIC_APP_URL / custom domain.
  app.get("/robots.txt", (_req, res) => {
    res.status(200).type("text/plain").send(robotsTxt(publicAppOrigin()));
  });

  app.use(
    express.static(distPath, {
      index: false,
      // Prefer not to serve the static robots.txt — route above wins when registered first.
      setHeaders(res, filePath) {
        if (filePath.endsWith("robots.txt")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );

  // Explicit root handler — needed on some hosts (Render/Cloudflare) where
  // express.static's default index doesn't get picked up for the bare '/'.
  app.get("/", (_req, res) => {
    sendBrandedHtml(res, indexPath);
  });

  // Fall through to index.html for any other unmatched route (SPA client-side
  // routing via wouter's path-based browser router). Two exceptions get a real
  // 404 instead of the shell:
  //   - Unmatched /api/* paths — an unknown API call must fail as an API call,
  //     never resolve to an HTML page.
  //   - Static assets (path has a file extension, e.g. a missing /poses/*.png or
  //     /voice/*.mp3) — otherwise <img onError> / <audio onError> fallbacks never
  //     fire because the "missing" file silently resolves as a 200 HTML page.
  app.use("/{*path}", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/v1/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (path.extname(req.path)) {
      res.status(404).end();
      return;
    }
    sendBrandedHtml(res, indexPath);
  });
}
