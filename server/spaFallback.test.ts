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
  fs.copyFileSync(path.resolve(import.meta.dirname, "../client/public/favicon.ico"), path.join(dir, "favicon.ico"));
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
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: bytes.toString("utf8"), bytes };
  };
  const head = async (pathname: string) => {
    const res = await fetch(`${base}${pathname}`, { method: "HEAD", redirect: "manual" });
    return { status: res.status, type: res.headers.get("content-type") ?? "" };
  };
  return { get, head, close: () => new Promise<void>((resolve) => server.close(() => { fs.rmSync(dist, { recursive: true, force: true }); resolve(); })) };
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

test("GET /signin and /sign-in return 200 with the app's HTML", async () => {
  const h = await harness();
  try {
    for (const pathname of ["/signin", "/sign-in", "/signin/", "/sign-in?next=%2Fclasses"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 200, pathname);
      assert.match(res.type, /^text\/html/, pathname);
      assert.match(res.body, /data-entry="app"/, pathname);
    }
    for (const pathname of ["/signin/extra", "/sign-in/extra", "/sign_in"]) assert.equal((await h.get(pathname)).status, 404, pathname);
    const api = await h.get("/api/signin");
    assert.equal(api.status, 404);
    assert.match(api.type, /^application\/json/);
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

/** Routes a QA refresh / cold deep-link walk hits — shell must stay 200 HTML. */
const DEEP_LINK_SHELL_PATHS = [
  "/privacy",
  "/plus",
  "/start",
  "/terms",
  "/cancel",
  "/asanas",
  "/classes",
  "/journal",
  "/settings",
];

test("QA deep-link paths get the app shell with 200 (GET and HEAD)", async () => {
  const h = await harness();
  try {
    for (const pathname of DEEP_LINK_SHELL_PATHS) {
      const res = await h.get(pathname);
      assert.equal(res.status, 200, pathname);
      assert.match(res.type, /^text\/html/, pathname);
      assert.match(res.body, /data-entry="app"/, pathname);
      const head = await h.head(pathname);
      assert.equal(head.status, 200, `HEAD ${pathname}`);
      assert.match(head.type, /^text\/html/, `HEAD ${pathname}`);
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
  for (const pathname of ["/", "/login", "/signin", "/sign-in", "/signup", "/today", "/account", "/classes/x"]) assert.equal(isKnownAppRoute(pathname), true, pathname);
  for (const pathname of ["/login/extra", "/logins", "/nope"]) assert.equal(isKnownAppRoute(pathname), false, pathname);
});

test("/support is an exact alias of /help: app shell with 200; look-alikes stay 404", async () => {
  const h = await harness();
  try {
    for (const pathname of ["/support", "/support/", "/SUPPORT", "/support?ref=email"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 200, pathname);
      assert.match(res.type, /^text\/html/, pathname);
      assert.match(res.body, /data-entry="app"/, pathname);
    }
    for (const pathname of ["/support/extra", "/supports"]) {
      const res = await h.get(pathname);
      assert.equal(res.status, 404, pathname);
      assert.match(res.type, /^text\/html/, `${pathname} keeps the app's Not Found screen`);
    }
    const api = await h.get("/api/support");
    assert.equal(api.status, 404);
    assert.match(api.type, /^application\/json/);
    assert.deepEqual(JSON.parse(api.body), { error: "Not found" });
  } finally { await h.close(); }
});

/** The images inside an ICO file: [width, height, bytes, isPng] per entry. */
function icoEntries(ico: Buffer) {
  assert.equal(ico.readUInt16LE(0), 0, "reserved");
  assert.equal(ico.readUInt16LE(2), 1, "type 1 = icon");
  return Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const at = 6 + 16 * i;
    const size = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    const data = ico.subarray(offset, offset + size);
    return { width: ico[at] || 256, height: ico[at + 1] || 256, size, inBounds: offset + size <= ico.length,
      isPng: data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) };
  });
}

test("favicon.ico is a real icon file with 16, 32 and 48 px images", () => {
  const ico = fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/favicon.ico"));
  const entries = icoEntries(ico);
  assert.deepEqual(entries.map((e) => [e.width, e.height]), [[16, 16], [32, 32], [48, 48]]);
  for (const e of entries) {
    assert.ok(e.inBounds, "image data lies inside the file");
    assert.ok(e.isPng, "each image is PNG data");
    assert.ok(e.size > 100, "not an empty placeholder");
  }
});

test("GET /favicon.ico serves the icon itself, not the app shell", async () => {
  const h = await harness();
  try {
    const res = await h.get("/favicon.ico");
    assert.equal(res.status, 200);
    assert.match(res.type, /^image\/(x-icon|vnd\.microsoft\.icon)/);
    assert.ok(res.bytes.equals(fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/favicon.ico"))));
  } finally { await h.close(); }
});

test("both HTML entry points link the .ico beside the SVG icon", () => {
  for (const file of ["index.html", "welcome.html"]) {
    const html = fs.readFileSync(path.resolve(import.meta.dirname, `../client/${file}`), "utf8");
    assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="16x16 32x32 48x48" \/>/, file);
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/, file);
  }
});
