import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { buildPoseMediaManifest, isSafeSlug } from "./poseMediaManifest";
import { mountStaticMedia } from "./mountStaticMedia";
import { sendJson404 } from "./json404";

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

describe("pose media manifest", () => {
  it("accepts safe slugs only", () => {
    assert.equal(isSafeSlug("tadasana"), true);
    assert.equal(isSafeSlug("../etc"), false);
    assert.equal(isSafeSlug(""), false);
  });

  it("returns audio url under /audio for known pose", async () => {
    const m = await buildPoseMediaManifest("tadasana");
    assert.ok(m.audio);
    assert.equal(m.audio!.url, "/audio/pose-tadasana.mp3");
    assert.equal(m.audio!.source, "neural");
    assert.ok(m.video === null || (m.video && (m.video.mp4 || m.video.hls)));
    if (m.video) {
      assert.ok(typeof m.video.poster === "string");
      assert.ok(m.video.provider === "local" || m.video.provider === "bunny" || m.video.provider === "mux" || m.video.provider === "cloudflare");
      if (m.video.provider === "local" && m.video.mp4) {
        assert.ok(m.video.mp4.includes("/videos/poses/tadasana.mp4"));
      }
    }
  });

  it("returns null audio for unknown pose slug", async () => {
    const m = await buildPoseMediaManifest("not-a-real-pose-xyz");
    assert.equal(m.audio, null);
    assert.equal(m.video, null);
  });
});

describe("static media + API 404 JSON", () => {
  it("missing /audio file returns JSON 404", async () => {
    await withServer(
      (app) => {
        mountStaticMedia(app);
        app.use("/api", (_req, res) => {
          sendJson404(res, "Not found");
        });
      },
      async (base) => {
        const audio = await fetch(`${base}/audio/pose-does-not-exist-xyz.mp3`);
        assert.equal(audio.status, 404);
        assert.match(audio.headers.get("content-type") || "", /json/i);
        const audioBody = (await audio.json()) as { error: string };
        assert.equal(audioBody.error, "Audio not found");

        const api = await fetch(`${base}/api/no-such-route`);
        assert.equal(api.status, 404);
        assert.match(api.headers.get("content-type") || "", /json/i);
        const apiBody = (await api.json()) as { error: string };
        assert.equal(apiBody.error, "Not found");
      },
    );
  });

  it("serves real pose audio when present", async () => {
    await withServer(
      (app) => {
        mountStaticMedia(app);
      },
      async (base) => {
        const res = await fetch(`${base}/audio/pose-tadasana.mp3`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get("content-type") || "", /audio|mpeg|octet/i);
      },
    );
  });

  it("missing timing JSON under /audio returns JSON 404", async () => {
    await withServer(
      (app) => {
        mountStaticMedia(app);
      },
      async (base) => {
        const res = await fetch(`${base}/audio/timings/no-such-pose.timing.json`);
        assert.equal(res.status, 404);
        assert.match(res.headers.get("content-type") || "", /json/i);
      },
    );
  });
});
