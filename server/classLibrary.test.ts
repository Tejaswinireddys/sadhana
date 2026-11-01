import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import express from "express";
import { MemoryStorage } from "./storage";
import { registerClassRoutes } from "./classLibrary";
import {
  MUX_PUBLIC_TEST_PLAYBACK_ID,
  PLACEHOLDER_CLASSES,
  isClaimedPlaceholder,
  seedPlaceholderClasses,
  signedClassWarnings,
} from "./classSeed";
import { CLASS_TOKEN_SECONDS } from "@shared/classLibrary";

// A throwaway signing key, so the real signer (not a stub) mints the tokens.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SIGNING_ENV = {
  MUX_SIGNING_KEY_ID: "test-kid",
  MUX_SIGNING_KEY_PRIVATE: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" }) as string).toString("base64"),
};
function withSigning(enabled: boolean) {
  for (const [key, value] of Object.entries(SIGNING_ENV)) {
    if (enabled) process.env[key] = value; else delete process.env[key];
  }
}
const quietWarn = () => undefined;

/** The ids `class:add` would attach: one signed id per Plus class. */
const SIGNED_IDS: Record<string, string> = Object.fromEntries(
  PLACEHOLDER_CLASSES.filter((row) => row.tier === "plus").map((row, i) => [row.slug, `signedPlusId0${i}abcdefghijklmnop`]),
);

function decodeJwt(token: string) {
  const [header, payload, signature] = token.split(".");
  const valid = verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"));
  return { header: JSON.parse(Buffer.from(header, "base64url").toString()), payload: JSON.parse(Buffer.from(payload, "base64url").toString()), valid };
}

type Summary = { slug: string; tier: string; locked: boolean; playback: { playbackId: string } | null; thumbnailUrl: string | null; progress: { secondsWatched: number; completed: boolean } | null };

async function harness({ signing = true, attachSigned = true } = {}) {
  withSigning(signing);
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store, Date.now(), quietWarn);
  if (attachSigned) {
    for (const row of PLACEHOLDER_CLASSES.filter((r) => r.tier === "plus")) {
      await store.upsertClassBySlug({ ...row, muxPlaybackId: SIGNED_IDS[row.slug], createdAt: new Date().toISOString() });
    }
  }
  const free = await store.createUser("free@example.com", "hash");
  const plus = await store.createUser("plus@example.com", "hash");
  await store.setUserPlan(plus.id, "plus");
  const app = express();
  app.use(express.json());
  // Stand-in for ownerMiddleware: x-as picks the viewer, x-owner a guest device.
  app.use((req, _res, next) => {
    const as = req.get("x-as");
    req.userId = as === "plus" ? plus.id : as === "free" ? free.id : undefined;
    req.ownerId = req.userId ? `user:${req.userId}` : req.get("x-owner") || "device-guest";
    next();
  });
  registerClassRoutes(app, { store });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = async (path: string, as?: string, owner?: string) => {
    const res = await fetch(`${base}${path}`, { headers: { ...(as ? { "x-as": as } : {}), ...(owner ? { "x-owner": owner } : {}) } });
    return { status: res.status, text: await res.clone().text(), body: await res.json(), cache: res.headers.get("cache-control") };
  };
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { store, get, post, close: () => new Promise<void>((resolve) => { withSigning(false); server.close(() => resolve()); }) };
}

const plusSlugs = PLACEHOLDER_CLASSES.filter((row) => row.tier === "plus").map((row) => row.slug);
const freeSlugs = PLACEHOLDER_CLASSES.filter((row) => row.tier === "free").map((row) => row.slug);

test("seed: six placeholders; free ones public, Plus ones signed with no public id", async () => {
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store, Date.now(), quietWarn);
  await seedPlaceholderClasses(store, Date.now(), quietWarn);
  const rows = await store.listClasses();
  assert.equal(rows.length, 6);
  const free = rows.filter((row) => row.tier === "free");
  const plus = rows.filter((row) => row.tier === "plus");
  assert.equal(free.length, 3);
  assert.ok(free.every((row) => row.published && row.playbackPolicy === "public" && row.muxPlaybackId === MUX_PUBLIC_TEST_PLAYBACK_ID));
  assert.ok(plus.every((row) => row.published && row.playbackPolicy === "signed" && row.muxPlaybackId === null),
    "Mux rejects tokens on a public id, so Plus placeholders carry none");
  assert.ok(rows.every((row) => !row.muxPlaybackId || !row.thumbnailUrl?.includes(row.muxPlaybackId)), "thumbnails never embed a playback id");
});

test("seed: a placeholder upgraded by class:add is not overwritten, and a pre-policy public Plus row is", async () => {
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store, Date.now(), quietWarn);
  const [first, second] = PLACEHOLDER_CLASSES.filter((row) => row.tier === "plus");
  await store.upsertClassBySlug({ ...first, title: "Real filmed class", muxPlaybackId: "realSignedId", createdAt: "x" });
  // What a live database held before this change: Plus on the public test id.
  await store.upsertClassBySlug({ ...second, muxPlaybackId: MUX_PUBLIC_TEST_PLAYBACK_ID, playbackPolicy: "public", createdAt: "x" });
  assert.equal(isClaimedPlaceholder(await store.getClassBySlug(first.slug)), true);
  assert.equal(isClaimedPlaceholder(await store.getClassBySlug(second.slug)), false);
  await seedPlaceholderClasses(store, Date.now(), quietWarn);
  assert.equal((await store.getClassBySlug(first.slug))?.title, "Real filmed class");
  assert.equal((await store.getClassBySlug(first.slug))?.muxPlaybackId, "realSignedId");
  const migrated = await store.getClassBySlug(second.slug);
  assert.equal(migrated?.playbackPolicy, "signed");
  assert.equal(migrated?.muxPlaybackId, null);
});

test("seed warns, instead of leaking, when signing is not configured", async () => {
  withSigning(false);
  const warnings: string[] = [];
  await seedPlaceholderClasses(new MemoryStorage(), Date.now(), (m) => warnings.push(m));
  assert.ok(warnings.some((m) => /MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE/.test(m)), warnings.join("\n"));
  assert.ok(warnings.some((m) => /no video yet/.test(m)));
  assert.deepEqual(signedClassWarnings([{ slug: "a", tier: "plus", playbackPolicy: "public", muxPlaybackId: "x" }], true),
    ["Plus class(es) on a public playback id are withheld until re-added as signed: a"]);
  assert.deepEqual(signedClassWarnings([{ slug: "a", tier: "plus", playbackPolicy: "signed", muxPlaybackId: "x" }], true), []);
});

test("guests and free accounts get nothing playable for Plus — list, detail or next", async () => {
  const h = await harness();
  try {
    for (const viewer of [undefined, "free"]) {
      const list = await h.get("/api/classes", viewer);
      assert.equal(list.status, 200);
      assert.equal(list.cache, "private, no-store");
      for (const row of list.body.items as Summary[]) {
        if (row.tier === "plus") {
          assert.equal(row.locked, true);
          assert.equal(row.playback, null);
        } else {
          assert.equal(row.locked, false);
          assert.deepEqual(row.playback, { provider: "mux", policy: "public", playbackId: MUX_PUBLIC_TEST_PLAYBACK_ID }, "free classes unaffected");
        }
      }
      for (const slug of plusSlugs) {
        const detail = await h.get(`/api/classes/${slug}`, viewer);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.class.locked, true);
        assert.equal(detail.body.class.playback, null);
        // The strongest checks: neither the id nor any token appears anywhere.
        assert.equal(detail.text.includes(SIGNED_IDS[slug]), false, `${slug} leaked its id to ${viewer ?? "guest"}`);
        assert.equal(/token|eyJ/.test(detail.text), false, `${slug} leaked a token to ${viewer ?? "guest"}`);
      }
      const free = await h.get(`/api/classes/${freeSlugs[0]}`, viewer);
      assert.equal(free.body.class.playback.playbackId, MUX_PUBLIC_TEST_PLAYBACK_ID);
      assert.equal(free.body.class.playback.policy, "public");
      assert.equal("tokens" in free.body.class.playback, false);
    }
  } finally { await h.close(); }
});

test("Plus members get a signed id with 1h video, thumbnail and storyboard tokens — on the detail only", async () => {
  const h = await harness();
  try {
    const before = Math.floor(Date.now() / 1000);
    const slug = plusSlugs[0];
    const res = await h.get(`/api/classes/${slug}`, "plus");
    const after = Math.floor(Date.now() / 1000);
    const playback = res.body.class.playback;
    assert.equal(res.cache, "private, no-store");
    assert.equal(playback.policy, "signed");
    assert.equal(playback.playbackId, SIGNED_IDS[slug]);
    assert.ok(playback.expiresAt >= before + CLASS_TOKEN_SECONDS && playback.expiresAt <= after + CLASS_TOKEN_SECONDS);
    const audiences = { playback: "v", thumbnail: "t", storyboard: "s" } as const;
    for (const [name, aud] of Object.entries(audiences)) {
      const jwt = decodeJwt(playback.tokens[name]);
      assert.equal(jwt.valid, true, `${name} token verifies against the signing key`);
      assert.equal(jwt.header.kid, "test-kid");
      assert.equal(jwt.payload.sub, SIGNED_IDS[slug]);
      assert.equal(jwt.payload.aud, aud);
      assert.equal(jwt.payload.exp, playback.expiresAt, "tokens expire");
      assert.equal(jwt.payload.exp - jwt.payload.iat, CLASS_TOKEN_SECONDS);
    }
    // Lists and the "next" card never mint tokens or carry signed ids.
    const list = await h.get("/api/classes", "plus");
    assert.equal(/eyJ/.test(list.text), false);
    for (const row of list.body.items as Summary[]) if (row.tier === "plus") assert.equal(row.playback, null);
    assert.equal(res.body.next?.playback ?? null, null);
    // A later request mints fresh tokens (what the player's refresh relies on).
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = await h.get(`/api/classes/${slug}`, "plus");
    assert.ok(again.body.class.playback.expiresAt > playback.expiresAt);
    assert.notEqual(again.body.class.playback.tokens.playback, playback.tokens.playback);
  } finally { await h.close(); }
});

test("a Plus member gets nothing playable when signing is missing or the class is still public", async () => {
  const unsigned = await harness({ signing: false });
  try {
    const res = await unsigned.get(`/api/classes/${plusSlugs[0]}`, "plus");
    assert.equal(res.body.class.locked, false, "a member is not sent to the paywall");
    assert.equal(res.body.class.playback, null);
    assert.equal(res.text.includes(SIGNED_IDS[plusSlugs[0]]), false);
    const free = await unsigned.get(`/api/classes/${freeSlugs[0]}`, "plus");
    assert.equal(free.body.class.playback.playbackId, MUX_PUBLIC_TEST_PLAYBACK_ID, "free classes unaffected");
  } finally { await unsigned.close(); }

  const h = await harness();
  try {
    await h.store.upsertClassBySlug({ ...PLACEHOLDER_CLASSES[3], muxPlaybackId: MUX_PUBLIC_TEST_PLAYBACK_ID, playbackPolicy: "public", createdAt: "x" });
    const res = await h.get(`/api/classes/${PLACEHOLDER_CLASSES[3].slug}`, "plus");
    assert.equal(res.body.class.playback, null);
    assert.equal(res.text.includes(MUX_PUBLIC_TEST_PLAYBACK_ID), false, "a Plus class never ships a public id");
  } finally { await h.close(); }
});

test("a locked class whose thumbnail embeds the playback id gets no thumbnail", async () => {
  const h = await harness();
  try {
    const id = SIGNED_IDS[PLACEHOLDER_CLASSES[3].slug];
    await h.store.upsertClassBySlug({ ...PLACEHOLDER_CLASSES[3], muxPlaybackId: id, thumbnailUrl: `https://image.mux.com/${id}/thumbnail.webp`, createdAt: new Date().toISOString() });
    const detail = await h.get(`/api/classes/${PLACEHOLDER_CLASSES[3].slug}`, "free");
    assert.equal(detail.body.class.thumbnailUrl, null);
    assert.equal(detail.text.includes(id), false);
    const asPlus = await h.get(`/api/classes/${PLACEHOLDER_CLASSES[3].slug}`, "plus");
    assert.match(asPlus.body.class.thumbnailUrl, /image\.mux\.com/);
  } finally { await h.close(); }
});

test("filters and pagination", async () => {
  const h = await harness();
  try {
    assert.deepEqual((await h.get("/api/classes?level=beginner")).body.items.map((r: Summary) => r.slug), freeSlugs);
    assert.equal((await h.get("/api/classes?tier=plus")).body.total, 3);
    assert.deepEqual((await h.get("/api/classes?minMinutes=15&maxMinutes=30")).body.items.map((r: Summary) => r.slug),
      ["desk-back-relief", "unwind-before-sleep", "steady-strength-flow", "deep-hamstring-release"]);
    assert.deepEqual((await h.get("/api/classes?focus=back%20pain")).body.items.map((r: Summary) => r.slug),
      ["desk-back-relief", "deep-hamstring-release"]);
    const page2 = (await h.get("/api/classes?pageSize=4&page=2")).body;
    assert.deepEqual([page2.total, page2.pageCount, page2.items.length, page2.hasMore], [6, 2, 2, false]);
    assert.equal((await h.get("/api/classes?level=expert")).status, 400);
    assert.equal((await h.get("/api/classes?minMinutes=30&maxMinutes=10")).status, 400);
    assert.equal((await h.get("/api/classes/no-such-class")).status, 404);
    assert.equal((await h.get("/api/classes/Bad%20Slug")).status, 404);
  } finally { await h.close(); }
});

test("unpublished classes are invisible", async () => {
  const h = await harness();
  try {
    await h.store.upsertClassBySlug({ ...PLACEHOLDER_CLASSES[0], slug: "draft-class", published: false, createdAt: new Date().toISOString() });
    assert.equal((await h.get("/api/classes")).body.total, 6);
    assert.equal((await h.get("/api/classes/draft-class")).status, 404);
    assert.equal((await h.post("/api/classes/draft-class/progress", { secondsWatched: 10 })).status, 404);
  } finally { await h.close(); }
});

test("progress: idempotent, owner-scoped, completes at 90%, sticky, and drives Continue watching", async () => {
  const h = await harness();
  const slug = freeSlugs[0];
  try {
    const save = async (body: unknown, owner = "device-a") => h.post(`/api/classes/${slug}/progress`, body, { "x-owner": owner });
    const first = await (await save({ secondsWatched: 120, durationSeconds: 600 })).json();
    const again = await (await save({ secondsWatched: 120, durationSeconds: 600 })).json();
    assert.deepEqual([first.progress.secondsWatched, first.progress.completed], [120, false]);
    assert.deepEqual([again.progress.secondsWatched, again.progress.completed], [120, false]);
    assert.equal((await h.store.getClassProgress("device-a")).length, 1, "one row per owner and class");

    const mine = (await h.get("/api/class-progress", undefined, "device-a")).body.items as Summary[];
    assert.deepEqual(mine.map((row) => [row.slug, row.progress?.secondsWatched]), [[slug, 120]]);
    assert.equal((await h.get("/api/class-progress")).body.items.length, 0, "another owner's progress is not visible");

    const done = await (await save({ secondsWatched: 540, durationSeconds: 600 })).json();
    assert.equal(done.progress.completed, true, "90% counts as finished");
    assert.equal((await h.get("/api/class-progress", undefined, "device-a")).body.items.length, 0, "finished classes leave Continue watching");
    const rewound = await (await save({ secondsWatched: 30, durationSeconds: 600 })).json();
    assert.deepEqual([rewound.progress.secondsWatched, rewound.progress.completed], [30, true], "rewinding keeps completion");

    const clamped = await (await save({ secondsWatched: 80_000 }, "device-b")).json();
    assert.equal(clamped.progress.secondsWatched, PLACEHOLDER_CLASSES[0].durationMinutes * 60);

    assert.equal((await save({ secondsWatched: -1 })).status, 400);
    assert.equal((await save({})).status, 400);
  } finally { await h.close(); }
});

test("progress on a locked class is refused for free viewers and accepted for Plus", async () => {
  const h = await harness();
  try {
    const locked = await h.post(`/api/classes/${plusSlugs[0]}/progress`, { secondsWatched: 60 }, { "x-as": "free" });
    assert.equal(locked.status, 403);
    assert.equal((await locked.json()).upgradeUrl, "/plus");
    assert.equal((await h.post(`/api/classes/${plusSlugs[0]}/progress`, { secondsWatched: 60 })).status, 403, "guests too");
    assert.equal((await h.post(`/api/classes/${plusSlugs[0]}/progress`, { secondsWatched: 60 }, { "x-as": "plus" })).status, 200);
  } finally { await h.close(); }
});

test("progress saves are throttled per owner and class", async () => {
  const h = await harness();
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) {
      statuses.push((await h.post(`/api/classes/${freeSlugs[1]}/progress`, { secondsWatched: i }, { "x-owner": "device-throttle" })).status);
    }
    assert.deepEqual(statuses.slice(0, 12), Array(12).fill(200));
    assert.equal(statuses[12], 429);
    // A different class still has its own budget.
    assert.equal((await h.post(`/api/classes/${freeSlugs[2]}/progress`, { secondsWatched: 1 }, { "x-owner": "device-throttle" })).status, 200);
  } finally { await h.close(); }
});

test("guest progress follows the device into an account and merges collisions", async () => {
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store);
  const [a, b] = await store.listClasses();
  await store.saveClassProgress("user:9", a.id, { secondsWatched: 50, completed: true });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await store.saveClassProgress("device-x", a.id, { secondsWatched: 200, completed: false });
  await store.saveClassProgress("device-x", b.id, { secondsWatched: 80, completed: false });
  await store.transferOwnerData("device-x", "user:9");
  const rows = await store.getClassProgress("user:9");
  assert.equal(rows.length, 2);
  const merged = rows.find((row) => row.classId === a.id)!;
  assert.deepEqual([merged.secondsWatched, merged.completed], [200, true], "newest position, finished if either was");
  assert.equal((await store.getClassProgress("device-x")).length, 0);
  await store.clearOwnerData("user:9");
  assert.equal((await store.getClassProgress("user:9")).length, 0, "account wipe clears class progress");
});
