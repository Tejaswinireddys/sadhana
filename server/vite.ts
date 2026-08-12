import type { Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import type { Server } from "node:http";
import viteConfig from "../vite.config";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { brandPublicHtml, publicAppOrigin, robotsTxt } from "./publicUrl";
import { sendJson404 } from "./json404";
import { mountStaticMedia } from "./mountStaticMedia";

const viteLogger = createLogger();

function requestPathname(req: { originalUrl?: string; url?: string; path?: string }): string {
  const raw = req.originalUrl || req.url || req.path || "";
  return raw.split("?")[0] || "";
}

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

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.get("/robots.txt", (_req, res) => {
    res.status(200).type("text/plain").send(robotsTxt(publicAppOrigin()));
  });

  // Serve /audio before Vite so missing narrations are JSON 404, not HTML.
  mountStaticMedia(app);

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;
    const pathname = requestPathname(req);

    if (isNonSpaPrefix(pathname)) {
      sendJson404(res);
      return;
    }

    if (path.extname(pathname)) {
      res.status(404).end();
      return;
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = brandPublicHtml(template);
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
