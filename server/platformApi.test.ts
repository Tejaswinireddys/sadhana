import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerPlatformApi } from "./platformApi";

function listen(app: express.Express): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        port,
        close: () =>
          new Promise((r, j) => server.close((err) => (err ? j(err) : r()))),
      });
    });
  });
}

describe("platform API v1", () => {
  it("lists poses and rejects personal health fields on session-plan", async () => {
    const app = express();
    app.use(express.json());
    registerPlatformApi(app);
    const { port, close } = await listen(app);
    try {
      const poses = await fetch(`http://127.0.0.1:${port}/api/v1/poses?limit=5`);
      assert.equal(poses.status, 200);
      const body = (await poses.json()) as { poses: unknown[] };
      assert.ok(body.poses.length > 0);

      const bad = await fetch(`http://127.0.0.1:${port}/api/v1/session-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 10, journal: "secret" }),
      });
      assert.equal(bad.status, 400);

      const ok = await fetch(`http://127.0.0.1:${port}/api/v1/session-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 10, need: "calm" }),
      });
      assert.equal(ok.status, 200);
      const plan = (await ok.json()) as { poses: unknown[] };
      assert.ok(plan.poses.length > 0);
    } finally {
      await close();
    }
  });
});
