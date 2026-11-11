import "dotenv/config";
import { bootServer } from "./boot";

/**
 * Entry point. Everything lives in `bootServer` so the boot order — port
 * first, readiness second, warmups last — can be tested (`boot.test.ts`).
 *
 * Imports are evaluated before this line runs, so `process.uptime()` here is
 * what loading the server bundle cost, which no in-app timer can see.
 */
const moduleLoadMs = process.uptime() * 1000;

bootServer({ moduleLoadMs })
  // A failed critical step (the schema could not be applied) is not something
  // to limp along with: exit so the platform restarts or fails the deploy.
  .then((server) => server.ready)
  .catch((error) => {
    console.error("[startup] fatal:", error instanceof Error ? error.message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]") : "startup failed");
    process.exit(1);
  });
