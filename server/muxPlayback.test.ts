import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import express from "express";
import { MemoryStorage } from "./storage";
import { issueMuxPlayback, registerMuxPlaybackRoutes, signMuxPlayback, MUX_TOKEN_SECONDS } from "./muxPlayback";
import type { PoseMediaRow } from "./poseStreamStore";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
function configure(t: { after: (fn: () => void) => void }) {
  for (const [key, value] of Object.entries({ MUX_SIGNING_KEY_ID: "signing-test", MUX_SIGNING_KEY_PRIVATE: privateKey.export({ type: "pkcs8", format: "pem" }).toString() })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test("Mux tokens use RS256, playback audience and a bounded expiry with PEM or base64 keys", (t) => {
  configure(t);
  for (const encoded of [false, true]) {
    if (encoded) process.env.MUX_SIGNING_KEY_PRIVATE = Buffer.from(process.env.MUX_SIGNING_KEY_PRIVATE!).toString("base64");
    const { token, expiresAt } = signMuxPlayback("signed_playback", 1000);
    const [header, payload, signature] = token.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "RS256", typ: "JWT", kid: "signing-test" });
    assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), { sub: "signed_playback", aud: "v", kid: "signing-test", iat: 1000, exp: 1000 + MUX_TOKEN_SECONDS });
    assert.equal(expiresAt, 1900);
    assert.ok(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")));
  }
  delete process.env.MUX_SIGNING_KEY_ID;
  assert.throws(() => signMuxPlayback("signed_playback"), /not configured/);
  process.env.MUX_SIGNING_KEY_ID = "signing-test";
  process.env.MUX_SIGNING_KEY_PRIVATE = "invalid";
  assert.throws(() => signMuxPlayback("signed_playback"), /not configured/);
});

test("token routes resolve server media, reject guests/free/deleted users and recheck downgrades", async (t) => {
  configure(t);
  const store = new MemoryStorage();
  const user = await store.createUser("mux@example.com", "hash");
  const media: PoseMediaRow = { slug: "plus-pose", playbackId: "signed_playback", assetId: "asset_id", playbackPolicy: "signed", provider: "mux", updatedAt: "now" };
  let reads = 0;
  const deps = { store, catalog: [{ slug: "plus-pose", isPlus: true }, { slug: "class-plus-class", isPlus: true }, { slug: "free-pose", isPlus: false }],
    getPlayback: async (slug: string) => { reads++; return slug === "free-pose" ? { ...media, playbackPolicy: "public" as const } : media; } };
  const app = express();
  app.use((req, _res, next) => { if (req.get("x-user")) req.userId = user.id; next(); });
  registerMuxPlaybackRoutes(app, deps);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = (path: string, signedIn = true) => fetch(`${base}${path}`, { headers: signedIn ? { "x-user": "1", "x-plan": "plus" } : { "x-plan": "plus" } });
  try {
    const path = "/api/poses/plus-pose/playback-token";
    assert.equal((await get(path, false)).status, 401);
    assert.equal((await get(path)).status, 403);
    assert.equal(reads, 0);
    await store.setUserPlan(user.id, "plus");
    for (const route of [path, "/api/classes/plus-class/playback-token"]) {
      const response = await get(`${route}?playbackId=attacker`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      const data = await response.json();
      assert.equal(data.playbackId, "signed_playback");
      assert.equal(new URL(data.hls).searchParams.get("token"), data.token);
      assert.ok(data.expiresAt <= Math.floor(Date.now() / 1000) + MUX_TOKEN_SECONDS);
      assert.equal(JSON.stringify(data).includes("PRIVATE KEY"), false);
    }
    assert.equal((await get("/api/poses/free-pose/playback-token")).status, 404);
    assert.equal((await get("/api/poses/missing/playback-token")).status, 404);
    await store.setUserPlan(user.id, "free");
    assert.equal((await get(path)).status, 403);
    await store.deleteUser(user.id);
    assert.equal((await get(path)).status, 403);
    await assert.rejects(issueMuxPlayback("plus-pose", user.id, deps), /Plus membership/);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("Postgres persists asset and policy across process restarts and preserves legacy public rows", { skip: !process.env.BILLING_TEST_DATABASE_URL }, async () => {
  const { Pool } = await import("pg");
  const { randomBytes } = await import("node:crypto");
  const { readFile } = await import("node:fs/promises");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const root = new Pool({ connectionString: process.env.BILLING_TEST_DATABASE_URL });
  const schema = `mux_test_${randomBytes(8).toString("hex")}`;
  let scoped: InstanceType<typeof Pool> | undefined;
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    scoped = new Pool({ connectionString: process.env.BILLING_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    // Simulate the table before this change, then apply the boot schema twice.
    await scoped.query("CREATE TABLE pose_media (id SERIAL PRIMARY KEY, slug TEXT NOT NULL, playback_id TEXT NOT NULL, provider TEXT, updated_at TEXT NOT NULL)");
    await scoped.query("INSERT INTO pose_media (slug, playback_id, provider, updated_at) VALUES ('legacy-free','public-id','mux','now')");
    const ddl = await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8");
    await scoped.query(ddl);
    await scoped.query(ddl);
    assert.equal((await scoped.query("SELECT playback_policy FROM pose_media WHERE slug='legacy-free'")).rows[0].playback_policy, "public");
    const url = new URL(process.env.BILLING_TEST_DATABASE_URL!);
    url.searchParams.set("sslmode", "disable");
    url.searchParams.set("options", `-c search_path=${schema}`);
    const setup = `import { initStorage, pool } from './server/storage.ts'; import { upsertPosePlayback, getPosePlayback } from './server/poseStreamStore.ts'; initStorage();`;
    const run = (code: string) => promisify(execFile)(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `${setup} try { ${code} } finally { await pool.end(); }`], { env: { ...process.env, DATABASE_URL: url.toString() } });
    await run(`await upsertPosePlayback('signed-db', 'signed-db-id', 'mux', null, { assetId: 'asset-db', playbackPolicy: 'signed' });`);
    const result = await run(`console.log('ROW:' + JSON.stringify(await getPosePlayback('signed-db')));`);
    const row = JSON.parse(result.stdout.split("ROW:")[1].trim());
    assert.equal(row.assetId, "asset-db");
    assert.equal(row.playbackPolicy, "signed");
    assert.equal(row.playbackId, "signed-db-id");
  } finally {
    await scoped?.end();
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await root.end();
  }
});
