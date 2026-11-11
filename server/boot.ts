import { publicSitemapPaths } from "./pageMetadata";
import express, { Response, NextFunction } from "express";
import type { Request } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initStorage, pool, storage } from "./storage";
import { publishedClassPaths, sitemapXml } from "./classPages";
import { mountSecurity, redactForLog } from "./security";
import { registerPlatformApi } from "./platformApi";
import { registerPushRoutes, startPushScheduler } from "./push";
import {
  registerBillingRoutes,
  startBillingScheduler,
} from "./billing";
import { registerBuddyRoutes } from "./buddy";
import { registerTeachersWaitlistRoutes } from "./teachersWaitlist";
import { registerPlusWaitlistRoutes } from "./plusWaitlist";
import { registerClassRoutes } from "./classLibrary";
import { seedPlaceholderClasses, signedClassWarnings } from "./classSeed";
import { muxSigningConfigured } from "./muxPlayback";
import { registerAdsTxt } from "./adsTxt";
import { publicAppOrigin } from "./publicUrl";
import { captureServerException, initServerSentry } from "./sentry";
import { sendJson404 } from "./json404";
import { stripeStartupErrors, stripeStartupMessage } from "./stripeConfig";
import { createStartupTracker, type StartupTracker } from "./startup";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export type BootOptions = {
  /** Defaults to `PORT`, then 5000. Tests pass 0 for an ephemeral port. */
  port?: number;
  host?: string;
  /** Replaces the Vite (dev) / static (prod) mount. Tests pass a no-op. */
  mountFrontend?: (app: express.Express, httpServer: Server) => void | Promise<void>;
  /**
   * Replaces the optional warmups that run after the port is bound. Nothing in
   * this list may be needed to serve a request — see `defaultWarmups`.
   */
  warmups?: Warmup[];
  /** Replaces the steps `/healthz` waits for — see `defaultCriticalSteps`. */
  criticalSteps?: Warmup[];
  /** Reminder / renewal timers. Tests turn them off so the process can exit. */
  schedulers?: boolean;
  /** `process.uptime()` in ms when the entry file began: the cost of loading the bundle. */
  moduleLoadMs?: number;
};

export type Warmup = { name: string; run: () => unknown | Promise<unknown> };

export type BootedServer = {
  httpServer: Server;
  port: number;
  startup: StartupTracker;
  /** Resolves once every critical step is done and `/healthz` can pass; rejects if one fails. */
  ready: Promise<void>;
  close(): Promise<void>;
};

/**
 * What must succeed before a request can be served correctly. `/healthz` stays
 * 503 until these finish, and a failure here fails the deploy.
 */
function defaultCriticalSteps(usingMemory: boolean): Warmup[] {
  if (!usingMemory) {
    // New code may read columns only this run adds.
    return [{ name: "ensure schema", run: ensureSchema }];
  }
  // The in-memory store starts empty; give local dev and E2E a class library.
  // Postgres deployments seed explicitly with `npm run seed:classes`. It stays
  // ahead of readiness because it is instant and E2E starts the moment
  // /healthz passes.
  if (process.env.NODE_ENV === "production") return [];
  return [{
    name: "seed in-memory classes",
    run: async () => log(`seeded ${await seedPlaceholderClasses(storage)} placeholder classes (in-memory)`),
  }];
}

/**
 * Optional work that used to run before `listen()`. None of it decides whether
 * a request can be served, so it runs once the server is ready:
 * - the opt-in placeholder class seed (an idempotent upsert by slug), and
 * - the signed-class warnings, which read every class row only to log advice.
 */
function defaultWarmups(usingMemory: boolean): Warmup[] {
  if (usingMemory) return [];
  if (process.env.SEED_PLACEHOLDER_CLASSES === "true") {
    return [{
      name: "seed placeholder classes",
      run: async () => log(`seeded ${await seedPlaceholderClasses(storage)} placeholder classes (postgres)`),
    }];
  }
  return [{
    name: "signed class warnings",
    run: async () => {
      // Say why a signed class will not play, rather than leaving it a mystery.
      for (const message of signedClassWarnings(await storage.listClasses(), muxSigningConfigured())) {
        console.warn(`[classes] ${message}`);
      }
    },
  }];
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Auto-migration: create tables if they don't exist by running drizzle/schema.sql.
// Idempotent (CREATE TABLE IF NOT EXISTS), so it is safe to run on every boot.
async function ensureSchema() {
  if (!pool) return;
  const schemaPath = resolve(process.cwd(), "drizzle", "schema.sql");
  const sql = await readFile(schemaPath, "utf-8");
  await pool.query(sql);
}

/**
 * Boot order — bind the port first, then earn readiness:
 *
 * 1. Synchronous setup only: config check, storage handle, middleware, routes.
 * 2. `listen()`. From here `/healthz` answers (503 "starting") and the deploy
 *    log shows how far startup got, instead of a silent port-scan timeout.
 * 3. Critical steps (schema). `/healthz` turns 200 only after these succeed,
 *    and keeps failing if the database is unreachable or a step throws.
 * 4. Optional warmups in the background. They never delay readiness.
 */
export async function bootServer(options: BootOptions = {}): Promise<BootedServer> {
  const startup = createStartupTracker({ log: (message) => log(message, "startup") });

  // Before anything listens: a live deployment with a missing or test-mode
  // value would otherwise boot with billing silently off, or worse.
  const stripeErrors = stripeStartupErrors();
  if (stripeErrors.length) {
    console.error(stripeStartupMessage(stripeErrors));
    process.exit(1);
  }

  // Only builds the pool object — no connection is opened until the first query.
  const { usingMemory } = initStorage();
  if (usingMemory) log("DATABASE_URL unset — using in-memory store (data resets on restart)");

  const app = express();
  const httpServer = createServer(app);

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

  // Health probe for Render / uptime monitors. Returns 200 only when startup's
  // critical steps have finished *and* the backing store is actually reachable —
  // a DB `SELECT 1` in production (in-memory mode is always reachable). The port
  // is bound before the schema is applied, so "starting" must not read as
  // healthy; and a DB outage fails the check instead of serving a green light
  // over a broken database.
  app.get("/healthz", async (_req, res) => {
    const state = startup.state();
    if (state !== "ready") {
      return res.status(503).json({ ok: false, error: state === "failed" ? "startup failed" : "starting" });
    }
    try {
      if (!storage || !(await storage.ping())) {
        return res.status(503).json({ ok: false, error: "database unreachable" });
      }
      res.status(200).json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: "database unreachable" });
    }
  });

  // Liveness probe for uptime monitors: 200 the instant the port is bound, no
  // database round-trip, and still 200 while critical startup steps run. A
  // monitor on /ping won't page for a DB outage that /healthz correctly
  // reports. /healthz stays the readiness check Render routes on.
  app.get("/ping", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  registerAdsTxt(app);

  const PUBLIC_ORIGIN = publicAppOrigin();

  /**
   * Real XML sitemap (not the SPA shell) for marketing / SEO crawlers: the static
   * public pages plus every published class. Drafts and deleted classes are
   * left out; only slugs are read, never playback ids. If the class catalogue
   * cannot be read, the static pages are still served rather than a 500.
   */
  app.get("/sitemap.xml", async (_req, res) => {
    let classPaths: string[] = [];
    try {
      classPaths = await publishedClassPaths(storage);
    } catch (error) {
      console.warn("[sitemap] class catalogue unavailable:", error instanceof Error ? error.message : error);
    }
    res.type("application/xml").send(sitemapXml(PUBLIC_ORIGIN, [...publicSitemapPaths(), ...classPaths]));
  });

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

  // The port is open before the schema is applied. Render does not route to an
  // instance that fails /healthz, but anything that reaches the API in that
  // window gets an honest "not yet" rather than a query against a missing table.
  app.use("/api", (_req, res, next) => {
    if (startup.state() === "ready") return next();
    res.setHeader("Retry-After", "5");
    res.status(503).json({ error: "Server is starting" });
  });

  await registerRoutes(httpServer, app);
  registerPlatformApi(app);
  registerPushRoutes(app);
  registerBillingRoutes(app);
  registerBuddyRoutes(app);
  registerTeachersWaitlistRoutes(app);
  registerPlusWaitlistRoutes(app);
  registerClassRoutes(app);

  // After every API mount: unknown /api/* must be JSON 404, never the SPA shell.
  // Registered here (before Vite/static) so HTML fallbacks cannot win.
  app.use("/api", (_req, res) => {
    sendJson404(res, "Not found");
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);
    if (status >= 500) {
      void captureServerException(err, { path: req.originalUrl });
      void import("./errorReporting")
        .then(({ reportError }) =>
          reportError({
            message,
            stack: err?.stack,
            source: "server",
            path: req.originalUrl,
          }),
        )
        .catch(() => undefined);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  await startup.step("mount frontend", async () => {
    if (options.mountFrontend) {
      await options.mountFrontend(app, httpServer);
    } else if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const requestedPort = options.port ?? parseInt(process.env.PORT || "5000", 10);
  await new Promise<void>((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(
      {
        port: requestedPort,
        host: options.host ?? "0.0.0.0",
        // reusePort isn't supported on macOS (ENOTSUP); harmless to skip locally.
        reusePort: process.platform !== "darwin",
      },
      () => {
        httpServer.off("error", rejectListen);
        resolveListen();
      },
    );
  });
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  log(`serving on port ${port}`);
  const loadNote = options.moduleLoadMs === undefined ? "" : ` (+${Math.round(options.moduleLoadMs)}ms loading the server bundle)`;
  log(`listening after ${startup.elapsedMs()}ms${loadNote}; /healthz answers 503 until ready`, "startup");

  // Optional from the first moment: error reporting must never hold up serving.
  // Loading the SDK is the slow part, which is why it is not awaited.
  startup.background("sentry", initServerSentry);

  const ready = (async () => {
    try {
      for (const critical of options.criticalSteps ?? defaultCriticalSteps(usingMemory)) {
        await startup.step(critical.name, critical.run);
      }
      startup.markReady();
      log(`ready after ${startup.elapsedMs()}ms`, "startup");
    } catch (error) {
      startup.markFailed(error);
      throw error;
    }

    for (const warmup of options.warmups ?? defaultWarmups(usingMemory)) {
      startup.background(warmup.name, warmup.run);
    }
    if (options.schedulers !== false) {
      startPushScheduler();
      startBillingScheduler();
    }
  })();
  // The caller decides what a failed startup means (index.ts exits); this only
  // stops an unobserved rejection from doing it first.
  ready.catch(() => undefined);

  return {
    httpServer,
    port,
    startup,
    ready,
    close: () =>
      new Promise<void>((resolveClose) => {
        httpServer.close(() => resolveClose());
        httpServer.closeAllConnections();
      }),
  };
}
