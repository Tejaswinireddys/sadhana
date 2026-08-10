import "dotenv/config";
import express, { Response, NextFunction } from "express";
import type { Request } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initStorage, pool, storage } from "./storage";
import { mountSecurity, redactForLog } from "./security";
import { registerPlatformApi } from "./platformApi";
import { registerPushRoutes, startPushScheduler } from "./push";
import { registerBillingRoutes, migrateBillingEntitlements } from "./billing";
import { registerBuddyRoutes } from "./buddy";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

mountSecurity(app);

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "64kb" }));

// Health probe for Render / uptime monitors. Returns 200 only when the backing
// store is actually reachable — a DB `SELECT 1` in production (in-memory mode is
// always reachable). A DB outage now fails the health check instead of serving
// a green light over a broken database.
app.get("/healthz", async (_req, res) => {
  try {
    if (!storage || !(await storage.ping())) {
      return res.status(503).json({ ok: false, error: "database unreachable" });
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: "database unreachable" });
  }
});

const PUBLIC_ORIGIN =
  process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || "https://sadhana-ou9m.onrender.com";

/** Real XML sitemap (not the SPA shell) for marketing / SEO crawlers. */
app.get("/sitemap.xml", (_req, res) => {
  const paths = ["/", "/welcome", "/register", "/privacy", "/terms", "/health-disclaimer"];
  const urls = paths
    .map(
      (p) =>
        `  <url><loc>${PUBLIC_ORIGIN}${p}</loc><changefreq>weekly</changefreq></url>`,
    )
    .join("\n");
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(redactForLog(capturedJsonResponse))}`;
      }

      log(logLine);
    }
  });

  next();
});

// Auto-migration: create tables if they don't exist by running drizzle/schema.sql.
// Idempotent (CREATE TABLE IF NOT EXISTS), so it is safe to run on every boot.
async function ensureSchema() {
  if (!pool) return;
  const schemaPath = resolve(process.cwd(), "drizzle", "schema.sql");
  const sql = await readFile(schemaPath, "utf-8");
  await pool.query(sql);
  log("schema ensured");
}

(async () => {
  const { usingMemory } = initStorage();
  if (usingMemory) {
    log("DATABASE_URL unset — using in-memory store (data resets on restart)");
  } else {
    await ensureSchema();
  }
  // One-time JSON→Postgres entitlement import (idempotent; no-op when empty).
  await migrateBillingEntitlements();

  await registerRoutes(httpServer, app);
  registerPlatformApi(app);
  registerPushRoutes(app);
  registerBillingRoutes(app);
  registerBuddyRoutes(app);
  startPushScheduler();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      // reusePort isn't supported on macOS (ENOTSUP); harmless to skip locally.
      reusePort: process.platform !== "darwin",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
