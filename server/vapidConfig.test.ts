import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import express from "express";
import webpush from "web-push";
import {
  resolveVapidConfig,
  vapidKeyInstructions,
  vapidKeyProblems,
  vapidStartupMessage,
  type VapidConfig,
} from "./vapidConfig";
import { registerPushRoutes } from "./push";

const pair = webpush.generateVAPIDKeys();
const neverGenerate = () => {
  throw new Error("a temporary key pair was generated");
};

describe("resolveVapidConfig", () => {
  it("uses the configured pair, in production and out of it", () => {
    for (const NODE_ENV of ["production", "development"]) {
      const config = resolveVapidConfig(
        { NODE_ENV, VAPID_PUBLIC_KEY: ` ${pair.publicKey} `, VAPID_PRIVATE_KEY: pair.privateKey, VAPID_SUBJECT: "mailto:ops@example.com" },
        neverGenerate,
      );
      assert.deepEqual(config, { enabled: true, source: "env", ...pair, subject: "mailto:ops@example.com" });
    }
  });

  it("refuses to generate temporary keys in production: push is disabled, with the fix in the reason", () => {
    const config = resolveVapidConfig({ NODE_ENV: "production" }, neverGenerate);
    assert.equal(config.enabled, false);
    assert.match(vapidStartupMessage(config), /^\[push\] Web Push is DISABLED: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set/);
    assert.match(vapidStartupMessage(config), /npm run gen:vapid-keys/);
  });

  it("is disabled in production when only one key is set, naming the missing one", () => {
    const config = resolveVapidConfig({ NODE_ENV: "production", VAPID_PUBLIC_KEY: pair.publicKey }, neverGenerate);
    assert.equal(config.enabled, false);
    assert.match(vapidStartupMessage(config), /VAPID_PRIVATE_KEY is not set/);
    assert.doesNotMatch(vapidStartupMessage(config), /VAPID_PUBLIC_KEY (is|are) not set/);
  });

  it("still gives local development a temporary pair when nothing is set", () => {
    let generated = 0;
    const config = resolveVapidConfig({ NODE_ENV: "development" }, () => { generated++; return pair; });
    assert.equal(generated, 1);
    assert.equal(config.enabled && config.source, "ephemeral");
    assert.match(vapidStartupMessage(config), /temporary development VAPID keys/);
  });

  it("does not paper over half a pair or a malformed key with temporary keys", () => {
    assert.equal(resolveVapidConfig({ NODE_ENV: "development", VAPID_PRIVATE_KEY: pair.privateKey }, neverGenerate).enabled, false);
    const swapped = resolveVapidConfig({ NODE_ENV: "production", VAPID_PUBLIC_KEY: pair.privateKey, VAPID_PRIVATE_KEY: pair.publicKey }, neverGenerate);
    assert.equal(swapped.enabled, false);
    assert.match(vapidStartupMessage(swapped), /VAPID_PUBLIC_KEY is not a valid VAPID public key; VAPID_PRIVATE_KEY is not a valid VAPID private key/);
    const subject = resolveVapidConfig({ ...{ VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: pair.privateKey }, VAPID_SUBJECT: "ops@example.com" }, neverGenerate);
    assert.match(vapidStartupMessage(subject), /VAPID_SUBJECT must be a mailto: address or an https:\/\/ URL/);
  });

  it("never puts a key in the startup message", () => {
    const messages = [
      vapidStartupMessage(resolveVapidConfig({ NODE_ENV: "production", VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: pair.privateKey })),
      vapidStartupMessage(resolveVapidConfig({ NODE_ENV: "production", VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: "not-a-key" })),
      vapidStartupMessage(resolveVapidConfig({ NODE_ENV: "development" }, () => pair)),
    ].join("\n");
    assert.ok(!messages.includes(pair.privateKey) && !messages.includes(pair.publicKey) && !messages.includes("not-a-key"));
  });
});

describe("gen:vapid-keys", () => {
  it("prints exactly the two variables to set, with a pair the server accepts", () => {
    const text = vapidKeyInstructions(pair);
    assert.ok(text.split("\n").includes(`VAPID_PUBLIC_KEY=${pair.publicKey}`));
    assert.ok(text.split("\n").includes(`VAPID_PRIVATE_KEY=${pair.privateKey}`));
    assert.match(text, /Nothing was written to disk/);
    assert.deepEqual(vapidKeyProblems(pair), []);
  });

  it("the script prints a fresh, valid pair and leaves the working tree untouched", () => {
    const status = () => spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout;
    const before = status();
    const run = spawnSync(process.execPath, ["--import", "tsx", "script/gen-vapid-keys.ts"], { encoding: "utf8", timeout: 60_000 });
    assert.equal(run.status, 0, run.stderr);
    const publicKey = /^VAPID_PUBLIC_KEY=(\S+)$/m.exec(run.stdout)?.[1] ?? "";
    const privateKey = /^VAPID_PRIVATE_KEY=(\S+)$/m.exec(run.stdout)?.[1] ?? "";
    assert.deepEqual(vapidKeyProblems({ publicKey, privateKey }), []);
    assert.equal(resolveVapidConfig({ NODE_ENV: "production", VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }).enabled, true);
    assert.equal(status(), before, "no file was created or changed");
  });
});

describe("push routes on a server with no keys", () => {
  async function harness(config: VapidConfig) {
    const app = express();
    app.use(express.json());
    registerPushRoutes(app, config);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, body: await res.json() };
    };
    return { call, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
  }
  const subscription = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };

  it("says push is off and refuses to store a subscription it could never deliver to", async () => {
    const h = await harness(resolveVapidConfig({ NODE_ENV: "production" }, neverGenerate));
    try {
      assert.deepEqual(await h.call("GET", "/api/push/vapid-public-key"), { status: 200, body: { enabled: false, publicKey: "" } });
      const subscribe = await h.call("POST", "/api/push/subscribe", subscription);
      assert.equal(subscribe.status, 503);
      assert.match(subscribe.body.error, /not configured/);
      assert.equal((await h.call("POST", "/api/push/test", subscription)).status, 503);
      // Turning reminders off must always work.
      assert.deepEqual(await h.call("POST", "/api/push/unsubscribe", { endpoint: "https://push.example/never-stored" }), { status: 200, body: { ok: true } });
    } finally { await h.close(); }
  });

  it("hands out the configured public key when keys are set", async () => {
    const h = await harness({ enabled: true, source: "env", ...pair, subject: "mailto:ops@example.com" });
    try {
      assert.deepEqual(await h.call("GET", "/api/push/vapid-public-key"), { status: 200, body: { enabled: true, publicKey: pair.publicKey } });
    } finally { await h.close(); }
  });
});
