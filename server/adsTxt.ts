import type { Express } from "express";
import { adsTxt, adsenseClientId } from "../shared/adsConfig";

/**
 * AdSense's seller declaration at /ads.txt. Served only when ADSENSE_CLIENT_ID
 * is a valid `ca-pub-…` id; otherwise a plain-text 404 (never the SPA shell).
 * Registered before static/Vite so it wins over the SPA fallback.
 */
export function registerAdsTxt(app: Express, env: Record<string, string | undefined> = process.env) {
  app.get("/ads.txt", (_req, res) => {
    const clientId = adsenseClientId(env);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (!clientId) return res.status(404).type("text/plain").send("Not found\n");
    res.status(200).type("text/plain").send(adsTxt(clientId));
  });
}
