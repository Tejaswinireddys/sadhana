import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import { registerAdsTxt } from "./adsTxt";
import { adsenseCspHosts, applySecurityHeaders } from "./security";
import { publicConfig } from "./publicConfig";

async function serve(app: express.Express) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { base, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test("/ads.txt is served only with a valid ADSENSE_CLIENT_ID", async () => {
  for (const [env, status, body] of [
    [{ ADSENSE_CLIENT_ID: "ca-pub-1234567890123456" }, 200, "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n"],
    [{}, 404, "Not found\n"],
    [{ ADSENSE_CLIENT_ID: "<script>" }, 404, "Not found\n"],
  ] as const) {
    const app = express();
    registerAdsTxt(app, env);
    const s = await serve(app);
    try {
      const res = await fetch(`${s.base}/ads.txt`);
      assert.equal(res.status, status);
      assert.match(res.headers.get("content-type") ?? "", /text\/plain/);
      assert.equal(await res.text(), body);
    } finally { await s.close(); }
  }
});

test("CSP is unchanged unless AdSense is actually on", async () => {
  assert.deepEqual(adsenseCspHosts({}), { script: [], frame: [], connect: [] });
  assert.deepEqual(adsenseCspHosts({ ADS_ENABLED: "true" }), { script: [], frame: [], connect: [] }, "house ads load nothing third-party");
  const on = adsenseCspHosts({ ADS_ENABLED: "true", ADS_PROVIDER: "adsense", ADSENSE_CLIENT_ID: "ca-pub-1234567890123456" });
  assert.ok(on.script.includes("https://pagead2.googlesyndication.com"));
  assert.ok(on.frame.includes("https://googleads.g.doubleclick.net"));

  const saved = { ...process.env };
  try {
    for (const [env, expectAds] of [[{}, false], [{ ADS_ENABLED: "true", ADS_PROVIDER: "adsense", ADSENSE_CLIENT_ID: "ca-pub-1234567890123456" }, true]] as const) {
      delete process.env.ADS_ENABLED; delete process.env.ADS_PROVIDER; delete process.env.ADSENSE_CLIENT_ID;
      Object.assign(process.env, env);
      const app = express();
      app.use(applySecurityHeaders);
      app.get("/", (_req, res) => { res.send("ok"); });
      const s = await serve(app);
      try {
        const csp = (await fetch(s.base)).headers.get("content-security-policy") ?? "";
        assert.equal(csp.includes("googlesyndication"), expectAds);
        assert.equal(/frame-src/.test(csp), expectAds);
      } finally { await s.close(); }
    }
  } finally {
    for (const key of ["ADS_ENABLED", "ADS_PROVIDER", "ADSENSE_CLIENT_ID"]) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});

test("ads config reaches the client through the embedded public config", () => {
  const saved = process.env.ADS_ENABLED;
  try {
    delete process.env.ADS_ENABLED;
    assert.equal(publicConfig().ads.enabled, false);
    process.env.ADS_ENABLED = "true";
    assert.deepEqual(publicConfig().ads, { enabled: true, provider: "house", adsenseClientId: null, slots: {} });
  } finally {
    if (saved === undefined) delete process.env.ADS_ENABLED; else process.env.ADS_ENABLED = saved;
  }
});

test("the service worker never caches the ad script or ads.txt", () => {
  const sw = readFileSync(new URL("../client/public/sw.js", import.meta.url), "utf8");
  // Cross-origin requests (pagead2.googlesyndication.com) are passed through untouched.
  assert.match(sw, /if \(url\.origin !== self\.location\.origin\) return;/);
  const assetTest = /\/\\\.\(([^)]*)\)\$\//.exec(sw)?.[1] ?? "";
  assert.ok(assetTest.length > 0, "found the asset extension list");
  assert.equal(assetTest.split("|").includes("txt"), false, "ads.txt is not cached as an asset");
});
