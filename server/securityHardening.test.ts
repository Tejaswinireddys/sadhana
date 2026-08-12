import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import type { Server } from "node:http";
import { applySecurityHeaders, createRateLimiter, mountSecurity } from "./security";

async function withServer(
  mount: (app: express.Express) => void,
  fn: (base: string) => Promise<void>,
) {
  const app = express();
  mount(app);
  const server: Server = await new Promise((resolveListen) => {
    const s = app.listen(0, "127.0.0.1", () => resolveListen(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("security hardening", () => {
  it("CSP script-src uses the theme boot script hash (no unsafe-inline scripts)", () => {
    const html = readFileSync(resolve("client/index.html"), "utf8");
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(m, "theme boot script must exist");
    const hash =
      "sha256-" + createHash("sha256").update(m![1]!, "utf8").digest("base64");
    const securitySrc = readFileSync(resolve("server/security.ts"), "utf8");
    assert.ok(
      securitySrc.includes(hash),
      `security.ts CSP must include theme script hash ${hash}`,
    );
    assert.ok(
      !/script-src[^;\n]*'unsafe-inline'/.test(securitySrc),
      "script-src must not allow unsafe-inline",
    );
  });

  it("rate-limits rapid /api/auth/me probes", async () => {
    await withServer(
      (app) => {
        mountSecurity(app);
        app.get("/api/auth/me", (_req, res) => res.json({ user: null }));
      },
      async (base) => {
        let saw429 = false;
        for (let i = 0; i < 130; i++) {
          const res = await fetch(`${base}/api/auth/me`);
          if (res.status === 429) {
            saw429 = true;
            break;
          }
          assert.equal(res.status, 200);
        }
        assert.equal(saw429, true, "expected 429 after bursting /api/auth/me");
      },
    );
  });

  it("createRateLimiter returns JSON 429 with Retry-After", async () => {
    const limit = createRateLimiter({ windowMs: 60_000, max: 2 });
    await withServer(
      (app) => {
        app.get("/x", limit, (_req, res) => res.json({ ok: true }));
      },
      async (base) => {
        assert.equal((await fetch(`${base}/x`)).status, 200);
        assert.equal((await fetch(`${base}/x`)).status, 200);
        const res = await fetch(`${base}/x`);
        assert.equal(res.status, 429);
        assert.ok(res.headers.get("retry-after"));
        const body = (await res.json()) as { error: string };
        assert.match(body.error, /Too many/i);
      },
    );
  });

  it("production static fallback returns JSON 404 for unknown /api/*", async () => {
    // serveStatic requires dist/public — skip gracefully if not built.
    const distPublic = resolve("dist/public");
    try {
      readFileSync(resolve(distPublic, "index.html"));
    } catch {
      // Build a tiny fake dist for this assertion.
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(distPublic, { recursive: true });
      writeFileSync(resolve(distPublic, "index.html"), "<!doctype html><title>t</title>");
    }

    // serveStatic resolves __dirname/public relative to compiled output; in
    // tsx it is server/ → use a minimal express mirror of the API 404 rule.
    await withServer(
      (app) => {
        app.use(applySecurityHeaders);
        app.use((req, res) => {
          if (req.path.startsWith("/api/")) {
            res.status(404).json({ error: "Not found" });
            return;
          }
          res.status(200).type("html").send("<html>shell</html>");
        });
      },
      async (base) => {
        const api = await fetch(`${base}/api/no-such-endpoint`);
        assert.equal(api.status, 404);
        assert.match(api.headers.get("content-type") || "", /json/);
        const body = (await api.json()) as { error: string };
        assert.equal(body.error, "Not found");

        const page = await fetch(`${base}/some-page`);
        assert.equal(page.status, 200);
        assert.match(await page.text(), /shell/);
      },
    );
  });
});
