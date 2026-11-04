import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { isKnownAppRoute, serveStatic } from "./static";

/** A stand-in for dist/public: the two HTML entry points the server picks between. */
function fixtureDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sadhana-dist-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><html><head><title>Sadhana</title></head><body><div id=\"root\" data-entry=\"app\"></div></body></html>");
  fs.writeFileSync(path.join(dir, "welcome.html"), "<!doctype html><html><head><title>Welcome</title></head><body><div id=\"root\" data-entry=\"welcome\"></div></body></html>");
  return dir;
}

async function harness() {
  const dist = fixtureDist();
  const app = express();
  serveStatic(app, dist);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = async (pathname: string) => {
    const res = await fetch(`${base}${pathname}`, { redirect: "manual" });
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
  };
  return { get, close: () => new Promise<void>((resolve) => server.close(() => { fs.rmSync(dist, { recursive: true, force: true }); resolve(); })) };
}

test("GET /login returns 200 with the app's HTML", async () => {
  const h = await harness();
  try {
    const res = await h.get("/login");
    assert.equal(res.status, 200);
    assert.match(res.type, /^text\/html/);
    assert.match(res.body, /data-entry="app"/, "the app shell, not the welcome page");
  } finally { await h.close(); }
});

test("client routes and aliases get the app shell with 200", async () => {
  const h = await harness();
  try {
    for (const pathname of ["/signup", "/today", "/login/", "/login?next=%2Fclasses", "/account", "/classes/steady-strength-flow", "/asanas/tadasana"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 200, pathname);
      assert.match(res.type, /^text\/html/, pathname);
      assert.match(res.body, /data-entry="app"/, pathname);
    }
  } finally { await h.close(); }
});

test("unknown pages keep the app's Not Found screen with a real 404; /api stays JSON", async () => {
  const h = await harness();
  try {
    for (const pathname of ["/no-such-page", "/login/extra", "/logins"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 404, pathname);
      assert.match(res.type, /^text\/html/, pathname);
    }
    for (const pathname of ["/api/login", "/api/nope", "/api"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 404, pathname);
      assert.match(res.type, /^application\/json/, pathname);
      assert.deepEqual(JSON.parse(res.body), { error: "Not found" }, pathname);
    }
    assert.equal((await h.get("/poses/missing.webp")).status, 404, "a missing asset is not the shell");
    assert.equal((await h.get("/poses/missing.webp")).body, "");
  } finally { await h.close(); }
});

test("isKnownAppRoute: aliases match exactly, real routes by first segment", () => {
  for (const pathname of ["/", "/login", "/signup", "/today", "/account", "/classes/x"]) assert.equal(isKnownAppRoute(pathname), true, pathname);
  for (const pathname of ["/login/extra", "/logins", "/nope"]) assert.equal(isKnownAppRoute(pathname), false, pathname);
});
